begin;
select no_plan();
insert into public.questions(question_text,asked_on,status) values('Current live fixture?',current_date,'live') on conflict do nothing;
insert into auth.users(id,email_confirmed_at) values
 ('76000000-0000-4000-8000-000000000001',now()),
 ('76000000-0000-4000-8000-000000000002',now()),
 ('76000000-0000-4000-8000-000000000003',now());
insert into public.question_submissions(id,author_id,question_text,submitted_on,created_at,status) values
 ('77000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','Old popular question?',current_date-5,(current_date-5)::timestamp at time zone 'utc','open'),
 ('77000000-0000-4000-8000-000000000002','76000000-0000-4000-8000-000000000002','Newer popular question?',current_date-1,(current_date-1)::timestamp at time zone 'utc','open'),
 ('77000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000001','Submitted today question?',current_date,clock_timestamp(),'open'),
 ('77000000-0000-4000-8000-000000000004','76000000-0000-4000-8000-000000000003','Newest today question?',current_date,clock_timestamp()+interval '1 microsecond','open'),
 ('77000000-0000-4000-8000-000000000005','76000000-0000-4000-8000-000000000003','Hidden today question?',current_date-2,(current_date-2)::timestamp at time zone 'utc','hidden');
insert into public.submission_votes(voter_id,submission_id,voted_on,created_at) values
 ('76000000-0000-4000-8000-000000000003','77000000-0000-4000-8000-000000000001',current_date-2,(current_date-2)::timestamp at time zone 'utc'),
 ('76000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000002',current_date-1,(current_date-1)::timestamp at time zone 'utc');
create temporary table feed_page(name text primary key,payload jsonb);
grant select,insert on feed_page to anon,authenticated;
set local role anon;
select is(jsonb_array_length(public.browse_brewing_questions()->'items'),4,'guests browse all open questions');
select is(public.browse_brewing_questions()->'items'->0->>'id','77000000-0000-4000-8000-000000000002','most upvoted ranks globally, then newer timestamp');
select is(public.browse_brewing_questions('newest')->'items'->0->>'id','77000000-0000-4000-8000-000000000004','newest sort orders by submission time');
select is(public.browse_brewing_questions('oldest')->'items'->0->>'id','77000000-0000-4000-8000-000000000001','oldest sort orders across all questions');
select is(jsonb_array_length(public.browse_brewing_questions('newest','today')->'items'),2,'today filter uses UTC submission date');
select throws_ok($$select public.browse_brewing_questions('most_upvoted','mine')$$,'42501','Sign in to use this filter.','guest cannot request account-specific filter');
select throws_ok($$select public.browse_brewing_questions('random','all')$$,'22023','Invalid question filters.','invalid sort is rejected');
insert into feed_page values('first',public.browse_brewing_questions('most_upvoted','all',1));
select is(jsonb_array_length((select payload->'items' from feed_page where name='first')),1,'page limit enforced');
select ok((select payload->'next_cursor' from feed_page where name='first')<>'null'::jsonb,'cursor supplied when more rows exist');
select ok(not (public.browse_brewing_questions()->'items'->0 ? 'author_id'),'public cards never expose author IDs');
reset role;
-- Write after the fixed snapshot. It must not change rank while paging that snapshot.
insert into public.submission_votes(voter_id,submission_id,voted_on,created_at) values
 ('76000000-0000-4000-8000-000000000002','77000000-0000-4000-8000-000000000001',current_date,clock_timestamp());
update public.question_submissions set status='hidden' where id='77000000-0000-4000-8000-000000000002';
set local role anon;
insert into feed_page values('second',public.browse_brewing_questions('most_upvoted','all',1,(select payload->'next_cursor' from feed_page where name='first')));
select is((select payload->'items'->0->>'id' from feed_page where name='second'),'77000000-0000-4000-8000-000000000001','hidden cursor card does not break subsequent pages');
select is((select payload->'items'->0->>'upvote_count' from feed_page where name='second'),'1','new votes do not reorder an existing snapshot');
select is(public.browse_brewing_questions()->'items'->0->>'upvote_count','2','refresh sees newly committed upvote');
select throws_ok($$select public.browse_brewing_questions('newest','all',1,(select payload->'next_cursor' from feed_page where name='first'))$$,'22023','Refresh the question list to continue.','cursor cannot be reused across sorts');
select throws_ok($$select public.browse_brewing_questions('most_upvoted','all',1,jsonb_set((select payload->'next_cursor' from feed_page where name='first'),'{as_of}',to_jsonb((now()-interval '11 minutes')::text)))$$,'22023','Refresh the question list to continue.','expired cursor requires a fresh list');
reset role;
select set_config('request.jwt.claim.sub','76000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(jsonb_array_length(public.browse_brewing_questions('newest','mine')->'items'),2,'mine filter returns only own open questions');
select is(jsonb_array_length(public.browse_brewing_questions('newest','others')->'items'),1,'others filter excludes own and hidden questions');
select is(public.browse_brewing_questions('newest','mine')->'items'->0->>'is_own','true','ownership drives self-upvote disabling');
select throws_ok($$select public.browse_brewing_questions('most_upvoted','all',1,(select payload->'next_cursor' from feed_page where name='first'))$$,'22023','Refresh the question list to continue.','guest cursor cannot leak into signed-in filter scope');
set local timezone='Pacific/Kiritimati';
select is(jsonb_array_length(public.browse_brewing_questions('newest','today')->'items'),2,'device/database timezone cannot change today filter');
reset role;
select * from finish();
rollback;
