-- All open submissions stay eligible across days. At UTC midnight, accumulated
-- upvotes decide the winner; equal totals prefer the later submission, then UUID.
-- 'und' records unknown source language honestly until content translation/detection exists.
alter table public.question_submissions add column selected_question_id uuid unique
  references public.questions(id) on delete restrict;

create or replace function private.finalize_daily_pulse(p_now timestamptz default now())
returns table(finalized_count integer, activated_count integer)
language plpgsql security definer set search_path = ''
as $$
declare v_finalized integer := 0; v_activated integer := 0;
  v_day date := (p_now at time zone 'utc')::date;
  v_boundary timestamptz := (v_day::timestamp at time zone 'utc');
  v_winner public.question_submissions%rowtype; v_question uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(70757365);
  with eligible as (
    select q.id,
      count(v.id) filter (where v.choice = 'YES')::bigint yes_count,
      count(v.id) filter (where v.choice = 'NO')::bigint no_count
    from public.questions q left join public.votes v on v.question_id = q.id
    where q.status = 'live' and q.asked_on < (p_now at time zone 'utc')::date
    group by q.id
  ), inserted as (
    insert into public.question_results(question_id, yes_count, no_count, result, finalized_at)
    select id, yes_count, no_count,
      case when yes_count > no_count then 'YES' when no_count > yes_count then 'NO' else 'TIE' end,
      p_now from eligible on conflict (question_id) do nothing returning question_id, finalized_at
  )
  update public.questions q set status = 'archived', results_finalized_at = i.finalized_at
  from inserted i where q.id = i.question_id;
  get diagnostics v_finalized = row_count;

  -- An existing scheduled/live/disabled row reserves its date for the administrator.
  -- Only questions and upvotes committed for the preceding days enter this boundary.
  if not exists(select 1 from public.questions where asked_on = v_day) then
    select s.* into v_winner from public.question_submissions s
    where s.status = 'open' and s.submitted_on < v_day and s.created_at < v_boundary
    order by (select count(*) from public.submission_votes v
      where v.submission_id = s.id and v.created_at < v_boundary and v.voted_on < v_day) desc,
      s.created_at desc, s.id desc limit 1 for update of s;
    if found then
      insert into public.questions(question_text, source_language, asked_on, status)
      values(v_winner.question_text, 'und', v_day, 'scheduled') returning id into v_question;
      update public.question_submissions set status = 'selected', selected_question_id = v_question
      where id = v_winner.id;
    end if;
  end if;

  update public.questions set status = 'live'
  where asked_on = (p_now at time zone 'utc')::date and status = 'scheduled';
  get diagnostics v_activated = row_count;
  return query select v_finalized, v_activated;
end;
$$;
create or replace function public.submit_brewing_question(p_question_text text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_day date;
  v_id uuid; v_text text := btrim(p_question_text);
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(70757365);
  v_day := (clock_timestamp() at time zone 'utc')::date;
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

create or replace function public.upvote_brewing_question(p_submission_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_day date;
  v_submission public.question_submissions%rowtype; v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(70757365);
  v_day := (clock_timestamp() at time zone 'utc')::date;
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

create or replace function private.ensure_daily_rollover(p_now timestamptz default clock_timestamp())
returns void language plpgsql security definer set search_path = '' as $$
declare v_day date := (p_now at time zone 'utc')::date;
begin
  if exists(select 1 from public.questions where
      (status = 'live' and asked_on < v_day) or (status = 'scheduled' and asked_on = v_day))
    or (not exists(select 1 from public.questions where asked_on = v_day)
      and exists(select 1 from public.question_submissions where status = 'open'
        and submitted_on < v_day and created_at < (v_day::timestamp at time zone 'utc'))) then
    perform private.finalize_daily_pulse(p_now);
  end if;
end;
$$;
create or replace function public.list_brewing_submissions(p_limit integer default 20, p_before uuid default null)
returns table(id uuid, question_text text, created_at timestamptz, upvote_count bigint, is_own boolean, upvoted_today boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.question_text, s.created_at,
    (select count(*) from public.submission_votes v where v.submission_id = s.id),
    coalesce(s.author_id = auth.uid(), false),
    exists(select 1 from public.submission_votes v where v.submission_id = s.id and v.voter_id = auth.uid() and v.voted_on = (now() at time zone 'utc')::date)
  from public.question_submissions s where s.status = 'open' and p_limit between 1 and 100
    and (p_before is null or (s.created_at, s.id) < (select c.created_at, c.id from public.question_submissions c where c.id = p_before))
  order by s.created_at desc, s.id desc limit greatest(0, least(p_limit, 100));
$$;

-- Catch up only the current UTC date; never manufacture missed voting days.
select private.ensure_daily_rollover(clock_timestamp());
