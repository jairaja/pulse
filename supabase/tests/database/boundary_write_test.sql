begin;
select no_plan();
insert into auth.users(id,email_confirmed_at) values
 ('7b000000-0000-4000-8000-000000000001',now()),
 ('7b000000-0000-4000-8000-000000000002',now()),
 ('7b000000-0000-4000-8000-000000000003',now());
insert into public.question_submissions(id,author_id,question_text,submitted_on,created_at) values
 ('7c000000-0000-4000-8000-000000000001','7b000000-0000-4000-8000-000000000001','Older remaining question?',current_date-2,(current_date-2)::timestamp at time zone 'utc'),
 ('7c000000-0000-4000-8000-000000000002','7b000000-0000-4000-8000-000000000001','Newer zero-tie community winner?',current_date-1,(current_date-1)::timestamp at time zone 'utc');
select set_config('request.jwt.claim.sub','7b000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select lives_ok($$select public.upvote_brewing_question('7c000000-0000-4000-8000-000000000001')$$,'first upvote after missed rollover repairs selection before writing');
reset role;
select is((select status from public.question_submissions where id='7c000000-0000-4000-8000-000000000002'),'selected','previous midnight winner is selected before new-day upvotes');
select is((select question_text from public.questions where asked_on=current_date and status='live'),'Newer zero-tie community winner?','new-day upvote cannot change the preceding boundary winner');
select set_config('request.jwt.claim.sub','7b000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select throws_ok($$select public.upvote_brewing_question('7c000000-0000-4000-8000-000000000002')$$,'22023','This question is not available for upvotes.','already-selected card cannot consume a new-day upvote');
select ok(public.get_brewing_allowance()->>'upvoted_question_id' is null,'rejected selected-card upvote leaves allowance unused');
reset role;
select * from finish();
rollback;
