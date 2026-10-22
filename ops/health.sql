-- Run with a dedicated SELECT-only login. No identities or vote choices leave the database.
select
  (select count(*)::int from public.questions where status = 'live'
    and asked_on = (now() at time zone 'utc')::date) as current_live_questions,
  (select count(*)::int from public.questions where status = 'live'
    and asked_on < (now() at time zone 'utc')::date) as overdue_questions,
  (select private.get_open_community_count()) as open_community_questions,
  extract(hour from now() at time zone 'utc')::int as utc_hour,
  extract(minute from now() at time zone 'utc')::int as utc_minute,
  (select voting_enabled from private.runtime_controls where singleton) as voting_enabled,
  (select count(*)::int from cron.job where jobname = 'pulse-daily-finalization'
    and active and schedule = '0 0 * * *') as finalizer_jobs,
  (select status from cron.job_run_details d join cron.job j using (jobid)
    where j.jobname = 'pulse-daily-finalization' order by d.start_time desc limit 1) as finalizer_status,
  (select extract(epoch from now() - max(d.start_time))::int
    from cron.job_run_details d join cron.job j using (jobid)
    where j.jobname = 'pulse-daily-finalization' and d.status = 'succeeded') as finalizer_age_seconds;
