-- DEVELOPMENT ONLY. Run manually in the hosted DEVELOPMENT project's SQL Editor after migrations.
-- Adds missing dates without replacing existing questions, accepted votes, or finalized results.
-- Totals come from actual votes (zero for new fixtures); no fabricated vote totals are inserted.
-- Re-running is safe: question IDs are generated, asked_on is unique, and existing rows are preserved.
do $$
begin
  insert into public.questions(question_text, source_language, asked_on, status)
  values
    ('Should public libraries stay open later?', 'en', (now() at time zone 'utc')::date - 2, 'live'),
    ('Should schools teach practical financial skills?', 'en', (now() at time zone 'utc')::date - 1, 'live'),
    ('Should cities provide more shaded public spaces?', 'en', (now() at time zone 'utc')::date, 'live')
  on conflict (asked_on) do nothing;

  insert into public.questions(question_text, source_language, asked_on, status, preview_published)
  values ('Should employers offer a four-day working week?', 'en',
    (now() at time zone 'utc')::date + 1, 'scheduled', true)
  on conflict (asked_on) do update set preview_published = true
    where public.questions.status = 'scheduled';

  perform private.finalize_daily_pulse(now());
end;
$$;

-- Verify dates/status, then reload Today/Past Results/Brewing in the app.
select id, asked_on, status, preview_published, question_text
from public.questions
where asked_on between (now() at time zone 'utc')::date - 2 and (now() at time zone 'utc')::date + 1
order by asked_on;
