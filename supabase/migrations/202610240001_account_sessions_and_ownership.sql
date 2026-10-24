create or replace function public.register_installation(
  p_credential text,
  p_account_id uuid,
  p_device_fingerprint_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash text;
  v_installation public.installations%rowtype;
begin
  if p_credential is null or length(p_credential) < 32 or length(p_credential) > 200
     or p_device_fingerprint_hash is null
     or p_device_fingerprint_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid device registration.';
  end if;

  v_token_hash := encode(extensions.digest(convert_to(p_credential, 'utf8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_device_fingerprint_hash, 0)
  );

  select * into v_installation
  from public.installations
  where token_hash = v_token_hash
  for update;

  if found then
    if v_installation.device_fingerprint_hash is not null
       and v_installation.device_fingerprint_hash <> p_device_fingerprint_hash then
      raise exception using errcode = '42501', message = 'Installation device conflict.';
    end if;
  else
    select * into v_installation
    from public.installations
    where device_fingerprint_hash = p_device_fingerprint_hash
    for update;
  end if;

  if found then
    update public.installations
    set token_hash = v_token_hash,
        device_fingerprint_hash = p_device_fingerprint_hash,
        account_id = public.installations.account_id,
        last_seen_at = now()
    where id = v_installation.id
    returning * into v_installation;
  else
    insert into public.installations (token_hash, device_fingerprint_hash, account_id)
    values (v_token_hash, p_device_fingerprint_hash, null)
    returning * into v_installation;
  end if;

  return v_installation.id;
end;
$$;

revoke all on function public.register_installation(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.register_installation(text, uuid, text) to service_role;


alter table public.votes alter column accepted_at set default clock_timestamp();
alter table public.installations add column history_epoch timestamptz not null default '1970-01-01';

-- Account leases are independent of device recognition and immutable vote ownership.
-- Deploy the account gateway and updated apps with this migration (old account sessions reauthenticate).
create table private.auth_ceremonies (
  id uuid primary key, email_hash text not null, installation_id uuid not null references public.installations(id),
  created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
  account_id uuid references auth.users(id) on delete cascade, completed_session uuid, import_decision boolean,
  verified_session uuid, otp_attempts integer not null default 0, imported_count integer not null default 0
);
create table private.signup_import_entitlements (
  account_id uuid primary key references auth.users(id) on delete cascade,
  installation_id uuid not null references public.installations(id), cutoff timestamptz not null,
  consumed boolean not null default false
);
create table private.account_sessions (
  account_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid unique, installation_id uuid not null references public.installations(id),
  started_at timestamptz not null, last_active_at timestamptz not null
);
create table private.used_account_sessions (
  session_id uuid primary key, account_id uuid not null references auth.users(id) on delete cascade
);
create table private.account_devices (
  account_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null references public.installations(id),
  first_seen_at timestamptz not null default clock_timestamp(), last_seen_at timestamptz not null default clock_timestamp(),
  primary key(account_id,installation_id)
);
create table public.account_session_notices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  changed_at timestamptz not null default clock_timestamp()
);
alter table public.account_session_notices enable row level security;
revoke all on public.account_session_notices from public,anon,authenticated;
grant select on public.account_session_notices to authenticated;
create policy own_session_notice on public.account_session_notices for select to authenticated using(user_id=auth.uid());
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.account_session_notices;
  end if;
end $$;
create index auth_ceremonies_email_rate on private.auth_ceremonies(email_hash,created_at);
create index auth_ceremonies_device_rate on private.auth_ceremonies(installation_id,created_at);
revoke all on private.auth_ceremonies,private.signup_import_entitlements,private.account_sessions,private.used_account_sessions,private.account_devices from public,anon,authenticated;

-- Legacy account links remain provenance only. They never determine the next vote's owner.
comment on column public.installations.account_id is 'Deprecated provenance, never current identity or ownership. See private.account_devices.';
insert into private.account_devices(account_id,installation_id)
select account_id,id from public.installations where account_id is not null on conflict do nothing;

-- A server-issued signup ceremony can be attached ONLY by the auth.users INSERT trigger.
-- Existing sign-ins, editable metadata and first login on a second phone cannot create this entitlement.
create function private.capture_signup_ceremony() returns trigger language plpgsql security definer set search_path='' as $$
declare v_c private.auth_ceremonies%rowtype;
begin
  update private.auth_ceremonies set account_id=new.id
  where id::text=new.raw_user_meta_data->>'pulse_signup_ceremony' and account_id is null
    and expires_at>clock_timestamp()
    and email_hash=encode(extensions.digest(convert_to(lower(btrim(new.email)),'utf8'),'sha256'),'hex')
    returning * into v_c;
  if found then
    insert into private.signup_import_entitlements(account_id,installation_id,cutoff) values(new.id,v_c.installation_id,v_c.created_at);
  end if;
  return new;
end $$;
create trigger pulse_signup_ceremony after insert on auth.users for each row execute function private.capture_signup_ceremony();

create function private.assert_account_session(p_account uuid,p_session uuid,p_device uuid default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  -- Shared through transaction end: replacing the session waits for already authorized writes.
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('account-session:'||p_account::text,0));
  if p_account is null or p_session is null or not exists(select 1 from private.account_sessions s
    where s.account_id=p_account and s.session_id=p_session
      and (p_device is null or s.installation_id=p_device)) then
    raise exception using errcode='42501',message='SESSION_REPLACED';
  end if;
end $$;
create function private.assert_current_session() returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_account_session(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid);
end $$;

create function public.session_status() returns boolean language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_current_session(); return true;
exception when insufficient_privilege then return false;
end $$;
grant execute on function public.session_status() to authenticated;

create or replace function public.list_my_vote_history(p_before timestamptz default null,p_limit integer default 50)
returns table(question_id uuid,choice text,accepted_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.assert_current_session();
  return query select v.question_id,v.choice,v.accepted_at
    from private.account_vote_history h join public.votes v on v.id=h.vote_id
    where h.account_id=auth.uid() and (p_before is null or v.accepted_at<p_before)
      and p_limit between 1 and 100 order by v.accepted_at desc,v.id desc limit p_limit;
end $$;

-- Gateway-only ceremony creation. Rate limit before sending an email; no email-existence endpoint.
create function public.begin_account_auth(p_id uuid,p_email_hash text,p_credential text,p_device_hash text)
returns void language plpgsql security definer set search_path='' as $$
declare v_device uuid;
begin
  v_device:=public.register_installation(p_credential,null,p_device_hash);
  if (select count(*) from private.auth_ceremonies where created_at>clock_timestamp()-interval '1 hour'
    and (installation_id=v_device or email_hash=p_email_hash))>=8 then
    raise exception using errcode='P0001',message='Wait before requesting another code.';
  end if;
  delete from private.auth_ceremonies where created_at<clock_timestamp()-interval '30 days';
  insert into private.auth_ceremonies(id,email_hash,installation_id,expires_at)
    values(p_id,p_email_hash,v_device,clock_timestamp()+interval '15 minutes');
end $$;

-- Only the account Edge Function calls these after verifying the actual OTP with Supabase Auth.
create function public.authorize_account_otp(p_ceremony uuid,p_email_hash text,p_device_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_device uuid;
begin
  select id into v_device from public.installations where device_fingerprint_hash=p_device_hash;
  update private.auth_ceremonies set otp_attempts=otp_attempts+1 where id=p_ceremony
    and installation_id=v_device and email_hash=p_email_hash and expires_at>clock_timestamp()
    and completed_session is null and verified_session is null and otp_attempts<6;
  return found;
end $$;
create function public.bind_account_otp(p_account uuid,p_session uuid,p_ceremony uuid,p_device_hash text)
returns void language plpgsql security definer set search_path='' as $$
begin
  update private.auth_ceremonies c set verified_session=p_session
    where c.id=p_ceremony and c.completed_session is null and c.verified_session is null and c.expires_at>clock_timestamp()
      and c.installation_id=(select id from public.installations where device_fingerprint_hash=p_device_hash)
      and c.email_hash=(select encode(extensions.digest(convert_to(lower(btrim(email)),'utf8'),'sha256'),'hex') from auth.users where id=p_account and email_confirmed_at is not null);
  if not found or p_session is null then raise exception using errcode='42501',message='Invalid sign-in ceremony.'; end if;
end $$;
revoke all on function public.authorize_account_otp(uuid,text,text),public.bind_account_otp(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.authorize_account_otp(uuid,text,text),public.bind_account_otp(uuid,uuid,uuid,text) to service_role;

create function public.complete_account_auth(p_account uuid,p_session uuid,p_ceremony uuid,p_credential text,
  p_device_hash text,p_import boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_device uuid; v_c private.auth_ceremonies%rowtype; v_e private.signup_import_entitlements%rowtype; v_new boolean:=false; v_count integer:=0;
begin
  if p_account is null or p_session is null or p_import is null or not exists(select 1 from auth.users
    where id=p_account and email_confirmed_at is not null) then raise exception 'Invalid verified account.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('account-session:'||p_account::text,0));
  v_device:=public.register_installation(p_credential,null,p_device_hash);
  select * into v_c from private.auth_ceremonies where id=p_ceremony for update;
  if not found or v_c.verified_session is distinct from p_session or v_c.installation_id<>v_device or
    v_c.email_hash<>(select encode(extensions.digest(convert_to(lower(btrim(email)),'utf8'),'sha256'),'hex') from auth.users where id=p_account) then
    raise exception using errcode='42501',message='Invalid sign-in ceremony.';
  end if;
  if v_c.completed_session=p_session and exists(select 1 from private.account_sessions
    where account_id=p_account and session_id=p_session and installation_id=v_device) then
    if v_c.import_decision is distinct from p_import then raise exception using errcode='42501',message='Sign in again with a new email code.'; end if;
    return jsonb_build_object('new_account',v_c.account_id=p_account,'imported',0);
  end if;
  if v_c.completed_session is not null or v_c.expires_at<=clock_timestamp() or
    exists(select 1 from private.used_account_sessions where session_id=p_session) then
    raise exception using errcode='42501',message='Sign in again with a new email code.';
  end if;
  select * into v_e from private.signup_import_entitlements where account_id=p_account for update;
  v_new:=found and not v_e.consumed and v_e.installation_id=v_device;
  if coalesce(v_new,false) and p_import then
    -- Serialize a shared device's import; claims never steal another account's raw/history ownership.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('history-import:'||v_device::text,0));
    with claimed as (
      insert into private.account_vote_history(account_id,question_id,vote_id)
      select p_account,v.question_id,v.id from public.votes v
      where v.installation_id=v_device and v.account_id is null and v.accepted_at<=v_e.cutoff
        and v.accepted_at>=(select history_epoch from public.installations where id=v_device)
        and not exists(select 1 from private.account_vote_history h where h.vote_id=v.id)
      on conflict do nothing returning vote_id
    ) select count(*) into v_count from claimed;
  end if;
  update private.signup_import_entitlements set consumed=true where account_id=p_account;
  update public.installations set history_epoch=clock_timestamp() where id=v_device
    or id=(select installation_id from private.account_sessions where account_id=p_account);
  update private.auth_ceremonies set completed_session=p_session,import_decision=p_import,imported_count=v_count where id=p_ceremony;
  insert into private.used_account_sessions values(p_session,p_account);
  insert into private.account_sessions values(p_account,p_session,v_device,clock_timestamp(),clock_timestamp())
    on conflict(account_id) do update set session_id=excluded.session_id,installation_id=excluded.installation_id,
      started_at=excluded.started_at,last_active_at=excluded.last_active_at;
  insert into private.account_devices(account_id,installation_id) values(p_account,v_device)
    on conflict(account_id,installation_id) do update set last_seen_at=clock_timestamp();
  delete from private.account_devices where account_id=p_account and installation_id<>v_device
    and (last_seen_at<clock_timestamp()-interval '180 days' or installation_id in (
      select installation_id from private.account_devices where account_id=p_account and installation_id<>v_device
        order by last_seen_at desc,installation_id offset 19));
  insert into public.account_session_notices(user_id) values(p_account)
    on conflict(user_id) do update set changed_at=clock_timestamp();
  return jsonb_build_object('new_account',coalesce(v_new,false),'imported',v_count);
end $$;
create function public.end_account_session(p_account uuid,p_session uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('account-session:'||p_account::text,0));
  update public.installations set history_epoch=clock_timestamp() where id=(select installation_id
    from private.account_sessions where account_id=p_account and session_id=p_session);
  update private.account_sessions set session_id=null where account_id=p_account and session_id=p_session;
  if found then
    update public.account_session_notices set changed_at=clock_timestamp() where user_id=p_account;
  end if;
end $$;
create function public.touch_account_session() returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_current_session();
  update private.account_sessions set last_active_at=clock_timestamp() where account_id=auth.uid()
    and last_active_at<clock_timestamp()-interval '5 minutes';
end $$;
grant execute on function public.touch_account_session() to authenticated;

revoke all on function public.claim_installation_history(text) from public,anon,authenticated;
comment on function public.claim_installation_history(text) is 'Retired: imports only through a new-account creation ceremony with consent.';

-- Defense in depth for every REST RPC, including older installed clients.
create function public.check_account_lease() returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null and current_setting('request.path',true) not in ('/rpc/session_status') then
    perform private.assert_current_session();
  end if;
end $$;
grant execute on function public.check_account_lease() to anon,authenticated,service_role;
alter role authenticator set pgrst.db_pre_request='public.check_account_lease';
notify pgrst,'reload config';

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.begin_account_auth(uuid,text,text,text),
  public.complete_account_auth(uuid,uuid,uuid,text,text,boolean),public.end_account_session(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.begin_account_auth(uuid,text,text,text),
  public.complete_account_auth(uuid,uuid,uuid,text,text,boolean),public.end_account_session(uuid,uuid) to service_role;

-- Retire old service entry points; clients cannot choose session IDs.
revoke all on function public.submit_vote(text,uuid,uuid,text,uuid),public.get_device_vote_receipt(text,uuid,text,uuid) from service_role;
create or replace function public.submit_vote(
  p_credential text,
  p_account_id uuid,
  p_question_id uuid,
  p_choice text,
  p_idempotency_key uuid,
  p_session_id uuid
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
    perform private.assert_account_session(p_account_id,p_session_id,v_installation.id);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_installation.id::text || ':' || p_question_id::text, 0)
  );
  if p_account_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_account_id::text || ':' || p_question_id::text, 0)
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
    elsif v_existing.account_id is not distinct from p_account_id and
      (p_account_id is not null or (v_existing.accepted_at>=v_installation.history_epoch
        and not exists(select 1 from private.account_vote_history h where h.vote_id=v_existing.id))) then
      return query select 'ACCEPTED'::text, v_existing.id, v_existing.choice, v_existing.accepted_at;
    else
      return query select 'ALREADY_VOTED'::text,v_existing.id,null::text,v_existing.accepted_at;
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
      or (p_account_id is not null and v.account_id = p_account_id)
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
    return query select 'ALREADY_VOTED'::text, v_existing.id,
      case when (p_account_id is not null and (v_existing.account_id=p_account_id or exists(select 1 from private.account_vote_history h where h.account_id=p_account_id and h.vote_id=v_existing.id)))
        or (v_existing.account_id is null and not exists(select 1 from private.account_vote_history h where h.vote_id=v_existing.id)
          and v_existing.accepted_at>=v_installation.history_epoch) then v_existing.choice else null::text end,
      v_existing.accepted_at;
    return;
  end if;

  insert into public.votes (question_id, installation_id, account_id, choice)
  values (p_question_id, v_installation.id, p_account_id, p_choice)
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

revoke all on function public.submit_vote(text, uuid, uuid, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_vote(text, uuid, uuid, text, uuid, uuid) to service_role;

create or replace function public.get_device_vote_receipt(
  p_credential text,
  p_account_id uuid,
  p_device_fingerprint_hash text,
  p_question_id uuid,
  p_session_id uuid
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

  if p_account_id is not null then
    perform private.assert_account_session(p_account_id,p_session_id,v_installation.id);
  end if;
  return query
  select v.id, case when (p_account_id is not null and (v.account_id=p_account_id or exists(select 1 from private.account_vote_history h where h.account_id=p_account_id and h.vote_id=v.id)))
    or (v.account_id is null and not exists(select 1 from private.account_vote_history h where h.vote_id=v.id)
      and v.accepted_at>=v_installation.history_epoch) then v.choice else null::text end, v.accepted_at
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

revoke all on function public.get_device_vote_receipt(text, uuid, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_device_vote_receipt(text, uuid, text, uuid, uuid) to service_role;
