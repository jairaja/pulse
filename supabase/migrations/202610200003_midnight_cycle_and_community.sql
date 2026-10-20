-- Daily voting uses [00:00 UTC, next 00:00 UTC). No noon job.
select cron.unschedule(jobid) from cron.job where jobname = 'pulse-daily-finalization';
select cron.schedule('pulse-daily-finalization', '0 0 * * *',
  $$select * from private.finalize_daily_pulse(clock_timestamp());$$);

-- A read repairs a missed boundary before returning public questions/results.
create function private.ensure_daily_rollover(p_now timestamptz default clock_timestamp())
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.questions where
    (status = 'live' and asked_on < (p_now at time zone 'utc')::date)
    or (status = 'scheduled' and asked_on = (p_now at time zone 'utc')::date)) then
    perform private.finalize_daily_pulse(p_now);
  end if;
end;
$$;
revoke all on function private.ensure_daily_rollover(timestamptz) from public, anon, authenticated;

-- Shared insert locks allow concurrent votes, while the existing exclusive finalizer lock
-- waits for accepted inserts to commit before taking its immutable snapshot.
create or replace function private.validate_vote_insert()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(70757365);
  if not exists(select 1 from public.questions q where q.id = new.question_id
    and q.status = 'live' and q.asked_on = (clock_timestamp() at time zone 'utc')::date
    and q.results_finalized_at is null) then
    raise exception using errcode = 'check_violation', message = 'The question is not open for voting.';
  end if;
  return new;
end;
$$;

create or replace function public.get_today_question(p_language_code text default 'en')
returns table(id uuid, question_text text, source_language text, asked_on date,
  sponsored boolean, server_time timestamptz, voting_closes_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz := clock_timestamp();
begin
  perform private.ensure_daily_rollover(v_now);
  return query select q.id, coalesce(t.translated_text, q.question_text), q.source_language,
    q.asked_on, q.sponsored, clock_timestamp(), ((q.asked_on + 1)::timestamp at time zone 'utc')
  from public.questions q left join public.question_translations t on t.question_id = q.id
    and t.language_code = nullif(btrim(p_language_code), '') and t.is_selected
  where q.status = 'live' and q.asked_on = (clock_timestamp() at time zone 'utc')::date limit 1;
end;
$$;
revoke all on function public.get_today_question(text) from public, anon, authenticated;
grant execute on function public.get_today_question(text) to anon, authenticated;

create or replace function public.list_finalized_results(p_language_code text default 'en',
  p_limit integer default 20, p_before date default null)
returns table(question_id uuid, question_text text, source_language text, asked_on date,
  sponsored boolean, yes_count bigint, no_count bigint, total_votes bigint, result text, finalized_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.ensure_daily_rollover(clock_timestamp());
  return query select q.id, coalesce(t.translated_text, q.question_text), q.source_language,
    q.asked_on, q.sponsored, r.yes_count, r.no_count, r.total_votes, r.result, r.finalized_at
  from public.question_results r join public.questions q on q.id = r.question_id
  left join public.question_translations t on t.question_id = q.id
    and t.language_code = nullif(btrim(p_language_code), '') and t.is_selected
  where q.status = 'archived' and q.results_finalized_at = r.finalized_at
    and r.finalized_at <= clock_timestamp() and (p_before is null or q.asked_on < p_before)
    and p_limit between 1 and 100
  order by q.asked_on desc limit greatest(0, least(p_limit, 100));
end;
$$;
revoke all on function public.list_finalized_results(text, integer, date) from public, anon, authenticated;
grant execute on function public.list_finalized_results(text, integer, date) to anon, authenticated;

create table public.question_submissions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  question_text text not null check(length(btrim(question_text)) between 5 and 280),
  submitted_on date not null default (clock_timestamp() at time zone 'utc')::date,
  created_at timestamptz not null default clock_timestamp(),
  status text not null default 'open' check(status in ('open', 'selected', 'hidden')),
  unique(author_id, submitted_on)
);
create table public.submission_votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references auth.users(id) on delete cascade,
  submission_id uuid not null references public.question_submissions(id) on delete cascade,
  voted_on date not null default (clock_timestamp() at time zone 'utc')::date,
  created_at timestamptz not null default clock_timestamp(),
  unique(voter_id, voted_on)
);
create index question_submissions_feed_idx on public.question_submissions(created_at desc, id desc) where status = 'open';
create index submission_votes_submission_idx on public.submission_votes(submission_id);
alter table public.question_submissions enable row level security;
alter table public.submission_votes enable row level security;
revoke all on public.question_submissions, public.submission_votes from public, anon, authenticated;

