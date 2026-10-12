-- Remove unsupported location claims from databases that received earlier migrations.
-- A phone locale, IP address, or calling code is not reliable evidence of residence.

drop function if exists public.get_today_question(character);

alter table public.users
  drop column if exists country_code;

alter table public.votes
  drop column if exists country_code;

drop table if exists public.countries;

create or replace function public.get_today_question()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', q.id,
    'text', coalesce(t.translated_text, q.question_text),
    'date', q.asked_on
  )
  from public.questions q
  left join public.question_translations t
    on t.question_id = q.id
    and t.language_code = 'en'
    and t.provider = 'selected'
  where q.asked_on = (now() at time zone 'utc')::date
    and q.status = 'live'
  limit 1;
$$;

drop function if exists public.get_final_results(uuid, text);

create or replace function public.get_final_results(p_question_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_question as (
    select q.id, q.results_finalized_at
    from public.questions q
    where q.id = p_question_id
      and q.status = 'archived'
      and q.results_finalized_at is not null
      and q.results_finalized_at <= now()
      and q.asked_on < (now() at time zone 'utc')::date
  ), world as (
    select
      count(*) filter (where v.vote = 'YES') as yes_count,
      count(*) filter (where v.vote = 'NO') as no_count
    from public.votes v
    where v.question_id = p_question_id
      and exists (select 1 from eligible_question)
  )
  select jsonb_build_object(
    'globalYesPercent', round(100.0 * world.yes_count / nullif(world.yes_count + world.no_count, 0), 1),
    'globalNoPercent', round(100.0 * world.no_count / nullif(world.yes_count + world.no_count, 0), 1),
    'totalVotes', world.yes_count + world.no_count,
    'globalResult', case
      when world.yes_count > world.no_count then 'YES'
      when world.no_count > world.yes_count then 'NO'
      else 'TIE'
    end,
    'finalizedAt', q.results_finalized_at
  )
  from world, eligible_question q;
$$;

comment on function public.get_final_results(uuid) is
  'Returns finalized aggregate results for an archived question.';
