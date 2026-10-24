begin;

select no_plan();
create function pg_temp.reset_vote(text,uuid,uuid,text,uuid) returns table(status text,receipt_id uuid,accepted_choice text,accepted_at timestamptz)
language sql as $$ select * from public.submit_vote($1,$2,$3,$4,$5,null) $$;
create function pg_temp.reset_receipt(text,uuid,text,uuid) returns table(receipt_id uuid,accepted_choice text,accepted_at timestamptz)
language sql as $$ select * from public.get_device_vote_receipt($1,$2,$3,$4,$2) $$;

select ok(
  not has_function_privilege('anon', 'public.get_device_vote_receipt(text,uuid,text,uuid,uuid)', 'EXECUTE'),
  'anonymous clients cannot call receipt restoration directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.get_device_vote_receipt(text,uuid,text,uuid,uuid)', 'EXECUTE'),
  'signed-in clients cannot forge trusted device or account arguments'
);
select ok(
  has_function_privilege('service_role', 'public.get_device_vote_receipt(text,uuid,text,uuid,uuid)', 'EXECUTE'),
  'only the gateway service role can restore a recognized receipt'
);
select ok(
  (
    select prosecdef and provolatile = 's'
      and coalesce(array_to_string(proconfig, ','), '') like '%search_path=%'
    from pg_catalog.pg_proc
    where oid = 'public.get_device_vote_receipt(text,uuid,text,uuid,uuid)'::regprocedure
  ),
  'receipt restoration is a stable definer with an empty search path'
);

-- Use today's question even when this test is run against an already-seeded local database.
insert into public.questions (id, question_text, asked_on, status)
values (
  '21000000-0000-4000-8000-000000000001',
  'Storage reset regression question?',
  (now() at time zone 'utc')::date,
  'live'
)
on conflict (asked_on) where status in ('live','archived') do update set status = 'live', results_finalized_at = null;

create temporary table reset_fixture as
select
  'reset-original-credential-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'::text as original_credential,
  'reset-replacement-credential-bbbbbbbbbbbbbbbbbbbbbbbbbbbb'::text as reset_credential,
  repeat('d', 64)::text as fingerprint,
  public.register_installation(
    'reset-original-credential-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', null, repeat('d', 64)
  ) as installation_id,
  (select id from public.questions where asked_on = (now() at time zone 'utc')::date) as question_id,
  null::uuid as receipt_id,
  null::timestamptz as accepted_at;

create temporary table first_acceptance as
select r.* from reset_fixture f,
lateral pg_temp.reset_vote(
  f.original_credential, null, f.question_id, 'YES', '31000000-0000-4000-8000-000000000001'
) r;

update reset_fixture f set receipt_id = r.receipt_id, accepted_at = r.accepted_at
from first_acceptance r;

select is((select status from first_acceptance), 'ACCEPTED', 'the original vote is accepted');

-- Make last_seen_at visibly different from transaction now(), so any accidental write is detected.
update public.installations set last_seen_at = now() - interval '1 day'
where id = (select installation_id from reset_fixture);

create function pg_temp.vote_state()
returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'installations', (select jsonb_agg(to_jsonb(i) order by i.id) from public.installations i),
    'votes', (select jsonb_agg(to_jsonb(v) order by v.id) from public.votes v),
    'idempotency', (select jsonb_agg(to_jsonb(i) order by i.installation_id, i.idempotency_key) from private.vote_idempotency i),
    'rate_limits', (select jsonb_agg(to_jsonb(r) order by r.installation_id) from private.vote_rate_limits r),
    'history', (select jsonb_agg(to_jsonb(h) order by h.account_id, h.question_id) from private.account_vote_history h)
  );
$$;

create temporary table before_lookup as select pg_temp.vote_state() as state;

