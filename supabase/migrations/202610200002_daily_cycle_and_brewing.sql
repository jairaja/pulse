-- Midnight voting windows need prompt finalization/activation, including recovery after a missed run.
select cron.unschedule(jobid) from cron.job where jobname = 'pulse-daily-finalization';
select cron.schedule('pulse-daily-finalization', '* * * * *',
  $$select * from private.finalize_daily_pulse(now());$$);

-- Drafts stay private unless an administrator explicitly publishes tomorrow's preview.
alter table public.questions add column preview_published boolean not null default false;
comment on column public.questions.preview_published is
  'Explicit opt-in for tomorrow-only Brewing preview; does not open voting or expose other drafts.';

create function public.get_brewing_question(p_language_code text default 'en')
returns table (
  id uuid,
  question_text text,
  source_language text,
  asked_on date,
  sponsored boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, coalesce(t.translated_text, q.question_text), q.source_language, q.asked_on, q.sponsored
  from public.questions q
  left join public.question_translations t on t.question_id = q.id
    and t.language_code = nullif(btrim(p_language_code), '') and t.is_selected
  where q.status = 'scheduled' and q.preview_published
    and q.asked_on = (now() at time zone 'utc')::date + 1
  limit 1;
$$;
revoke all on function public.get_brewing_question(text) from public, anon, authenticated;
grant execute on function public.get_brewing_question(text) to anon, authenticated;
comment on function public.get_brewing_question(text) is
  'Only an explicitly published preview for tomorrow in UTC; no vote counts or private drafts.';

-- Catch up overdue real questions immediately, preserving votes and deriving actual finalized totals.
select * from private.finalize_daily_pulse(now());
