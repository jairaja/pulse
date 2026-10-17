-- Best-effort reinstall resistance. The raw platform identifier never reaches PostgreSQL;
-- the vote gateway stores only a server-peppered HMAC.

alter table public.installations
  add column device_fingerprint_hash text;

alter table public.installations
  add constraint installations_device_fingerprint_hash_format
  check (device_fingerprint_hash is null or device_fingerprint_hash ~ '^[0-9a-f]{64}$');

create unique index installations_device_fingerprint_hash_key
  on public.installations (device_fingerprint_hash)
  where device_fingerprint_hash is not null;

drop function public.register_installation(text, uuid);
create function public.register_installation(
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
    if p_account_id is not null and v_installation.account_id is not null
       and v_installation.account_id <> p_account_id then
      raise exception using errcode = '42501', message = 'Installation belongs to another account.';
    end if;

    update public.installations
    set token_hash = v_token_hash,
        device_fingerprint_hash = p_device_fingerprint_hash,
        account_id = coalesce(public.installations.account_id, p_account_id),
        last_seen_at = now()
    where id = v_installation.id
    returning * into v_installation;
  else
    insert into public.installations (token_hash, device_fingerprint_hash, account_id)
    values (v_token_hash, p_device_fingerprint_hash, p_account_id)
    returning * into v_installation;
  end if;

  return v_installation.id;
end;
$$;

revoke all on function public.register_installation(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.register_installation(text, uuid, text) to service_role;

comment on column public.installations.device_fingerprint_hash is
  'Server-peppered HMAC of a platform-scoped identifier; never a raw device identifier.';
comment on function public.register_installation(text, uuid, text) is
  'Gateway-only registration that reuses an installation row when a stable platform signal survives reinstall.';
