-- Development/test data only. Never seed a production project.

insert into public.questions (
  id,
  question_text,
  source_language,
  asked_on,
  status,
  results_finalized_at
)
values (
  '10000000-0000-4000-8000-000000000001',
  'Should schools start later in the morning?',
  'en',
  (now() at time zone 'utc')::date - 1,
  'archived',
  now() - interval '1 minute'
)
on conflict (asked_on) do nothing;

insert into public.question_results (
  question_id,
  yes_count,
  no_count,
  result,
  finalized_at
)
select
  q.id,
  91234,
  37187,
  'YES',
  q.results_finalized_at
from public.questions q
where q.id = '10000000-0000-4000-8000-000000000001'
on conflict (question_id) do nothing;

insert into public.questions (
  id,
  question_text,
  source_language,
  asked_on,
  status
)
values (
  '10000000-0000-4000-8000-000000000002',
  'Should cities create more car-free streets?',
  'en',
  (now() at time zone 'utc')::date,
  'live'
)
on conflict (asked_on) do nothing;
