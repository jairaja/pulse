begin;
select no_plan();
\ir ../helpers/session-fixtures.sql
insert into auth.users(id, email_confirmed_at) values
 ('51000000-0000-4000-8000-000000000001', now()),
 ('51000000-0000-4000-8000-000000000002', now()),
 ('51000000-0000-4000-8000-000000000003', now()),
 ('51000000-0000-4000-8000-000000000004', null);
select pg_temp.enroll_sessions();
create temporary table community_fixture(name text primary key, id uuid);
grant select, insert on community_fixture to authenticated;
grant select on community_fixture to anon;

select ok(not has_table_privilege('authenticated', 'public.question_submissions', 'INSERT'), 'clients cannot bypass submission RPC');
select ok(not has_table_privilege('authenticated', 'public.submission_votes', 'INSERT'), 'clients cannot bypass upvote RPC');
select ok(not has_table_privilege('anon', 'public.question_submissions', 'SELECT'), 'authors are not exposed by direct table reads');
set local role anon;
select throws_ok($$select public.submit_brewing_question('A guest question?')$$, '42501', null, 'guests cannot submit');
select throws_ok($$select public.upvote_brewing_question(gen_random_uuid())$$, '42501', null, 'guests cannot upvote');
reset role;

do $$ begin perform pg_temp.test_user('51000000-0000-4000-8000-000000000001'); end $$;
set local role authenticated;
insert into community_fixture values('a', pg_temp.gateway_submit_published_fixture('Should schools begin later?'));
select is(pg_temp.gateway_submit_published_fixture('Should schools begin later?'), (select id from community_fixture where name='a'), 'same submission retry is idempotent');
select throws_ok($$select pg_temp.gateway_submit_published_fixture('Should cities plant more trees?')$$, 'P0001', null, 'second distinct submission is rejected');
select throws_ok($$select pg_temp.gateway_upvote(id) from community_fixture where name='a'$$, 'P0001', 'You cannot upvote your own question.', 'self-upvote is rejected server-side');
select is((public.get_brewing_allowance()->>'submitted_question_id')::uuid, (select id from community_fixture where name='a'), 'daily allowance reports existing submission');
select ok(public.get_brewing_allowance()->>'upvoted_question_id' is null, 'failed self-upvote does not consume upvote');
select is((select count(*)::integer from public.list_brewing_submissions() where is_own), 1, 'feed marks own submission without exposing author ID');
reset role;

do $$ begin perform pg_temp.test_user('51000000-0000-4000-8000-000000000003'); end $$;
set local role authenticated;
insert into community_fixture values('c', pg_temp.gateway_submit_published_fixture('Should communities share more public spaces?'));
reset role;

do $$ begin perform pg_temp.test_user('51000000-0000-4000-8000-000000000002'); end $$;
set local role authenticated;
select lives_ok($$select pg_temp.gateway_upvote(id) from community_fixture where name='a'$$, 'another account can upvote');
select lives_ok($$select pg_temp.gateway_upvote(id) from community_fixture where name='a'$$, 'retrying the same upvote is idempotent');
select throws_ok($$select pg_temp.gateway_upvote(id) from community_fixture where name='c'$$, 'P0001', null, 'one total upvote per day across all questions');
select is((select upvote_count from public.list_brewing_submissions() where id=(select id from community_fixture where name='a')), 1::bigint, 'retry did not create another upvote');
select is((public.get_brewing_allowance()->>'upvoted_question_id')::uuid, (select id from community_fixture where name='a'), 'allowance persists independent of local storage');
select is((public.get_brewing_allowance()->>'resets_at')::timestamptz, (((now() at time zone 'utc')::date+1)::timestamp at time zone 'utc'), 'allowances reset at next UTC midnight');
set local timezone = 'Pacific/Kiritimati';
select throws_ok($$select pg_temp.gateway_upvote(id) from community_fixture where name='c'$$, 'P0001', null, 'changing timezone cannot reset daily allowance');
set local timezone = 'UTC';
reset role;

do $$ begin perform pg_temp.test_user('51000000-0000-4000-8000-000000000004'); end $$;
set local role authenticated;
select throws_ok($$select pg_temp.gateway_submit_published_fixture('An unverified account question?')$$, '42501', 'SESSION_REPLACED', 'unverified account cannot submit');
select throws_ok($$select pg_temp.gateway_upvote(id) from community_fixture where name='a'$$, '42501', 'SESSION_REPLACED', 'unverified account cannot upvote');
reset role;

-- Simulate previous-day ledger entries; clients have no permission to perform these updates.
update public.submission_votes set voted_on = voted_on - 1 where voter_id='51000000-0000-4000-8000-000000000002';
update private.account_upvote_allowance set voted_on=voted_on-1;
update private.device_upvote_allowance set voted_on=voted_on-1;
update public.question_submissions set submitted_on = submitted_on - 1 where author_id='51000000-0000-4000-8000-000000000001';
do $$ begin perform pg_temp.test_user('51000000-0000-4000-8000-000000000002'); end $$;
set local role authenticated;
select lives_ok($$select pg_temp.gateway_upvote(id) from community_fixture where name='c'$$, 'new UTC day permits another upvote');
reset role;
do $$ begin perform pg_temp.test_user('51000000-0000-4000-8000-000000000001'); end $$;
set local role authenticated;
select lives_ok($$select pg_temp.gateway_submit_published_fixture('Should neighbourhoods have more parks?')$$, 'new UTC day permits another submission');
select throws_ok($$select pg_temp.gateway_submit_published_fixture('')$$, 'P0001', null, 'empty questions are rejected');
reset role;
update public.question_submissions set status='hidden' where id=(select id from community_fixture where name='a');
set local role anon;
select is((select count(*)::integer from public.list_brewing_submissions() where id=(select id from community_fixture where name='a')), 0, 'hidden content does not appear in public feed');
reset role;
select * from finish();
rollback;
