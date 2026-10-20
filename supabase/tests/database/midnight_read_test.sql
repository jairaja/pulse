begin;
select no_plan();
insert into public.questions(question_text, asked_on, status) values
 ('Yesterday closes at midnight?', (now() at time zone 'utc')::date-1, 'live'),
 ('Today begins at midnight?', (now() at time zone 'utc')::date, 'scheduled')
on conflict(asked_on) do nothing;
select is((select schedule from cron.job where jobname='pulse-daily-finalization'), '0 0 * * *', 'daily job is at midnight, not noon');
set local role anon;
select is((select count(*)::integer from public.get_today_question('en')), 1, 'first public read catches up a missed rollover and returns today');
select is((select voting_closes_at from public.get_today_question('en')),
 (((now() at time zone 'utc')::date+1)::timestamp at time zone 'utc'), 'today closes exactly at tomorrow 00:00 UTC');
select ok((select server_time <= voting_closes_at from public.get_today_question('en')), 'server reports authoritative timing for the countdown');
select is((select count(*)::integer from public.list_finalized_results('en',20,null)
 where asked_on=(now() at time zone 'utc')::date-1), 1, 'yesterday results are readable without waiting for a noon job');
reset role;
select is((select status from public.questions where asked_on=(now() at time zone 'utc')::date-1), 'archived', 'old question is archived atomically');
select is((select status from public.questions where asked_on=(now() at time zone 'utc')::date), 'live', 'new question is activated atomically');
select is((select finalized_count from private.finalize_daily_pulse(now())), 0, 'catch-up remains idempotent');
select * from finish();
rollback;
