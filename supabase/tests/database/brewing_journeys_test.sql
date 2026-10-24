begin;
select plan(22);
-- Service gateway fixture: both accounts have valid sessions on the same recognized device.
insert into auth.users(id,email,email_confirmed_at) values
 ('25000000-0000-4000-8000-000000000101','up-a@example.test',now()),
 ('25000000-0000-4000-8000-000000000102','up-b@example.test',now());
select public.register_installation(repeat('u',64),null,repeat('4',64));
insert into private.account_sessions(account_id,session_id,installation_id,started_at,last_active_at)
select u.id,case when u.id='25000000-0000-4000-8000-000000000101' then '25000000-0000-4000-8000-000000000201'::uuid else '25000000-0000-4000-8000-000000000202'::uuid end,i.id,now(),now()
from auth.users u cross join public.installations i where u.id in ('25000000-0000-4000-8000-000000000101','25000000-0000-4000-8000-000000000102') and i.device_fingerprint_hash=repeat('4',64);
insert into public.questions(question_text,asked_on,status) values('Keep existing question live?',(now() at time zone 'utc')::date,'live');
insert into public.question_submissions(id,author_id,question_text,submitted_on,created_at,status,published_at) values
 ('25000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000101','Should parks be greener?',(now() at time zone 'utc')::date-2,now()-interval '2 days','open',now()-interval '2 days'),
 ('25000000-0000-4000-8000-000000000002','25000000-0000-4000-8000-000000000102','Should libraries open later?',(now() at time zone 'utc')::date-2,now()-interval '2 days','open',now()-interval '2 days');
