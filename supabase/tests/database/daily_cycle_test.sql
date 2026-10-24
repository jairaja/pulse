begin;
select no_plan();

select is((select schedule from cron.job where jobname = 'pulse-daily-finalization'), '0 0 * * *',
  'daily finalization is scheduled for 00:00 UTC with no noon trigger');

insert into public.questions(question_text, asked_on, status, preview_published)
values
  ('Daily cycle yesterday?', (now() at time zone 'utc')::date - 1, 'live', false),
  ('Daily cycle today?', (now() at time zone 'utc')::date, 'live', false),
  ('Daily cycle tomorrow?', (now() at time zone 'utc')::date + 1, 'scheduled', false),
  ('Private later draft?', (now() at time zone 'utc')::date + 2, 'scheduled', true)
on conflict do nothing;
update public.questions set preview_published = false
where asked_on = (now() at time zone 'utc')::date + 1;

select ok(has_function_privilege('anon', 'public.get_brewing_question(text)', 'EXECUTE'),
  'older clients retain an empty compatibility RPC');
set local role anon;
select is((select count(*)::integer from public.get_brewing_question('en')), 0,
  'unpublished tomorrow draft and later published draft are both hidden');
reset role;

update public.questions set preview_published = true
where asked_on = (now() at time zone 'utc')::date + 1;
set local role anon;
select is((select count(*)::integer from public.get_brewing_question('en')), 0,
  'even explicitly published legacy previews are never served');
select is((select count(*)::integer from public.questions where status = 'scheduled'), 0,
  'direct table access still hides scheduled drafts');
reset role;

create temporary table daily_first_run as select * from private.finalize_daily_pulse(now());
select is((select status from public.questions where asked_on = (now() at time zone 'utc')::date - 1), 'archived',
  'catch-up archives yesterday rather than leaving it invisible as an overdue live question');
select is((select count(*)::integer from public.question_results r join public.questions q on q.id = r.question_id
  where q.asked_on = (now() at time zone 'utc')::date - 1), 1,
  'catch-up creates exactly one finalized snapshot for yesterday');
select is((select total_votes from public.question_results r join public.questions q on q.id = r.question_id
  where q.asked_on = (now() at time zone 'utc')::date - 1),
  (select count(*) from public.votes v join public.questions q on q.id = v.question_id
   where q.asked_on = (now() at time zone 'utc')::date - 1),
  'finalized totals come from actual votes, not fabricated seed totals');
select is((select finalized_count from private.finalize_daily_pulse(now())), 0,
  'repeating catch-up does not finalize an already archived question again');

insert into auth.users(id,email_confirmed_at) values('71000000-0000-4000-8000-000000000001',now());
insert into public.question_submissions(author_id,question_text,submitted_on,created_at)
values('71000000-0000-4000-8000-000000000001','Community-selected daily question?',(now() at time zone 'utc')::date,clock_timestamp());
update public.question_submissions set published_at=created_at where status='open' and published_at is null;
create temporary table daily_rollover as
select * from private.finalize_daily_pulse(((now() at time zone 'utc')::date + 1)::timestamp at time zone 'utc');
select is((select status from public.questions where asked_on = (now() at time zone 'utc')::date + 1 and question_text='Community-selected daily question?'), 'live',
  'community winner becomes live only when its UTC day starts');
select is((select status from public.questions where asked_on = (now() at time zone 'utc')::date), 'archived',
  'the previous daily question is archived at rollover');
select is((select count(*)::integer from public.get_brewing_question('en')), 0,
  'the published preview disappears once it becomes live');
select is((select status from public.questions where asked_on = (now() at time zone 'utc')::date + 2), 'scheduled',
  'later drafts are not activated early');

select * from private.finalize_daily_pulse(((now() at time zone 'utc')::date + 2)::timestamp at time zone 'utc');
select is((select count(*)::integer from public.questions where asked_on=(now() at time zone 'utc')::date+2 and status='live'),0,'empty community queue never falls back to a scheduled administrator draft');
select * from finish();
rollback;
