create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  anonymous_uuid uuid not null unique,
  device_id text not null,
  country_code char(2) not null default 'GB',
  language_code text not null default 'en',
  theme text not null default 'system' check (theme in ('system','dark','light')),
  created_at timestamptz not null default now()
);

create table if not exists public.countries (
  code char(2) primary key,
  name text not null
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  original_language text not null default 'en',
  active_on date unique,
  status text not null default 'scheduled' check (status in ('scheduled','live','closed','disabled')),
  sponsored boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.question_translations (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  language_code text not null,
  translated_text text not null,
  provider text not null check (provider in ('google','openai','winner')),
  quality_score numeric(5,2) not null default 0,
  unique(question_id, language_code, provider)
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  device_id text not null,
  country_code char(2) not null,
  prediction text not null check (prediction in ('YES','NO')),
  created_at timestamptz not null default now(),
  unique(device_id, question_id)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  device_id text not null,
  country_code char(2) not null,
  vote text not null check (vote in ('YES','NO')),
  ip_hash text,
  created_at timestamptz not null default now(),
  unique(device_id, question_id)
);

create table if not exists public.question_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  question_text text not null,
  language_code text not null default 'en',
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected','duplicate','abusive','disabled')),
  duplicate_of uuid references public.question_submissions(id),
  created_at timestamptz not null default now()
);

create table if not exists public.submission_votes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.question_submissions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  voted_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique(user_id, voted_at)
);

create or replace function public.get_live_question_results(p_question_id uuid)
returns table(scope text, yes_count bigint, no_count bigint)
language sql
as $$
  select 'world'::text as scope,
         count(*) filter (where vote='YES') as yes_count,
         count(*) filter (where vote='NO') as no_count
  from public.votes
  where question_id = p_question_id

  union all

  select 'country'::text,
         count(*) filter (where vote='YES'),
         count(*) filter (where vote='NO')
  from public.votes
  where question_id = p_question_id
    and country_code = 'GB';
$$;

create or replace function public.get_today_question_with_translations()
returns table(id uuid, question_text text, active_on date, original_language text)
language sql
as $$
  select q.id, q.question_text, q.active_on, q.original_language
  from public.questions q
  where q.active_on = current_date
  and q.status = 'live'
  limit 1;
$$;