select results_eq(
  $$ select r.* from reset_fixture f,
     lateral pg_temp.reset_receipt(f.original_credential, null, f.fingerprint, f.question_id) r $$,
  $$ select receipt_id, 'YES'::text, accepted_at from reset_fixture $$,
  'the existing credential restores the original receipt'
);
select results_eq(
  $$ select r.* from reset_fixture f,
     lateral pg_temp.reset_receipt(f.reset_credential, null, f.fingerprint, f.question_id) r $$,
  $$ select receipt_id, 'YES'::text, accepted_at from reset_fixture $$,
  'clearing all client data restores the same receipt with a fresh credential'
);
select is(
  pg_temp.vote_state(), (select state from before_lookup),
  'receipt restoration changes no installation, credential, timestamp, vote, idempotency, rate limit, or history'
);
select is(
  (select count(*)::integer from reset_fixture f,
   lateral pg_temp.reset_receipt(f.reset_credential, null, repeat('e', 64), f.question_id) r),
  0,
  'an unknown device does not see another device receipt'
);
select is(
  (select count(*)::integer from reset_fixture f,
   lateral pg_temp.reset_receipt(f.reset_credential, null, f.fingerprint,
     '21000000-0000-4000-8000-000000000099') r),
  0,
  'a device with no vote for the requested question has no receipt'
);
select throws_ok(
  $$ select pg_temp.reset_receipt(
     'reset-original-credential-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', null, repeat('e', 64),
     (select question_id from reset_fixture)) $$,
  '42501', 'Installation device conflict.',
  'a known credential cannot be used with a different fingerprint'
);
select throws_ok(
  $$ select pg_temp.reset_receipt('short', null, repeat('d', 64),
     (select question_id from reset_fixture)) $$,
  '22023', 'Invalid device receipt request.', 'short credentials fail closed'
);
select throws_ok(
  $$ select pg_temp.reset_receipt(
     'reset-replacement-credential-bbbbbbbbbbbbbbbbbbbbbbbbbbbb', null, 'not-a-hash',
     (select question_id from reset_fixture)) $$,
  '22023', 'Invalid device receipt request.', 'malformed fingerprints fail closed'
);
select throws_ok(
  $$ select pg_temp.reset_receipt(
     'reset-replacement-credential-bbbbbbbbbbbbbbbbbbbbbbbbbbbb', null, repeat('d', 64), null) $$,
  '22023', 'Invalid device receipt request.', 'missing question ids fail closed'
);

update public.installations set device_fingerprint_hash = null
where id = (select installation_id from reset_fixture);
select results_eq(
  $$ select r.* from reset_fixture f,
     lateral pg_temp.reset_receipt(f.original_credential, null, f.fingerprint, f.question_id) r $$,
  $$ select receipt_id, 'YES'::text, accepted_at from reset_fixture $$,
  'a pre-fingerprint installation can restore its receipt using its existing secret credential'
);
select is(
  (select count(*)::integer from reset_fixture f,
   lateral pg_temp.reset_receipt(f.reset_credential, null, f.fingerprint, f.question_id) r),
  0,
  'a fresh credential cannot guess which pre-fingerprint installation owned a vote'
);
select ok(
  (select device_fingerprint_hash is null from public.installations
   where id = (select installation_id from reset_fixture)),
  'legacy receipt restoration does not populate an unrecorded device fingerprint'
);
update public.installations set device_fingerprint_hash = repeat('d', 64)
where id = (select installation_id from reset_fixture);

select is(
  (select public.register_installation(f.reset_credential, null, f.fingerprint) from reset_fixture f),
  (select installation_id from reset_fixture),
  'submitting after a data clear reuses the existing installation'
);
select is(
  (select count(*)::integer from public.installations where device_fingerprint_hash = repeat('d', 64)),
  1,
  'a data clear never creates a second recognized installation'
);

