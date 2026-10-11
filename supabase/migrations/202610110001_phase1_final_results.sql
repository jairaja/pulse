-- Reconcile databases that already received the original scaffold migration.
-- Fresh databases also run this safely because every destructive operation is conditional.

drop function if exists public.get_live_results(uuid, character, text);
drop function if exists public.get_country_heatmap(uuid);
drop table if exists public.predictions cascade;

alter table public.questions
  add column if not exists results_finalized_at timestamptz;

create or replace function public.prevent_finalized_vote_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_question_id uuid := case when tg_op = 'INSERT' then new.question_id else old.question_id end;
begin
  if tg_op = 'UPDATE' and new.question_id <> old.question_id then
    raise exception 'A vote cannot be moved to another question.';
  end if;

  if exists (
    select 1
    from public.questions q
    where q.id = target_question_id
      and q.results_finalized_at is not null
  ) then
    raise exception 'Votes cannot be changed after results are finalized.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_finalized_vote_changes on public.votes;
create trigger prevent_finalized_vote_changes
before insert or update or delete on public.votes
for each row execute function public.prevent_finalized_vote_changes();

create or replace function public.get_final_results(p_question_id uuid, p_device_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with user_vote as (
    select v.vote, v.country_code
    from public.votes v
    join public.questions q on q.id = v.question_id
    where v.question_id = p_question_id
      and v.device_id = p_device_id
      and q.status = 'archived'
      and q.results_finalized_at is not null
      and q.results_finalized_at <= now()
      and q.asked_on < (now() at time zone 'utc')::date
    limit 1
  ), world as (
    select
      count(*) filter (where v.vote = 'YES') as yes_count,
      count(*) filter (where v.vote = 'NO') as no_count
    from public.votes v
    where v.question_id = p_question_id
      and exists (select 1 from user_vote)
  ), country as (
    select
      count(*) filter (where v.vote = 'YES') as yes_count,
      count(*) filter (where v.vote = 'NO') as no_count
    from public.votes v
    join user_vote uv on uv.country_code = v.country_code
    where v.question_id = p_question_id
  )
  select jsonb_build_object(
    'worldYesPercent', round(100.0 * world.yes_count / nullif(world.yes_count + world.no_count, 0), 1),
    'countryYesPercent', round(100.0 * country.yes_count / nullif(country.yes_count + country.no_count, 0), 1),
    'worldResult', case
      when world.yes_count > world.no_count then 'YES'
      when world.no_count > world.yes_count then 'NO'
      else 'TIE'
    end,
    'countryResult', case
      when country.yes_count > country.no_count then 'YES'
      when country.no_count > country.yes_count then 'NO'
      else 'TIE'
    end,
    'userVote', user_vote.vote,
    'finalizedAt', q.results_finalized_at
  )
  from world, country, user_vote
  join public.questions q on q.id = p_question_id;
$$;

comment on function public.get_final_results(uuid, text) is
  'Returns finalized results only after the caller device voted on the archived question.';
