-- Secure, idempotent vote submission for Phase 1.
-- Raw installation credentials never enter storage; only SHA-256 hashes are retained.

create extension if not exists pgcrypto with schema extensions;

drop function public.get_today_question(text);
create function public.get_today_question(p_language_code text default 'en')
returns table (
  id uuid,
  question_text text,
  source_language text,
  asked_on date,
  sponsored boolean,
  server_time timestamptz,
  voting_closes_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    q.id,
    coalesce(t.translated_text, q.question_text),
    q.source_language,
    q.asked_on,
    q.sponsored,
    now(),
    ((q.asked_on + 1)::timestamp at time zone 'utc')
  from public.questions q
  left join public.question_translations t
    on t.question_id = q.id
    and t.language_code = nullif(btrim(p_language_code), '')
    and t.is_selected
  where q.status = 'live'
    and q.asked_on = (now() at time zone 'utc')::date
  limit 1;
$$;
revoke all on function public.get_today_question(text) from public, anon, authenticated;
grant execute on function public.get_today_question(text) to anon, authenticated;
comment on function public.get_today_question(text) is
  'Returns the live UTC daily question plus authoritative server timing.';

create table private.vote_idempotency (
  installation_id uuid not null references public.installations(id) on delete cascade,
  idempotency_key uuid not null,
  question_id uuid not null references public.questions(id) on delete restrict,
  choice text not null check (choice in ('YES', 'NO')),
  vote_id uuid not null references public.votes(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (installation_id, idempotency_key)
);

create table private.vote_rate_limits (
  installation_id uuid primary key references public.installations(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0)
);

revoke all on table private.vote_idempotency from public, anon, authenticated;
revoke all on table private.vote_rate_limits from public, anon, authenticated;

create or replace function public.register_installation(p_credential text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_id uuid;
begin
  if p_credential is null
     or length(p_credential) < 32
     or length(p_credential) > 200 then
    raise exception using errcode = '22023', message = 'Invalid installation credential.';
  end if;

  v_hash := encode(extensions.digest(convert_to(p_credential, 'utf8'), 'sha256'), 'hex');

  insert into public.installations (token_hash, account_id)
  values (v_hash, auth.uid())
  on conflict (token_hash) do update
    set last_seen_at = now(),
        account_id = case
          when public.installations.account_id is null then excluded.account_id
          else public.installations.account_id
        end
  returning id into v_id;

  if auth.uid() is not null and exists (
    select 1 from public.installations i
    where i.id = v_id and i.account_id is distinct from auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Installation belongs to another account.';
  end if;

  return v_id;
end;
$$;

create or replace function public.submit_vote(
  p_credential text,
  p_question_id uuid,
  p_choice text,
  p_idempotency_key uuid
)
returns table (
  status text,
  receipt_id uuid,
  accepted_choice text,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_installation public.installations%rowtype;
  v_existing public.votes%rowtype;
  v_attempts integer;
begin
  if p_credential is null or length(p_credential) < 32 or length(p_credential) > 200
     or p_question_id is null or p_idempotency_key is null
     or p_choice not in ('YES', 'NO') then
    return query select 'INVALID_REQUEST'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  v_hash := encode(extensions.digest(convert_to(p_credential, 'utf8'), 'sha256'), 'hex');
  select * into v_installation
  from public.installations i
  where i.token_hash = v_hash;

  if not found then
    return query select 'INVALID_INSTALLATION'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if auth.uid() is not null then
    if v_installation.account_id is null then
      update public.installations set account_id = auth.uid(), last_seen_at = now()
      where id = v_installation.id;
      v_installation.account_id := auth.uid();
    elsif v_installation.account_id <> auth.uid() then
      return query select 'INSTALLATION_ACCOUNT_CONFLICT'::text, null::uuid, null::text, null::timestamptz;
      return;
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_installation.id::text || ':' || p_question_id::text, 0)
  );
  if v_installation.account_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_installation.account_id::text || ':' || p_question_id::text, 0)
    );
  end if;

  select v.* into v_existing
  from private.vote_idempotency i
  join public.votes v on v.id = i.vote_id
  where i.installation_id = v_installation.id
    and i.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.question_id <> p_question_id or v_existing.choice <> p_choice then
      return query select 'IDEMPOTENCY_CONFLICT'::text, null::uuid, null::text, null::timestamptz;
    else
      return query select 'ACCEPTED'::text, v_existing.id, v_existing.choice, v_existing.accepted_at;
    end if;
    return;
  end if;

  insert into private.vote_rate_limits (installation_id, window_started_at, attempts)
  values (v_installation.id, now(), 1)
  on conflict (installation_id) do update
    set window_started_at = case
          when private.vote_rate_limits.window_started_at <= now() - interval '10 minutes'
            then now()
          else private.vote_rate_limits.window_started_at
        end,
        attempts = case
          when private.vote_rate_limits.window_started_at <= now() - interval '10 minutes'
            then 1
          else private.vote_rate_limits.attempts + 1
        end
  returning attempts into v_attempts;

  if v_attempts > 20 then
    return query select 'RATE_LIMITED'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if not exists (
    select 1 from public.questions q
    where q.id = p_question_id
      and q.status = 'live'
      and q.asked_on = (now() at time zone 'utc')::date
      and q.results_finalized_at is null
  ) then
    return query select 'QUESTION_CLOSED'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  select v.* into v_existing
  from public.votes v
  where v.question_id = p_question_id
    and (
      v.installation_id = v_installation.id
      or (v_installation.account_id is not null and v.account_id = v_installation.account_id)
    )
  order by (v.installation_id = v_installation.id) desc
  limit 1;

  if found then
    if v_existing.choice <> p_choice then
      return query select 'ALREADY_VOTED'::text, v_existing.id, v_existing.choice, v_existing.accepted_at;
      return;
    end if;
  else
    insert into public.votes (question_id, installation_id, account_id, choice)
    values (p_question_id, v_installation.id, v_installation.account_id, p_choice)
    returning * into v_existing;
  end if;

  insert into private.vote_idempotency (
    installation_id, idempotency_key, question_id, choice, vote_id
  ) values (
    v_installation.id, p_idempotency_key, p_question_id, p_choice, v_existing.id
  );

  update public.installations set last_seen_at = now() where id = v_installation.id;
  return query select 'ACCEPTED'::text, v_existing.id, v_existing.choice, v_existing.accepted_at;
end;
$$;

revoke all on function public.register_installation(text) from public, anon, authenticated;
revoke all on function public.submit_vote(text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.register_installation(text) to anon, authenticated;
grant execute on function public.submit_vote(text, uuid, text, uuid) to anon, authenticated;

comment on function public.register_installation(text) is
  'Registers an opaque installation bearer credential; stores only its SHA-256 hash.';
comment on function public.submit_vote(text, uuid, text, uuid) is
  'Atomically accepts one immutable vote per installation/account and supports idempotent retries.';