create temporary table same_choice_reset as
select r.* from reset_fixture f,
lateral pg_temp.reset_vote(
  f.reset_credential, null, f.question_id, 'YES', '31000000-0000-4000-8000-000000000002'
) r;
select is(
  (select status from same_choice_reset), 'ALREADY_VOTED',
  'same-choice submission with a new key after data clear is reported as a duplicate'
);
select results_eq(
  $$ select receipt_id, accepted_choice, accepted_at from same_choice_reset $$,
  $$ select receipt_id, 'YES'::text, accepted_at from reset_fixture $$,
  'the duplicate carries the original receipt and unchanged acceptance time'
);
select is(
  (select status from reset_fixture f,
   lateral pg_temp.reset_vote(f.reset_credential, null, f.question_id, 'NO',
     '31000000-0000-4000-8000-000000000003') r),
  'ALREADY_VOTED', 'data clear cannot change the original vote'
);
select is(
  (select status from reset_fixture f,
   lateral pg_temp.reset_vote(f.reset_credential, null, f.question_id, 'YES',
     '31000000-0000-4000-8000-000000000001') r),
  'ACCEPTED', 'an exact original idempotent retry still recovers its acceptance'
);
select is(
  (select status from reset_fixture f,
   lateral pg_temp.reset_vote(f.reset_credential, null, f.question_id, 'NO',
     '31000000-0000-4000-8000-000000000001') r),
  'IDEMPOTENCY_CONFLICT', 'the original key cannot be reused for a substituted choice'
);
select is(
  (select status from reset_fixture f,
   lateral pg_temp.reset_vote(f.reset_credential, null, f.question_id, null,
     '31000000-0000-4000-8000-000000000004') r),
  'INVALID_REQUEST', 'a null choice is rejected before a database constraint failure'
);
select is(
  (select count(*)::integer from public.votes where installation_id = (select installation_id from reset_fixture)),
  1, 'same-choice, changed-choice, and replay attempts leave exactly one database vote'
);
select is(
  (select count(*)::integer from private.vote_idempotency where installation_id = (select installation_id from reset_fixture)),
  1, 'new-key duplicates do not create additional accepted idempotency records'
);
select is(
  (select accepted_at from public.votes where id = (select receipt_id from reset_fixture)),
  (select accepted_at from reset_fixture), 'the accepted vote timestamp never changes'
);

-- Recognized device membership is not ownership; former-account answers are redacted.
insert into auth.users(id,email_confirmed_at) values
 ('41000000-0000-4000-8000-000000000001',now()),('41000000-0000-4000-8000-000000000002',now());
insert into private.account_vote_history(account_id,question_id,vote_id)
select '41000000-0000-4000-8000-000000000001',question_id,receipt_id from reset_fixture;
select public.register_installation(repeat('e',64),null,repeat('e',64));
insert into private.account_sessions(account_id,session_id,installation_id,started_at,last_active_at)
select '41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001',id,now(),now() from public.installations where device_fingerprint_hash=repeat('e',64);
insert into private.account_sessions(account_id,session_id,installation_id,started_at,last_active_at)
select '41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000002',installation_id,now(),now() from reset_fixture;
select is((select accepted_choice from pg_temp.reset_receipt(
 'reset-replacement-credential-bbbbbbbbbbbbbbbbbbbbbbbbbbbb','41000000-0000-4000-8000-000000000002',repeat('d',64),(select question_id from reset_fixture))),null::text,
 'another account on this used device sees no previous-account answer');
select results_eq($$select r.* from reset_fixture f,lateral pg_temp.reset_receipt(repeat('e',64),
 '41000000-0000-4000-8000-000000000001',repeat('e',64),f.question_id) r$$,
 $$select receipt_id,'YES'::text,accepted_at from reset_fixture$$,'current verified account restores canonical history on its new device');
select is((select count(*)::integer from reset_fixture f,lateral pg_temp.reset_receipt(repeat('f',64),
 '41000000-0000-4000-8000-000000000002',repeat('f',64),f.question_id) r),0,'unrelated account and unknown device see no receipt');
select is((select count(*)::integer from public.installations where device_fingerprint_hash=repeat('f',64)),0,'receipt reads never register another device');
select * from finish();
rollback;
