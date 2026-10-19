-- Clearing client storage must restore the existing receipt, never look like another acceptance.
-- The stable device signal is supplied only by the gateway as a server-peppered HMAC.
-- It remains a best-effort signal, not platform attestation or proof of a unique human.

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
     or p_choice is null or p_choice not in ('YES', 'NO') then
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
    -- A new attempt after a reset is a duplicate, even if it repeats the same choice.
    -- Only a replay of the original idempotency key above is reported as ACCEPTED.
    if p_account_id is not null and v_existing.choice = p_choice then
      insert into private.account_vote_history(account_id, question_id, vote_id)
      values (p_account_id, p_question_id, v_existing.id)
      on conflict (account_id, question_id) do nothing;
    end if;
    return query select 'ALREADY_VOTED'::text, v_existing.id, v_existing.choice, v_existing.accepted_at;
    return;
  end if;

  insert into public.votes (question_id, installation_id, account_id, choice)
  values (p_question_id, v_installation.id, v_installation.account_id, p_choice)
  returning * into v_existing;

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

revoke all on function public.submit_vote(text, uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_vote(text, uuid, uuid, text, uuid) to service_role;

create function public.get_device_vote_receipt(
  p_credential text,
  p_account_id uuid,
  p_device_fingerprint_hash text,
  p_question_id uuid
)
returns table (
  receipt_id uuid,
  accepted_choice text,
  accepted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token_hash text;
  v_installation public.installations%rowtype;
begin
  if p_credential is null or length(p_credential) < 32 or length(p_credential) > 200
     or p_device_fingerprint_hash is null
     or p_device_fingerprint_hash !~ '^[0-9a-f]{64}$'
     or p_question_id is null then
    raise exception using errcode = '22023', message = 'Invalid device receipt request.';
  end if;

  v_token_hash := encode(extensions.digest(convert_to(p_credential, 'utf8'), 'sha256'), 'hex');
  select * into v_installation
  from public.installations
  where token_hash = v_token_hash;

  if found then
    -- Possession of one installation credential cannot probe another device's receipt.
    -- Legacy rows without a device signal can still use their existing secret credential.
    -- A reset credential cannot recover those rows because no stable signal was recorded.
    if v_installation.device_fingerprint_hash is not null
       and v_installation.device_fingerprint_hash <> p_device_fingerprint_hash then
      raise exception using errcode = '42501', message = 'Installation device conflict.';
    end if;
  else
    -- A fresh credential after clearing data may restore, but never rotates the stored credential.
    select * into v_installation
    from public.installations
    where device_fingerprint_hash = p_device_fingerprint_hash;
  end if;

  if p_account_id is not null and v_installation.account_id is not null
     and v_installation.account_id <> p_account_id then
    raise exception using errcode = '42501', message = 'Installation belongs to another account.';
  end if;

  return query
  select v.id, v.choice, v.accepted_at
  from public.votes v
  where v.question_id = p_question_id
    and (
      v.installation_id = v_installation.id
      or (p_account_id is not null and v.account_id = p_account_id)
      or (p_account_id is not null and exists (
        select 1 from private.account_vote_history h
        where h.account_id = p_account_id
          and h.question_id = p_question_id
          and h.vote_id = v.id
      ))
    )
  order by (v.installation_id = v_installation.id) desc nulls last
  limit 1;
end;
$$;

revoke all on function public.get_device_vote_receipt(text, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.get_device_vote_receipt(text, uuid, text, uuid) to service_role;

comment on function public.get_device_vote_receipt(text, uuid, text, uuid) is
  'Gateway-only read-only receipt restoration using the recognized device signal or a verified account; does not register or rotate credentials.';
comment on function public.submit_vote(text, uuid, uuid, text, uuid) is
  'Accepts one immutable vote per installation/account; only exact idempotent retries return ACCEPTED and fresh duplicate attempts return ALREADY_VOTED.';
