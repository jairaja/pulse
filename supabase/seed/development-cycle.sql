-- DEVELOPMENT ONLY. Use an existing VERIFIED development account; do not invent auth users.
-- In the same SQL Editor run, first set your chosen account UUID, for example:
-- select set_config('pulse.seed_author','<VERIFIED-DEV-AUTH-USER-UUID>',false);
-- No future daily question is scheduled and no artificial upvotes are inserted.
do $$
declare v_author uuid := nullif(current_setting('pulse.seed_author',true),'')::uuid;
begin
  if v_author is null or not exists(select 1 from auth.users where id=v_author and email_confirmed_at is not null) then
    raise exception 'Set pulse.seed_author to an existing verified development account UUID first.';
  end if;
  -- Historical fixtures only; actual new daily questions are always chosen from Brewing.
  insert into public.questions(question_text,source_language,asked_on,status) values
    ('Should public libraries stay open later?','en',(now() at time zone 'utc')::date-2,'live'),
    ('Should schools teach practical financial skills?','en',(now() at time zone 'utc')::date-1,'live')
  on conflict(asked_on) where status in ('live','archived') do nothing;
  insert into public.question_submissions(author_id,question_text,submitted_on,created_at) values
    (v_author,'Should cities provide more shaded public spaces?',(now() at time zone 'utc')::date-1,
      (((now() at time zone 'utc')::date-1)::timestamp at time zone 'utc')+interval '1 hour'),
    (v_author,'Should employers offer a four-day working week?',(now() at time zone 'utc')::date,clock_timestamp())
  on conflict(author_id,submitted_on) do nothing;
  perform private.finalize_daily_pulse(clock_timestamp());
end;
$$;
select asked_on,status,question_text from public.questions where status in ('live','archived')
  and asked_on between (now() at time zone 'utc')::date-2 and (now() at time zone 'utc')::date order by asked_on;
select question_text,created_at,status from public.question_submissions order by created_at desc;
