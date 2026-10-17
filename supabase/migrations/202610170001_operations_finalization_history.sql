-- Production operations, atomic finalization, and canonical account history.
-- Vote credentials continue to be hashed; the Edge Function supplies only a verified auth user id.

create extension if not exists pg_cron;

create table private.runtime_controls (
  singleton boolean primary key default true check (singleton),
  voting_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into private.runtime_controls (singleton) values (true) on conflict do nothing;
revoke all on table private.runtime_controls from public, anon, authenticated;

create table private.account_vote_history (
  account_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  vote_id uuid not null references public.votes(id) on delete restrict,
  linked_at timestamptz not null default now(),
  primary key (account_id, question_id),
  unique (account_id, vote_id)
);
revoke all on table private.account_vote_history from public, anon, authenticated;
insert into private.account_vote_history(account_id, question_id, vote_id)
select account_id, question_id, id from public.votes where account_id is not null
on conflict (account_id, question_id) do nothing;

drop function public.register_installation(text);
drop function public.submit_vote(text, uuid, text, uuid);
create or replace function public.register_installation(p_credential text, p_account_id uuid default null)
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
  values (v_hash, p_account_id)
  on conflict (token_hash) do update
    set last_seen_at = now(),
        account_id = case
          when public.installations.account_id is null then excluded.account_id
          else public.installations.account_id
        end
  returning id into v_id;

  if p_account_id is not null and exists (
    select 1 from public.installations i
    where i.id = v_id and i.account_id is distinct from p_account_id
  ) then
    raise exception using errcode = '42501', message = 'Installation belongs to another account.';
  end if;

  return v_id;
end;
$$;

create or replace function public.submit_vote(
  p_credential text,
  p_account_id uuid,
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
  if not coalesce((select voting_enabled from private.runtime_controls where singleton), false) then
    return query select 'VOTING_DISABLED'::text, null::uuid, null::text, null::timestamptz;
    return;
  end if;

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

  if p_account_id is not null then
    if v_installation.account_id is null then
      update public.installations set account_id = p_account_id, last_seen_at = now()
      where id = v_installation.id;
      v_installation.account_id := p_account_id;
    elsif v_installation.account_id <> p_account_id then
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
      or (p_account_id is not null and exists (
        select 1 from private.account_vote_history h
        where h.account_id = p_account_id
          and h.question_id = p_question_id
          and h.vote_id = v.id
      ))
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

  if p_account_id is not null then
    insert into private.account_vote_history(account_id, question_id, vote_id)
    values (p_account_id, p_question_id, v_existing.id)
    on conflict (account_id, question_id) do nothing;
  end if;

  update public.installations set last_seen_at = now() where id = v_installation.id;
  return query select 'ACCEPTED'::text, v_existing.id, v_existing.choice, v_existing.accepted_at;
end;
$$;


revoke all on function public.register_installation(text, uuid) from public, anon, authenticated;
revoke all on function public.submit_vote(text, uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.register_installation(text, uuid) to service_role;
grant execute on function public.submit_vote(text, uuid, uuid, text, uuid) to service_role;

create table private.history_merge_audit (
  id bigint generated always as identity primary key,
  account_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null references public.installations(id) on delete restrict,
  claimed_count integer not null,
  conflict_count integer not null,
  created_at timestamptz not null default now()
);
revoke all on table private.history_merge_audit from public, anon, authenticated;

create or replace function public.claim_installation_history(p_credential text)
returns table (claimed_count integer, conflict_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid := auth.uid();
  v_installation public.installations%rowtype;
  v_claimed integer := 0;
  v_conflicts integer := 0;
  v_vote public.votes%rowtype;
begin
  if v_account_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if p_credential is null or length(p_credential) < 32 or length(p_credential) > 200 then
    raise exception using errcode = '22023', message = 'Invalid installation credential.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_account_id::text, 0));
  select * into v_installation from public.installations
  where token_hash = encode(extensions.digest(convert_to(p_credential, 'utf8'), 'sha256'), 'hex')
  for update;
  if not found then
    insert into public.installations(token_hash, account_id)
    values (encode(extensions.digest(convert_to(p_credential, 'utf8'), 'sha256'), 'hex'), v_account_id)
    returning * into v_installation;
  end if;
  if v_installation.account_id is not null and v_installation.account_id <> v_account_id then
    raise exception using errcode = '42501', message = 'Installation belongs to another account.';
  end if;

  update public.installations set account_id = v_account_id, last_seen_at = now()
  where id = v_installation.id;

  for v_vote in select * from public.votes
    where installation_id = v_installation.id
      and (account_id is null or account_id = v_account_id)
    order by accepted_at, id for update
  loop
    insert into private.account_vote_history(account_id, question_id, vote_id)
    values (v_account_id, v_vote.question_id, v_vote.id)
    on conflict (account_id, question_id) do nothing;
    if found then v_claimed := v_claimed + 1; else v_conflicts := v_conflicts + 1; end if;
  end loop;

  insert into private.history_merge_audit(account_id, installation_id, claimed_count, conflict_count)
  values (v_account_id, v_installation.id, v_claimed, v_conflicts);
  return query select v_claimed, v_conflicts;
end;
$$;

create or replace function public.list_my_vote_history(p_before timestamptz default null, p_limit integer default 50)
returns table(question_id uuid, choice text, accepted_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select v.question_id, v.choice, v.accepted_at
  from private.account_vote_history h join public.votes v on v.id = h.vote_id
  where h.account_id = auth.uid()
    and (p_before is null or v.accepted_at < p_before)
    and p_limit between 1 and 100
  order by v.accepted_at desc, v.id desc limit p_limit;
$$;
revoke all on function public.claim_installation_history(text) from public, anon, authenticated;
revoke all on function public.list_my_vote_history(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_installation_history(text) to authenticated;
grant execute on function public.list_my_vote_history(timestamptz, integer) to authenticated;

create or replace function private.finalize_daily_pulse(p_now timestamptz default now())
returns table(finalized_count integer, activated_count integer)
language plpgsql security definer set search_path = ''
as $$
declare v_finalized integer := 0; v_activated integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(70757365);
  with eligible as (
    select q.id,
      count(v.id) filter (where v.choice = 'YES')::bigint yes_count,
      count(v.id) filter (where v.choice = 'NO')::bigint no_count
    from public.questions q left join public.votes v on v.question_id = q.id
    where q.status = 'live' and q.asked_on < (p_now at time zone 'utc')::date
    group by q.id
  ), inserted as (
    insert into public.question_results(question_id, yes_count, no_count, result, finalized_at)
    select id, yes_count, no_count,
      case when yes_count > no_count then 'YES' when no_count > yes_count then 'NO' else 'TIE' end,
      p_now from eligible on conflict (question_id) do nothing returning question_id, finalized_at
  )
  update public.questions q set status = 'archived', results_finalized_at = i.finalized_at
  from inserted i where q.id = i.question_id;
  get diagnostics v_finalized = row_count;

  update public.questions set status = 'live'
  where asked_on = (p_now at time zone 'utc')::date and status = 'scheduled';
  get diagnostics v_activated = row_count;
  return query select v_finalized, v_activated;
end;
$$;
revoke all on function private.finalize_daily_pulse(timestamptz) from public, anon, authenticated;
grant execute on function private.finalize_daily_pulse(timestamptz) to postgres, service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'pulse-daily-finalization';
select cron.schedule('pulse-daily-finalization', '0 12 * * *',
  $$select * from private.finalize_daily_pulse(now());$$);
