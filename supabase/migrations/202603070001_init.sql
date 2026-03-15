create extension if not exists "uuid-ossp";

create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
  question_text text not null,
  source_language text not null default 'en',
  asked_on date not null unique,
  status text not null default 'live' check (status in ('scheduled', 'live', 'archived', 'disabled')),
  sponsored boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.question_translations (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references public.questions(id) on delete cascade,
  language_code text not null,
  provider text not null check (provider in ('google', 'openai', 'selected')),
  translated_text text not null,
  quality_score numeric(5,2) not null default 0,
  unique (question_id, language_code, provider)
);

create table if not exists public.votes (
  id uuid primary key default uuid_generate_v4(),
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

create table if not exists public.predictions (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references public.questions(id) on delete cascade,
  device_id text not null,
  prediction text not null check (prediction in ('YES', 'NO')),
  created_at timestamptz not null default now(),
  unique(device_id, question_id)
);

create table if not exists public.question_submissions (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid not null references public.question_submissions(id) on delete cascade,
  device_id text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists submission_votes_one_vote_per_day
  on public.submission_votes (submission_id, device_id, (date(created_at)));

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

create or replace function public.get_live_results(p_question_id uuid, p_country char(2), p_device_id text)
returns json
language sql
security definer
as $$
  with world as (
    select
      coalesce(100.0 * avg(case when vote='YES' then 1 else 0 end), 0) as yes_percent,
      case when avg(case when vote='YES' then 1 else 0 end) >= 0.5 then 'YES' else 'NO' end as result
    from public.votes where question_id = p_question_id
  ), country as (
    select
      coalesce(100.0 * avg(case when vote='YES' then 1 else 0 end), 0) as yes_percent,
      case when avg(case when vote='YES' then 1 else 0 end) >= 0.5 then 'YES' else 'NO' end as result
    from public.votes where question_id = p_question_id and country_code = p_country
  ), user_vote as (
    select coalesce((select vote from public.votes where question_id = p_question_id and device_id = p_device_id limit 1), 'YES') as vote
  )
  select json_build_object(
    'worldYesPercent', world.yes_percent,
    'countryYesPercent', country.yes_percent,
    'worldResult', world.result,
    'countryResult', country.result,
    'userVote', user_vote.vote
  ) from world, country, user_vote;
$$;

create or replace function public.get_country_heatmap(p_question_id uuid)
returns table(code char(2), latitude double precision, longitude double precision, yesRatio numeric)
language sql
security definer
as $$
  select
    c.code,
    c.latitude,
    c.longitude,
    coalesce(avg(case when v.vote = 'YES' then 1 else 0 end), 0)::numeric as yesRatio
  from public.countries c
  left join public.votes v on v.country_code = c.code and v.question_id = p_question_id
  group by c.code, c.latitude, c.longitude;
$$;