select throws_ok($$select public.accept_brewing_upvote('25000000-0000-4000-8000-000000000101','25000000-0000-4000-8000-000000000201',repeat('u',64),repeat('4',64),'25000000-0000-4000-8000-000000000001')$$,'P0001','You cannot upvote your own question.','Self-upvote rejected on server');
select is(public.accept_brewing_upvote('25000000-0000-4000-8000-000000000101','25000000-0000-4000-8000-000000000201',repeat('u',64),repeat('4',64),'25000000-0000-4000-8000-000000000002')->>'status','ACCEPTED','First support accepted');
select is(public.accept_brewing_upvote('25000000-0000-4000-8000-000000000101','25000000-0000-4000-8000-000000000201',repeat('u',64),repeat('4',64),'25000000-0000-4000-8000-000000000002')->>'status','ALREADY_UPVOTED','Lost response retry is idempotent');
select throws_ok($$select public.accept_brewing_upvote('25000000-0000-4000-8000-000000000102','25000000-0000-4000-8000-000000000202',repeat('u',64),repeat('4',64),'25000000-0000-4000-8000-000000000001')$$,'P0001','This device already used its upvote today. Try again at 00:00 UTC.','Switching account on same phone does not reset quota');
select is((public.get_brewing_device_allowance('25000000-0000-4000-8000-000000000102','25000000-0000-4000-8000-000000000202',repeat('u',64),repeat('4',64))->>'device_used')::boolean,true,'UI gets authoritative device-used reason');
-- Date fixture models a prior-day event; existing rollover suites separately exercise the UTC boundary.
update public.submission_votes set voted_on=voted_on-1,created_at=created_at-interval '1 day';
update private.account_upvote_allowance set voted_on=voted_on-1;
update private.device_upvote_allowance set voted_on=voted_on-1;
select is(public.accept_brewing_upvote('25000000-0000-4000-8000-000000000101','25000000-0000-4000-8000-000000000201',repeat('u',64),repeat('4',64),'25000000-0000-4000-8000-000000000002')->>'status','ACCEPTED','Same account can support same open question on another UTC day');
select is((select count(*)::integer from public.submission_votes where submission_id='25000000-0000-4000-8000-000000000002'),2,'Counts accumulate support events across days');
select throws_ok($$select public.accept_brewing_upvote('25000000-0000-4000-8000-000000000101','25000000-0000-4000-8000-000000000299',repeat('u',64),repeat('4',64),'25000000-0000-4000-8000-000000000002')$$,'42501','SESSION_REPLACED','Forged session rejected even with valid device');
select public.accept_brewing_submission('25000000-0000-4000-8000-000000000101','25000000-0000-4000-8000-000000000201',repeat('u',64),repeat('4',64),'开心吗？','25000000-0000-4000-8000-000000000301');
select throws_ok($$select public.accept_brewing_submission('25000000-0000-4000-8000-000000000101','25000000-0000-4000-8000-000000000201',repeat('u',64),repeat('4',64),'A substituted question?','25000000-0000-4000-8000-000000000301')$$,'P0001','This submission request conflicts with an earlier request.','A submission request ID cannot silently accept different text');
select is((select status from public.question_submissions where intake_request='25000000-0000-4000-8000-000000000301'),'pending','Intake stays private until reviewed; short non-English text accepted');
select is(public.resolve_public_question((select id from public.question_submissions where intake_request='25000000-0000-4000-8000-000000000301'),'submission'),null::jsonb,'Pending question cannot be shared publicly');
select is(jsonb_array_length(public.search_public_questions('开心')),0,'Search excludes pending content');
select set_config('request.jwt.claims','{"sub":"25000000-0000-4000-8000-000000000101","session_id":"25000000-0000-4000-8000-000000000201","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','25000000-0000-4000-8000-000000000101',true);
select throws_ok($$select public.review_brewing_submission((select id from public.question_submissions where intake_request='25000000-0000-4000-8000-000000000301'),1,true,'Looks appropriate.')$$,'42501','Moderator access is required.','Member cannot publish own pending question');
insert into private.community_roles(user_id,role) values('25000000-0000-4000-8000-000000000101','moderator');
select lives_ok($$select public.review_brewing_submission((select id from public.question_submissions where intake_request='25000000-0000-4000-8000-000000000301'),1,true,'Clear neutral question.')$$,'Moderator can publish with recorded reason');
select is(jsonb_array_length(public.search_public_questions('开心')),1,'Indexed public search finds Chinese substring after publication');
select is(public.resolve_public_question((select id from public.question_submissions where intake_request='25000000-0000-4000-8000-000000000301'),'submission')->>'destination','brewing','Published occurrence resolves to Brewing');
select is((select count(*)::integer from private.submission_reviews),1,'Review audit written');
select throws_ok($$select public.accept_brewing_submission('25000000-0000-4000-8000-000000000102','25000000-0000-4000-8000-000000000202',repeat('u',64),repeat('4',64),'开心吗？','25000000-0000-4000-8000-000000000302')$$,'P0001','This question is already in Brewing.','Exact active duplicate rejected transactionally');
select throws_ok($$select public.accept_brewing_submission('25000000-0000-4000-8000-000000000101','25000000-0000-4000-8000-000000000201',repeat('u',64),repeat('4',64),'A different question?','25000000-0000-4000-8000-000000000303')$$,'P0001','You already submitted a question today. Try again at 00:00 UTC.','Daily submission slot is reserved at intake');
delete from auth.users where id='25000000-0000-4000-8000-000000000102';
select ok((public.get_brewing_device_allowance('25000000-0000-4000-8000-000000000101','25000000-0000-4000-8000-000000000201',repeat('u',64),repeat('4',64))->>'device_used')::boolean,'Deleting a candidate author does not refund device allowance');
select throws_ok($$select public.accept_brewing_upvote('25000000-0000-4000-8000-000000000101','25000000-0000-4000-8000-000000000201',repeat('u',64),repeat('4',64),'25000000-0000-4000-8000-000000000099')$$,'P0001','You already used your upvote today. Try again at 00:00 UTC.','Deleting the supported candidate does not refund account allowance');
delete from auth.users where id='25000000-0000-4000-8000-000000000101';
select is((select count(*)::integer from private.device_upvote_allowance),1,'Deleting the voter does not refund device allowance');
select * from finish();
rollback;
