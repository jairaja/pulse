begin;
select plan(36);
create function pg_temp.complete_verified(a uuid,s uuid,c uuid,k text,d text,i boolean) returns jsonb language plpgsql as $$ begin
 if not exists(select 1 from private.auth_ceremonies where id=c and verified_session=s) then
  perform public.authorize_account_otp(c,(select email_hash from private.auth_ceremonies where id=c),d);
  perform public.bind_account_otp(a,s,c,d);
 end if;
 return public.complete_account_auth(a,s,c,k,d,i);
end $$;
create function pg_temp.claims(p_user uuid,p_session uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'session_id',p_session,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',p_user::text,true);
end $$;
insert into public.questions(id,question_text,asked_on,status) values('24000000-0000-4000-8000-000000000001','Should parks be greener?',(clock_timestamp() at time zone 'utc')::date,'live');
select public.register_installation(repeat('a',64),null,repeat('1',64));
select is((select status from public.submit_vote(repeat('a',64),null,'24000000-0000-4000-8000-000000000001','YES','24000000-0000-4000-8000-000000000099',null)),'ACCEPTED','Guest may cast daily vote');
select public.begin_account_auth('24000000-0000-4000-8000-000000000010',encode(extensions.digest(convert_to('a@example.test','utf8'),'sha256'),'hex'),repeat('a',64),repeat('1',64));
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('24000000-0000-4000-8000-000000000101','a@example.test',now(),'{"pulse_signup_ceremony":"24000000-0000-4000-8000-000000000010"}');
-- Resending a code before first completion retains the original-device signup entitlement.
select public.begin_account_auth('24000000-0000-4000-8000-000000000011',encode(extensions.digest(convert_to('a@example.test','utf8'),'sha256'),'hex'),repeat('a',64),repeat('1',64));
select throws_ok($$select public.complete_account_auth('24000000-0000-4000-8000-000000000101','24000000-0000-4000-8000-000000000201','24000000-0000-4000-8000-000000000011',repeat('a',64),repeat('1',64),true)$$,'42501','Invalid sign-in ceremony.','An existing bearer cannot activate a new ceremony without that ceremony’s verified OTP');
select is((pg_temp.complete_verified('24000000-0000-4000-8000-000000000101','24000000-0000-4000-8000-000000000201','24000000-0000-4000-8000-000000000011',repeat('a',64),repeat('1',64),true)->>'imported')::integer,1,'Creation on origin device imports earlier unowned history with consent, including OTP resend');
select is((select count(*)::integer from private.account_vote_history where account_id='24000000-0000-4000-8000-000000000101'),1,'One canonical answer after import');
select is((select account_id from public.installations where device_fingerprint_hash=repeat('1',64)),null::uuid,'Device recognition does not bind permanent ownership');
select pg_temp.claims('24000000-0000-4000-8000-000000000101','24000000-0000-4000-8000-000000000201');
select ok(public.session_status(),'Activated session is current');
select is((pg_temp.complete_verified('24000000-0000-4000-8000-000000000101','24000000-0000-4000-8000-000000000201','24000000-0000-4000-8000-000000000011',repeat('a',64),repeat('1',64),true)->>'imported')::integer,0,'Lost response retry cannot import twice');
select ok(not has_function_privilege('authenticated','public.claim_installation_history(text)','EXECUTE'),'Old automatic claim path is closed');
select public.end_account_session('24000000-0000-4000-8000-000000000101','24000000-0000-4000-8000-000000000201');
select ok(not public.session_status(),'Logout revokes server lease immediately');
select is((select accepted_choice from public.get_device_vote_receipt(repeat('a',64),null,repeat('1',64),'24000000-0000-4000-8000-000000000001',null)),null::text,'A reset guest cannot see the former account answer');
select is((select status from public.submit_vote(repeat('a',64),null,'24000000-0000-4000-8000-000000000001','NO','24000000-0000-4000-8000-000000000098',null)),'ALREADY_VOTED','Logout does not reset device daily vote');
select is((select count(*)::integer from public.votes),1,'Duplicate did not add a row');

-- Another current day question is a test fixture to exercise new guest ownership without changing the wall clock.
update public.questions set status='disabled' where id='24000000-0000-4000-8000-000000000001';
insert into public.questions(id,question_text,asked_on,status) values('24000000-0000-4000-8000-000000000002','Should libraries open later?',(clock_timestamp() at time zone 'utc')::date,'live');
select public.submit_vote(repeat('a',64),null,'24000000-0000-4000-8000-000000000002','NO','24000000-0000-4000-8000-000000000097',null);
select is((select account_id from public.votes where question_id='24000000-0000-4000-8000-000000000002'),null::uuid,'New guest vote after logout has no previous-account owner');
select is((select count(*)::integer from private.account_vote_history where account_id='24000000-0000-4000-8000-000000000101'),1,'Guest vote did not enter previous account history');
select public.begin_account_auth('24000000-0000-4000-8000-000000000012',encode(extensions.digest(convert_to('a@example.test','utf8'),'sha256'),'hex'),repeat('a',64),repeat('1',64));
select is((pg_temp.complete_verified('24000000-0000-4000-8000-000000000101','24000000-0000-4000-8000-000000000202','24000000-0000-4000-8000-000000000012',repeat('a',64),repeat('1',64),true)->>'imported')::integer,0,'Existing-account login ignores checked import box');
select is((select count(*)::integer from private.account_vote_history where account_id='24000000-0000-4000-8000-000000000101'),1,'Existing login restored account history only');
select pg_temp.claims('24000000-0000-4000-8000-000000000101','24000000-0000-4000-8000-000000000202');
select is((public.my_pulse_activity()->'stats'->>'answers')::integer,1,'My Pulse reports canonical account history');
select public.begin_account_auth('24000000-0000-4000-8000-000000000013',encode(extensions.digest(convert_to('a@example.test','utf8'),'sha256'),'hex'),repeat('b',64),repeat('2',64));
select pg_temp.complete_verified('24000000-0000-4000-8000-000000000101','24000000-0000-4000-8000-000000000203','24000000-0000-4000-8000-000000000013',repeat('b',64),repeat('2',64),true);
select ok(not public.session_status(),'New-device login invalidates old JWT session');
select set_config('request.path','/rpc/my_pulse_activity',true);
select throws_ok($$select public.check_account_lease()$$,'42501','SESSION_REPLACED','REST guard rejects an old session before RPC execution');
select set_config('request.path','/rpc/session_status',true);
select lives_ok($$select public.check_account_lease()$$,'Status endpoint can tell old clients to reset');
select throws_ok($$select private.assert_current_session()$$,'42501','SESSION_REPLACED','Old session cannot authorize private operations');
select public.end_account_session('24000000-0000-4000-8000-000000000101','24000000-0000-4000-8000-000000000202');
select pg_temp.claims('24000000-0000-4000-8000-000000000101','24000000-0000-4000-8000-000000000203');
select ok(public.session_status(),'Delayed old logout cannot revoke new session');
select throws_ok($$select public.complete_account_auth('24000000-0000-4000-8000-000000000101','24000000-0000-4000-8000-000000000202','24000000-0000-4000-8000-000000000012',repeat('a',64),repeat('1',64),true)$$,'42501','Sign in again with a new email code.','Old completed session cannot reclaim lease');
select lives_ok($$select public.ensure_user_preferences('24000000-0000-4000-8000-000000000101','ur','dark','{"brewingView":"grid","largerText":true}')$$,'Account preferences include grid and accessibility');
select is(public.update_user_preferences('24000000-0000-4000-8000-000000000101',null,null,'{"highContrast":true}')->>'brewingView','grid','Field patch preserves independent view choice');
select throws_ok($$select public.update_user_preferences('24000000-0000-4000-8000-000000000101',null,null,'{"largerText":"yes"}')$$,'22023','Unsupported preference.','Preference options validate types');

select public.begin_account_auth('24000000-0000-4000-8000-000000000014',encode(extensions.digest(convert_to('c@example.test','utf8'),'sha256'),'hex'),repeat('c',64),repeat('3',64));
select public.register_installation(repeat('c',64),null,repeat('3',64));
select public.submit_vote(repeat('c',64),null,'24000000-0000-4000-8000-000000000002','YES','24000000-0000-4000-8000-000000000096',null);
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('24000000-0000-4000-8000-000000000102','c@example.test',now(),'{"pulse_signup_ceremony":"24000000-0000-4000-8000-000000000014"}');
select pg_temp.complete_verified('24000000-0000-4000-8000-000000000102','24000000-0000-4000-8000-000000000204','24000000-0000-4000-8000-000000000014',repeat('c',64),repeat('3',64),false);
select is((select count(*)::integer from private.account_vote_history where account_id='24000000-0000-4000-8000-000000000102'),0,'Declining import leaves account history empty');
select ok((select consumed from private.signup_import_entitlements where account_id='24000000-0000-4000-8000-000000000102'),'Decline permanently seals signup entitlement');
select ok(not has_function_privilege('authenticated','public.upvote_brewing_question(uuid)','EXECUTE'),'Old direct upvote cannot bypass gateway');
select ok(not has_function_privilege('authenticated','public.submit_brewing_question(text)','EXECUTE'),'Old direct submission cannot bypass moderation');
select is(public.resolve_public_question('24000000-0000-4000-8000-000000000002')->>'destination','today','Public link resolves live occurrence');
select is(public.resolve_public_question('24000000-0000-4000-8000-000000000001'),null::jsonb,'Disabled daily question is not public');
select ok(not has_table_privilege('anon','private.account_devices','SELECT'),'Guest cannot inspect account/device graph');
select ok(not has_table_privilege('authenticated','private.auth_ceremonies','SELECT'),'Member cannot enumerate signup ceremonies');
select is((select count(*)::integer from private.account_devices where account_id='24000000-0000-4000-8000-000000000101'),2,'Account-device associations are separate many-to-many evidence');
select is(jsonb_array_length(public.public_question_summaries(array['24000000-0000-4000-8000-000000000001'::uuid,'24000000-0000-4000-8000-000000000002'::uuid])),1,'Guest history batch lookup exposes only public question summaries');
select * from finish();
rollback;
