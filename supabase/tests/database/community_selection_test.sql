begin;
select no_plan();
-- Isolated fixtures inside this rolled-back transaction, never a hosted cleanup.
truncate public.questions, public.question_results, public.votes, public.question_submissions, public.submission_votes cascade;
insert into auth.users(id,email_confirmed_at) values
 ('62000000-0000-4000-8000-000000000001',now()),
 ('62000000-0000-4000-8000-000000000002',now()),
 ('62000000-0000-4000-8000-000000000003',now()),
 ('62000000-0000-4000-8000-000000000004',now());
insert into public.question_submissions(id,author_id,question_text,submitted_on,created_at,status) values
 ('63000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','Older highly supported question?',current_date-5,(current_date-5)::timestamp at time zone 'utc','open'),
 ('63000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000002','Newer equally supported question?',current_date-2,(current_date-2)::timestamp at time zone 'utc','open'),
 ('63000000-0000-4000-8000-000000000003','62000000-0000-4000-8000-000000000003','Hidden question with more votes?',current_date-1,(current_date-1)::timestamp at time zone 'utc','hidden'),
 ('63000000-0000-4000-8000-000000000004','62000000-0000-4000-8000-000000000004','Just submitted today is not eligible?',current_date,current_date::timestamp at time zone 'utc','open');
insert into public.submission_votes(voter_id,submission_id,voted_on,created_at) values
 ('62000000-0000-4000-8000-000000000003','63000000-0000-4000-8000-000000000001',current_date-3,(current_date-3)::timestamp at time zone 'utc'),
 ('62000000-0000-4000-8000-000000000004','63000000-0000-4000-8000-000000000002',current_date-1,(current_date-1)::timestamp at time zone 'utc'),
 ('62000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000003',current_date-2,(current_date-2)::timestamp at time zone 'utc'),
 ('62000000-0000-4000-8000-000000000002','63000000-0000-4000-8000-000000000003',current_date-1,(current_date-1)::timestamp at time zone 'utc'),
 ('62000000-0000-4000-8000-000000000002','63000000-0000-4000-8000-000000000001',current_date,current_date::timestamp at time zone 'utc');
select is((select count(*)::integer from public.list_brewing_submissions()),3,'all open questions remain browsable across days');
select private.ensure_daily_rollover(clock_timestamp());
select is((select question_text from public.questions where asked_on=current_date),'Newer equally supported question?','accumulated pre-midnight tie prefers newer submission; today upvote is excluded');
select is((select status from public.questions where asked_on=current_date),'live','catch-up selects and opens current day only');
select is((select status from public.question_submissions where id='63000000-0000-4000-8000-000000000002'),'selected','selected submission leaves open queue');
select ok((select selected_question_id from public.question_submissions where id='63000000-0000-4000-8000-000000000002')=(select id from public.questions where asked_on=current_date),'selection has durable provenance');
select private.ensure_daily_rollover(clock_timestamp());
select is((select count(*)::integer from public.questions),1,'repeated read does not choose another winner');
select is((select count(*)::integer from public.questions where asked_on>current_date),0,'future question is never opened or manufactured');
select ok(exists(select 1 from public.list_brewing_submissions() where id='63000000-0000-4000-8000-000000000001'),'losing old question remains eligible');
select is((select count(*)::integer from public.list_brewing_submissions(20,'63000000-0000-4000-8000-000000000002')),1,'selected cursor remains usable for pagination');
insert into public.questions(question_text,asked_on,status) values('Administrator scheduled question?',current_date+1,'scheduled');
select * from private.finalize_daily_pulse((current_date+1)::timestamp at time zone 'utc');
select is((select question_text from public.questions where asked_on=current_date+1),'Administrator scheduled question?','administrator schedule takes priority');
select is((select status from public.question_submissions where id='63000000-0000-4000-8000-000000000001'),'open','manual schedule consumes no community candidate');
select * from private.finalize_daily_pulse((current_date+2)::timestamp at time zone 'utc');
select is((select question_text from public.questions where asked_on=current_date+2),'Older highly supported question?','older accumulated votes survive day changes and outrank zero votes');
select is((select count(*)::integer from public.question_results),2,'both closed days receive final immutable results');
select * from private.finalize_daily_pulse((current_date+2)::timestamp at time zone 'utc');
select is((select count(*)::integer from public.questions where asked_on=current_date+2),1,'repeated cron is idempotent');
select * from finish();
rollback;
