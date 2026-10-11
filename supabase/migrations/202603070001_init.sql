create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  anonymous_uuid uuid not null unique,
  device_id text not null unique,
  device_fingerprint text not null unique,
  country_code char(2) not null default 'GB',
  language_code text not null default 'en',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.countries (
  code char(2) primary key,
  name text not null,
  latitude double precision not null,
  longitude double precision not null
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  source_language text not null default 'en',
  asked_on date not null unique,
  status text not null default 'live' check (status in ('scheduled', 'live', 'archived', 'disabled')),
  sponsored boolean not null default false,
  results_finalized_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.question_translations (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  language_code text not null,
  provider text not null check (provider in ('google', 'openai', 'selected')),
  translated_text text not null,
  quality_score numeric(5,2) not null default 0,
  unique (question_id, language_code, provider)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  device_id text not null,
  device_fingerprint text not null,
  country_code char(2) not null,
  vote text not null check (vote in ('YES', 'NO')),
  ip_hash text,
  created_at timestamptz not null default now(),
  unique(device_id, question_id),
  unique(device_fingerprint, question_id)
);

create table if not exists public.question_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by_device_id text not null,
  source_language text not null,
  submitted_text text not null,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected', 'duplicate', 'abusive')),
  duplicate_of uuid references public.question_submissions(id),
  vetoed boolean not null default false,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.submission_votes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.question_submissions(id) on delete cascade,
  device_id text not null,
  vote_day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  unique (submission_id, device_id, vote_day)
);

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

create trigger prevent_finalized_vote_changes
before insert or update or delete on public.votes
for each row execute function public.prevent_finalized_vote_changes();

create or replace function public.get_today_question(p_country char(2))
returns json
language sql
security definer
as $$
  select json_build_object(
    'id', q.id,
    'text', coalesce(t.translated_text, q.question_text),
    'date', q.asked_on
  )
  from public.questions q
  left join public.question_translations t
    on t.question_id = q.id and t.language_code = 'en' and t.provider = 'selected'
  where q.asked_on = current_date and q.status = 'live'
  limit 1;
$$;

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
