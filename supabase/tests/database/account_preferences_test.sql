begin;
select no_plan();
\ir ../helpers/session-fixtures.sql
insert into auth.users(id,email_confirmed_at) values
 ('61000000-0000-4000-8000-000000000001',now()),
 ('61000000-0000-4000-8000-000000000002',now());
select pg_temp.enroll_sessions();
select ok(not has_table_privilege('anon','public.user_preferences','SELECT'), 'guests cannot read account preferences');
select ok(not has_table_privilege('authenticated','public.user_preferences','UPDATE'), 'clients cannot write another user through direct table access');
select ok((select relrowsecurity from pg_class where oid='public.user_preferences'::regclass), 'preferences have RLS');
set local role anon;
select throws_ok($$select public.ensure_user_preferences('61000000-0000-4000-8000-000000000001','en','system')$$,'42501',null,'guests cannot call preference RPC');
reset role;
select pg_temp.test_user('61000000-0000-4000-8000-000000000001');
set local role authenticated;
select is(public.ensure_user_preferences('61000000-0000-4000-8000-000000000001','ur','dark'),'{"language":"ur","theme":"dark"}'::jsonb,'first sign-in seeds device preferences');
select is(public.ensure_user_preferences('61000000-0000-4000-8000-000000000001','en','system'),'{"language":"ur","theme":"dark"}'::jsonb,'new device defaults never overwrite saved account settings');
select is(public.update_user_preferences('61000000-0000-4000-8000-000000000001','fr'),'{"language":"fr","theme":"dark"}'::jsonb,'language patch preserves theme');
select is(public.update_user_preferences('61000000-0000-4000-8000-000000000001',null,'light'),'{"language":"fr","theme":"light"}'::jsonb,'theme patch preserves language');
select throws_ok($$select public.update_user_preferences('61000000-0000-4000-8000-000000000002','ar','dark')$$,'42501','Preference account mismatch.','stale-account request cannot change newly signed-in account');
select throws_ok($$select public.ensure_user_preferences('61000000-0000-4000-8000-000000000002','ar','dark')$$,'42501',null,'cannot create another user preference row');
select throws_ok($$select public.update_user_preferences('61000000-0000-4000-8000-000000000001','xx','dark')$$,'22023','Unsupported preference.','unknown language rejected');
select throws_ok($$select public.update_user_preferences('61000000-0000-4000-8000-000000000001','en','auto')$$,'22023','Unsupported preference.','unknown theme rejected');
reset role;
select pg_temp.test_user('61000000-0000-4000-8000-000000000002');
set local role authenticated;
select is(public.ensure_user_preferences('61000000-0000-4000-8000-000000000002','ar','system'),'{"language":"ar","theme":"system"}'::jsonb,'second account stays independent');
reset role;
select is((select language from public.user_preferences where user_id='61000000-0000-4000-8000-000000000001'),'fr','first account was not changed by the second account');
select * from finish();
rollback;
