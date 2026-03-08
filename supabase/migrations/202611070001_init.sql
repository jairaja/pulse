create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  anonymous_uuid uuid not null unique,
  device_id text not null unique,
  country_code char(2) not null default 'GB',
  language_code text not null default 'en',
  theme_mode text not null default 'system' check (theme_mode in ('system', 'dark', 'light')),
  created_at timestamptz not null default now()
);

create table if not exists countries (
  code char(2) primary key,
  name text not null,
  latitude numeric not null,
  longitude numeric not null
);

create table if not exists questions (
  id uuid primary key default uuid_generate_v4(),
  question_text text not null,
  original_language_code text not null,
  active_on date,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed', 'disabled')),
  is_sponsored boolean not null default false,
  moderation_status text not null default 'clean' check (moderation_status in ('clean', 'flagged', 'duplicate', 'abusive')),
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table if not exists question_translations (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references questions(id) on delete cascade,
  language_code text not null,
  translated_text text not null,
  provider text not null check (provider in ('google', 'openai', 'hybrid')),
  quality_score numeric not null default 0,
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  unique (question_id, language_code, provider)
);

create table if not exists votes (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references questions(id),
  user_id uuid not null references users(id),
  device_id text not null,
  country_code char(2) not null references countries(code),
  choice text not null check (choice in ('YES', 'NO')),
  ip_hash text,
  created_at timestamptz not null default now(),
  unique (device_id, question_id)
);

create table if not exists predictions (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references questions(id),
  user_id uuid not null references users(id),
  prediction text not null check (prediction in ('YES', 'NO')),
  created_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create table if not exists question_submissions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  submitted_text text not null,
  submitted_language_code text not null,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'duplicate', 'abusive', 'rejected')),
  duplicate_of_submission_id uuid references question_submissions(id),
  created_at timestamptz not null default now()
);

create table if not exists submission_votes (
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid not null references question_submissions(id) on delete cascade,
  user_id uuid not null references users(id),
  vote_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, vote_date)
);

create or replace view daily_question_view as
select
  q.id,
  coalesce(qt.translated_text, q.question_text) as question_text,
  q.original_language_code,
  coalesce(qt.language_code, q.original_language_code) as language_code,
  q.active_on,
  q.is_sponsored,
  q.status
from questions q
left join question_translations qt on qt.question_id = q.id and qt.is_selected = true
where q.status = 'active' and q.active_on = current_date;

create or replace function get_pulse_result(p_question_id uuid, p_country_code char(2))
returns json
language sql
as $$
with world as (
  select
    round(100.0 * avg((choice = 'YES')::int), 2) as yes_percent,
    round(100.0 * avg((choice = 'NO')::int), 2) as no_percent,
    count(*) as total_votes
  from votes
  where question_id = p_question_id
), country as (
  select
    round(100.0 * avg((choice = 'YES')::int), 2) as yes_percent,
    round(100.0 * avg((choice = 'NO')::int), 2) as no_percent
  from votes
  where question_id = p_question_id and country_code = p_country_code
)
select json_build_object(
  'questionId', p_question_id,
  'worldYesPercent', coalesce((select yes_percent from world), 0),
  'worldNoPercent', coalesce((select no_percent from world), 0),
  'countryYesPercent', coalesce((select yes_percent from country), 0),
  'countryNoPercent', coalesce((select no_percent from country), 0),
  'totalVotes', coalesce((select total_votes from world), 0)
);
$$;

create or replace function get_my_pulse_metrics(p_user_id uuid)
returns json
language sql
as $$
with joined as (
  select v.question_id, v.choice as user_vote, p.prediction
  from votes v
  left join predictions p on p.question_id = v.question_id and p.user_id = v.user_id
  where v.user_id = p_user_id
), world_majority as (
  select
    question_id,
    case when avg((choice = 'YES')::int) >= 0.5 then 'YES' else 'NO' end as majority_vote
  from votes
  group by question_id
)
select json_build_object(
  'answeredCount', count(j.question_id),
  'worldAgreementPercent', round(100.0 * avg((j.user_vote = wm.majority_vote)::int), 2),
  'worldDisagreementPercent', round(100.0 * avg((j.user_vote <> wm.majority_vote)::int), 2),
  'predictionAccuracyPercent', round(100.0 * avg((j.prediction = wm.majority_vote)::int), 2)
)
from joined j
join world_majority wm on wm.question_id = j.question_id;
$$;
