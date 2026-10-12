-- PULSE pre-production baseline.
-- This migration is intentionally read-only to mobile clients. Vote submission,
-- moderation, account linking, and finalization will be added in forward migrations.

create schema if not exists private;

-- Keep the API schemas usable for reads while preventing untrusted roles from
-- creating objects or inheriting broad access to future tables/functions.
revoke create on schema public from public;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null check (
    length(btrim(question_text)) between 1 and 280
  ),
  source_language text not null default 'en' check (
    length(btrim(source_language)) between 2 and 35
  ),
  asked_on date not null unique,
  status text not null default 'scheduled' check (
    status in ('scheduled', 'live', 'archived', 'disabled')
  ),
  sponsored boolean not null default false,
  results_finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (results_finalized_at is null or status = 'archived')
);

create table public.question_translations (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  language_code text not null check (
    length(btrim(language_code)) between 2 and 35
  ),
  provider text not null check (provider in ('google', 'openai', 'human')),
  translated_text text not null check (
    length(btrim(translated_text)) between 1 and 280
  ),
  quality_score numeric(5, 2) check (
    quality_score is null or quality_score between 0 and 100
  ),
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  unique (question_id, language_code, provider)
);

create unique index question_translations_one_selected
  on public.question_translations (question_id, language_code)
  where is_selected;

create table public.installations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (length(token_hash) >= 43),
  account_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index installations_account_id_idx
  on public.installations (account_id)
  where account_id is not null;

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete restrict,
  installation_id uuid not null references public.installations(id) on delete restrict,
  account_id uuid references auth.users(id) on delete set null,
  choice text not null check (choice in ('YES', 'NO')),
  accepted_at timestamptz not null default now(),
  unique (question_id, installation_id)
);

create unique index votes_one_account_vote_per_question
  on public.votes (question_id, account_id)
  where account_id is not null;

create index votes_question_choice_idx
  on public.votes (question_id, choice);

create table public.question_results (
  question_id uuid primary key references public.questions(id) on delete restrict,
  yes_count bigint not null check (yes_count >= 0),
  no_count bigint not null check (no_count >= 0),
  total_votes bigint generated always as (yes_count + no_count) stored,
  result text not null check (result in ('YES', 'NO', 'TIE')),
  finalized_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (
    (result = 'YES' and yes_count > no_count)
    or (result = 'NO' and no_count > yes_count)
    or (result = 'TIE' and yes_count = no_count)
  )
);

create index question_results_finalized_at_idx
  on public.question_results (finalized_at desc, question_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger questions_set_updated_at
before update on public.questions
for each row execute function private.set_updated_at();

create or replace function private.validate_vote_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.questions q
    where q.id = new.question_id
      and q.status = 'live'
      and q.asked_on = (now() at time zone 'utc')::date
      and q.results_finalized_at is null
  ) then
    raise exception using
      errcode = 'check_violation',
      message = 'The question is not open for voting.';
  end if;

  return new;
end;
$$;

create trigger votes_validate_insert
before insert on public.votes
for each row execute function private.validate_vote_insert();

create or replace function private.prevent_vote_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'check_violation',
    message = 'Accepted votes are immutable.';
end;
$$;

create trigger votes_are_immutable
before update or delete on public.votes
for each row execute function private.prevent_vote_mutation();

create or replace function private.prevent_result_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'check_violation',
    message = 'Finalized results are immutable.';
end;
$$;

create trigger question_results_are_immutable
before update or delete on public.question_results
for each row execute function private.prevent_result_mutation();

revoke all on schema private from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.validate_vote_insert() from public, anon, authenticated;
revoke all on function private.prevent_vote_mutation() from public, anon, authenticated;
revoke all on function private.prevent_result_mutation() from public, anon, authenticated;

alter table public.questions enable row level security;
alter table public.question_translations enable row level security;
alter table public.installations enable row level security;
alter table public.votes enable row level security;
alter table public.question_results enable row level security;

create policy questions_public_read
on public.questions
for select
to anon, authenticated
using (
  (
    status = 'live'
    and asked_on = (now() at time zone 'utc')::date
  )
  or (
    status = 'archived'
    and results_finalized_at is not null
    and results_finalized_at <= now()
  )
);

create policy translations_public_read
on public.question_translations
for select
to anon, authenticated
using (
  is_selected
  and exists (
    select 1
    from public.questions q
    where q.id = question_translations.question_id
  )
);

create policy finalized_results_public_read
on public.question_results
for select
to anon, authenticated
using (
  finalized_at <= now()
  and exists (
    select 1
    from public.questions q
    where q.id = question_results.question_id
      and q.status = 'archived'
      and q.results_finalized_at = question_results.finalized_at
  )
);

revoke all on table public.questions from anon, authenticated;
revoke all on table public.question_translations from anon, authenticated;
revoke all on table public.installations from anon, authenticated;
revoke all on table public.votes from anon, authenticated;
revoke all on table public.question_results from anon, authenticated;

grant select on table public.questions to anon, authenticated;
grant select on table public.question_translations to anon, authenticated;
grant select on table public.question_results to anon, authenticated;

create or replace function public.get_today_question(
  p_language_code text default 'en'
)
returns table (
  id uuid,
  question_text text,
  source_language text,
  asked_on date,
  sponsored boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    q.id,
    coalesce(t.translated_text, q.question_text) as question_text,
    q.source_language,
    q.asked_on,
    q.sponsored
  from public.questions q
  left join public.question_translations t
    on t.question_id = q.id
    and t.language_code = nullif(btrim(p_language_code), '')
    and t.is_selected
  where q.status = 'live'
    and q.asked_on = (now() at time zone 'utc')::date
  limit 1;
$$;

create or replace function public.list_finalized_results(
  p_language_code text default 'en',
  p_limit integer default 20,
  p_before date default null
)
returns table (
  question_id uuid,
  question_text text,
  source_language text,
  asked_on date,
  sponsored boolean,
  yes_count bigint,
  no_count bigint,
  total_votes bigint,
  result text,
  finalized_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    q.id as question_id,
    coalesce(t.translated_text, q.question_text) as question_text,
    q.source_language,
    q.asked_on,
    q.sponsored,
    r.yes_count,
    r.no_count,
    r.total_votes,
    r.result,
    r.finalized_at
  from public.question_results r
  join public.questions q on q.id = r.question_id
  left join public.question_translations t
    on t.question_id = q.id
    and t.language_code = nullif(btrim(p_language_code), '')
    and t.is_selected
  where q.status = 'archived'
    and q.results_finalized_at = r.finalized_at
    and r.finalized_at <= now()
    and (p_before is null or q.asked_on < p_before)
    and p_limit between 1 and 100
  order by q.asked_on desc
  limit p_limit;
$$;

revoke all on function public.get_today_question(text) from public;
revoke all on function public.list_finalized_results(text, integer, date) from public;

grant execute on function public.get_today_question(text) to anon, authenticated;
grant execute on function public.list_finalized_results(text, integer, date) to anon, authenticated;

comment on function public.get_today_question(text) is
  'Returns the live UTC daily question in the selected translation when available.';

comment on function public.list_finalized_results(text, integer, date) is
  'Returns cursor-paginated immutable finalized result snapshots; never live vote totals.';