create function public.submit_brewing_question(p_question_text text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_day date := (clock_timestamp() at time zone 'utc')::date;
  v_id uuid; v_text text := btrim(p_question_text);
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Sign in to submit a question.'; end if;
  if not exists(select 1 from auth.users where id = v_user and email_confirmed_at is not null) then
    raise exception using errcode = '42501', message = 'Verify your email before submitting or upvoting.';
  end if;
  if v_text is null or length(v_text) < 5 or length(v_text) > 280 then
    raise exception using errcode = '22023', message = 'Questions must contain 5 to 280 characters.';
  end if;
  insert into public.question_submissions(author_id, question_text, submitted_on)
  values(v_user, v_text, v_day) on conflict(author_id, submitted_on) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.question_submissions where author_id = v_user and submitted_on = v_day and question_text = v_text;
    if v_id is null then raise exception using errcode = 'P0001', message = 'You already submitted a question today. Try again at 00:00 UTC.'; end if;
  end if;
  return v_id;
end;
$$;

create function public.upvote_brewing_question(p_submission_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_day date := (clock_timestamp() at time zone 'utc')::date;
  v_submission public.question_submissions%rowtype; v_id uuid;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Sign in to upvote a question.'; end if;
  if not exists(select 1 from auth.users where id = v_user and email_confirmed_at is not null) then
    raise exception using errcode = '42501', message = 'Verify your email before submitting or upvoting.';
  end if;
  select * into v_submission from public.question_submissions where id = p_submission_id for share;
  if not found or v_submission.status <> 'open' then raise exception using errcode = '22023', message = 'This question is not available for upvotes.'; end if;
  if v_submission.author_id = v_user then raise exception using errcode = '42501', message = 'You cannot upvote your own question.'; end if;
  insert into public.submission_votes(voter_id, submission_id, voted_on)
  values(v_user, p_submission_id, v_day) on conflict(voter_id, voted_on) do nothing returning id into v_id;
  if v_id is null and not exists(select 1 from public.submission_votes where voter_id = v_user and voted_on = v_day and submission_id = p_submission_id) then
    raise exception using errcode = 'P0001', message = 'You already used your upvote today. Try again at 00:00 UTC.';
  end if;
end;
$$;

create function public.get_brewing_allowance()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('server_time', now(), 'resets_at', (((now() at time zone 'utc')::date + 1)::timestamp at time zone 'utc'),
    'submitted_question_id', (select id from public.question_submissions where author_id = auth.uid() and submitted_on = (now() at time zone 'utc')::date),
    'upvoted_question_id', (select submission_id from public.submission_votes where voter_id = auth.uid() and voted_on = (now() at time zone 'utc')::date));
$$;

create function public.list_brewing_submissions(p_limit integer default 20, p_before uuid default null)
returns table(id uuid, question_text text, created_at timestamptz, upvote_count bigint, is_own boolean, upvoted_today boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.question_text, s.created_at,
    (select count(*) from public.submission_votes v where v.submission_id = s.id),
    coalesce(s.author_id = auth.uid(), false),
    exists(select 1 from public.submission_votes v where v.submission_id = s.id and v.voter_id = auth.uid() and v.voted_on = (now() at time zone 'utc')::date)
  from public.question_submissions s where s.status = 'open' and p_limit between 1 and 100
    and (p_before is null or (s.created_at, s.id) < (select c.created_at, c.id from public.question_submissions c where c.id = p_before and c.status = 'open'))
  order by s.created_at desc, s.id desc limit greatest(0, least(p_limit, 100));
$$;
revoke all on function public.submit_brewing_question(text), public.upvote_brewing_question(uuid), public.get_brewing_allowance(), public.list_brewing_submissions(integer, uuid) from public, anon, authenticated;
grant execute on function public.submit_brewing_question(text), public.upvote_brewing_question(uuid), public.get_brewing_allowance() to authenticated;
grant execute on function public.list_brewing_submissions(integer, uuid) to anon, authenticated;
select private.ensure_daily_rollover(clock_timestamp());
