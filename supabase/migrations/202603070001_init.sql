create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  anonymous_id text not null unique,
  device_id text not null unique,
  country_code text not null default 'GB',
  language text not null default 'en',
  theme text not null default 'system' check (theme in ('system','dark','light')),
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  source_language text not null default 'en',
  status text not null default 'published' check (status in ('draft','published','vetoed','duplicate','abusive','disabled')),
  scheduled_for date not null,
  is_sponsored boolean not null default false,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table if not exists question_translations (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  language text not null,
  translated_text text not null,
  provider text not null check (provider in ('google','openai')),
  quality_score numeric(5,2) not null default 0,
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  unique(question_id, language, provider)
);

create table if not exists countries (
  code text primary key,
  name text not null,
  lat numeric(9,6),
  lon numeric(9,6)
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  device_id text not null,
  vote text not null check (vote in ('YES','NO')),
  country_code text not null references countries(code),
  ip_hash text,
  created_at timestamptz not null default now(),
  unique(device_id, question_id)
);

create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  device_id text not null,
  prediction text not null check (prediction in ('YES','NO')),
  created_at timestamptz not null default now(),
  unique(device_id, question_id)
);

create table if not exists question_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by_device text not null,
  text_original text not null,
  language text not null default 'en',
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','vetoed','duplicate','abusive','disabled')),
  duplicate_of uuid references question_submissions(id),
  submitted_at timestamptz not null default now()
);

create table if not exists submission_votes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references question_submissions(id) on delete cascade,
  device_id text not null,
  vote_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique(submission_id, device_id),
  unique(device_id, vote_date)
);

create or replace function get_today_question(p_language text)
returns table (id uuid, text text, language text, opensAt timestamptz, closesAt timestamptz)
language sql stable as $$
  select q.id,
    coalesce(t.translated_text, q.question_text) as text,
    coalesce(t.language, q.source_language) as language,
    (q.scheduled_for::timestamptz) as "opensAt",
    ((q.scheduled_for + interval '1 day')::timestamptz) as "closesAt"
  from questions q
  left join question_translations t
    on t.question_id = q.id and t.language = p_language and t.selected = true
  where q.scheduled_for = current_date
    and q.status = 'published'
  limit 1;
$$;

create or replace function get_live_results(p_question_id uuid, p_country_code text)
returns table (questionId uuid, worldYesPct numeric, countryYesPct numeric, totalVotes bigint, countryCode text, worldResult text)
language sql stable as $$
  with world as (
    select
      100.0 * avg((vote = 'YES')::int) as yes_pct,
      count(*) as total_votes
    from votes where question_id = p_question_id
  ), country as (
    select 100.0 * avg((vote = 'YES')::int) as yes_pct
    from votes where question_id = p_question_id and country_code = p_country_code
  )
  select p_question_id, coalesce(w.yes_pct,0), coalesce(c.yes_pct,0), coalesce(w.total_votes,0), p_country_code,
    case when coalesce(w.yes_pct,0) >= 50 then 'YES' else 'NO' end
  from world w cross join country c;
$$;

create or replace function get_answered_history(p_device_id text)
returns table (question_id uuid, question_text text, scheduled_for date)
language sql stable as $$
  select q.id, q.question_text, q.scheduled_for
  from votes v
  join questions q on q.id = v.question_id
  where v.device_id = p_device_id
  order by q.scheduled_for desc;
$$;
