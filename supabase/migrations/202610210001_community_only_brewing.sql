-- Community-only selection. Preserve existing live questions/results; legacy drafts never win.
alter table public.questions drop constraint questions_asked_on_key;
create unique index questions_one_active_date on public.questions(asked_on)
  where status in ('live','archived');
comment on index public.questions_one_active_date is
  'One live/finalized daily question per UTC date; legacy scheduled drafts cannot reserve dates.';
comment on column public.questions.preview_published is 'Deprecated; no previews or scheduled overrides are served.';

-- Compatibility for older installed apps: always an empty preview, never a selectable draft.
create or replace function public.get_brewing_question(p_language_code text default 'en')
returns table(id uuid, question_text text, source_language text, asked_on date, sponsored boolean)
language sql stable security definer set search_path = '' as $$
  select q.id,q.question_text,q.source_language,q.asked_on,q.sponsored from public.questions q where false;
$$;

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

  -- Only the community can fill an unopened date. Legacy scheduled/disabled rows cannot reserve it.
  if not exists(select 1 from public.questions where asked_on = v_day and status in ('live','archived')) then
    select s.* into v_winner from public.question_submissions s
    where s.status = 'open' and s.submitted_on < v_day and s.created_at < v_boundary
    order by (select count(*) from public.submission_votes v
      where v.submission_id = s.id and v.created_at < v_boundary and v.voted_on < v_day) desc,
      s.created_at desc, s.id desc limit 1 for update of s;
    if found then
      insert into public.questions(question_text, source_language, asked_on, status)
      values(v_winner.question_text, 'und', v_day, 'live') returning id into v_question;
      v_activated := 1;
      update public.question_submissions set status = 'selected', selected_question_id = v_question
      where id = v_winner.id;
    end if;
  end if;

  return query select v_finalized, v_activated;
end;
$$;
create or replace function private.ensure_daily_rollover(p_now timestamptz default clock_timestamp())
returns void language plpgsql security definer set search_path = '' as $$
declare v_day date := (p_now at time zone 'utc')::date;
begin
  if exists(select 1 from public.questions where status = 'live' and asked_on < v_day)
    or (not exists(select 1 from public.questions where asked_on = v_day and status in ('live','archived'))
      and exists(select 1 from public.question_submissions where status = 'open'
        and submitted_on < v_day and created_at < (v_day::timestamp at time zone 'utc'))) then
    perform private.finalize_daily_pulse(p_now);
  end if;
end;
$$;

create or replace function public.upvote_brewing_question(p_submission_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_day date; v_started_day date := (clock_timestamp() at time zone 'utc')::date;
  v_submission public.question_submissions%rowtype; v_id uuid;
begin
  perform private.ensure_daily_rollover(clock_timestamp());
  perform pg_catalog.pg_advisory_xact_lock_shared(70757365);
  v_day := (clock_timestamp() at time zone 'utc')::date;
  if v_day<>v_started_day then raise exception using errcode='22023',message='Refresh the question list to continue.'; end if;
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


-- Server-owned roles: no role can be acquired through editable auth metadata or app requests.
create table private.community_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check(role in ('admin','superuser')),
  assigned_at timestamptz not null default clock_timestamp()
);
alter table private.community_roles enable row level security;
revoke all on private.community_roles from public, anon, authenticated;

create table private.community_removals (
  request_id uuid primary key,
  submission_id uuid not null,
  moderator_id uuid not null,
  moderator_role text not null check(moderator_role in ('admin','superuser')),
  submitter_id uuid not null,
  question_text text not null,
  submitted_at timestamptz not null,
  reason text not null check(length(btrim(reason)) between 5 and 1000),
  removed_at timestamptz not null default clock_timestamp(),
  unique(submission_id)
);
alter table private.community_removals enable row level security;
revoke all on private.community_removals from public, anon, authenticated;
comment on table private.community_removals is
  'Private immutable removal audit. Snapshot UUIDs survive account/content deletion; no emails exposed to clients.';
create function private.prevent_removal_audit_changes()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception using errcode='42501', message='Removal audit is append-only.';
end;
$$;
revoke all on function private.prevent_removal_audit_changes() from public, anon, authenticated;
create trigger community_removals_append_only before update or delete on private.community_removals
  for each row execute function private.prevent_removal_audit_changes();

create function public.get_my_community_role()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select r.role from private.community_roles r join auth.users u on u.id=r.user_id
    where r.user_id=auth.uid() and u.email_confirmed_at is not null),'member');
$$;
revoke all on function public.get_my_community_role() from public,anon,authenticated;
grant execute on function public.get_my_community_role() to authenticated;

create function public.remove_brewing_question(p_expected_user uuid, p_submission_id uuid, p_reason text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_role text; v_question public.question_submissions%rowtype;
  v_started_day date := (clock_timestamp() at time zone 'utc')::date;
  v_existing private.community_removals%rowtype; v_reason text := btrim(p_reason); v_removed_at timestamptz;
begin
  perform private.ensure_daily_rollover(clock_timestamp());
  -- Take the same lock order as submission/upvote; a selection cannot race a completed removal.
  perform pg_catalog.pg_advisory_xact_lock_shared(70757365);
  if (clock_timestamp() at time zone 'utc')::date<>v_started_day then
    raise exception using errcode='22023',message='Refresh the question list to continue.';
  end if;
  if v_user is null or p_expected_user is distinct from v_user then
    raise exception using errcode='42501',message='Moderator account mismatch.';
  end if;
  select r.role into v_role from private.community_roles r join auth.users u on u.id=r.user_id
    where r.user_id=v_user and u.email_confirmed_at is not null for share of r;
  if v_role is null then raise exception using errcode='42501',message='Moderator access is required.'; end if;
  if p_request_id is null or p_submission_id is null or v_reason is null or length(v_reason) not between 5 and 1000 then
    raise exception using errcode='22023',message='Enter a removal reason of 5 to 1000 characters.';
  end if;
  -- Serialize repeated request IDs even when the client accidentally targets two different cards.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('community-removal:'||p_request_id::text,0));
  select * into v_existing from private.community_removals where request_id=p_request_id;
  if found then
    if v_existing.moderator_id<>v_user or v_existing.submission_id<>p_submission_id or v_existing.reason<>v_reason then
      raise exception using errcode='22023',message='This removal request conflicts with an earlier request.';
    end if;
    return jsonb_build_object('id',p_submission_id,'removed_at',v_existing.removed_at);
  end if;
  select * into v_question from public.question_submissions where id=p_submission_id for update;
  if not found or v_question.status<>'open' then
    raise exception using errcode='22023',message='This question is no longer available in Brewing.';
  end if;
  insert into private.community_removals(request_id,submission_id,moderator_id,moderator_role,
    submitter_id,question_text,submitted_at,reason)
  values(p_request_id,p_submission_id,v_user,v_role,v_question.author_id,v_question.question_text,v_question.created_at,v_reason)
  returning removed_at into v_removed_at;
  update public.question_submissions set status='hidden' where id=p_submission_id;
  return jsonb_build_object('id',p_submission_id,'removed_at',v_removed_at);
end;
$$;
revoke all on function public.remove_brewing_question(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.remove_brewing_question(uuid,uuid,text,uuid) to authenticated;

create index submission_votes_snapshot_idx on public.submission_votes(submission_id,created_at);
create function public.browse_brewing_questions(p_sort text default 'most_upvoted',p_filter text default 'all',
  p_limit integer default 20,p_cursor jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz; v_as_of timestamptz; v_day date; v_user uuid := auth.uid();
  v_id uuid; v_time timestamptz; v_count bigint; v_rows jsonb; v_items jsonb; v_last jsonb; v_next jsonb;
begin
  if p_sort is null or p_sort not in ('most_upvoted','newest','oldest') or p_filter is null
    or p_filter not in ('all','mine','others','today') or p_limit is null or p_limit not between 1 and 100 then
    raise exception using errcode='22023',message='Invalid question filters.';
  end if;
  if p_filter in ('mine','others') and v_user is null then
    raise exception using errcode='42501',message='Sign in to use this filter.';
  end if;
  if p_cursor is null then
    -- Commit fence: all earlier shared-lock writes finish before we pin the snapshot time.
    -- Later writes capture created_at only AFTER their shared lock, so pages have stable ranks.
    perform pg_catalog.pg_advisory_xact_lock(70757365);
    v_now := clock_timestamp(); v_as_of := v_now;
    perform private.ensure_daily_rollover(v_now);
  else
    v_now := clock_timestamp();
    begin
      if jsonb_typeof(p_cursor)<>'object' or p_cursor->>'sort' is distinct from p_sort
        or p_cursor->>'filter' is distinct from p_filter
        or p_cursor->>'scope' is distinct from coalesce(v_user::text,'guest') then
        raise exception 'invalid cursor';
      end if;
      v_as_of := (p_cursor->>'as_of')::timestamptz;
      v_id := (p_cursor->>'id')::uuid; v_time := (p_cursor->>'created_at')::timestamptz;
      v_count := (p_cursor->>'upvotes')::bigint;
      if v_as_of is null or v_id is null or v_time is null or v_count is null or v_count<0
        or v_time>v_as_of or v_as_of>v_now or v_as_of<v_now-interval '10 minutes'
        or (v_as_of at time zone 'utc')::date<>(v_now at time zone 'utc')::date then
        raise exception 'expired cursor';
      end if;
    exception when others then
      raise exception using errcode='22023',message='Refresh the question list to continue.';
    end;
  end if;
  v_day := (v_as_of at time zone 'utc')::date;
  with ranked as (
    select s.id,s.question_text,s.created_at,
      (select count(*) from public.submission_votes v where v.submission_id=s.id and v.created_at<=v_as_of) as upvote_count,
      coalesce(s.author_id=v_user,false) as is_own,
      exists(select 1 from public.submission_votes v where v.submission_id=s.id and v.voter_id=v_user and v.voted_on=v_day) as upvoted_today
    from public.question_submissions s where s.status='open' and s.created_at<=v_as_of
      and (p_filter='all' or (p_filter='mine' and s.author_id=v_user)
        or (p_filter='others' and s.author_id<>v_user) or (p_filter='today' and s.submitted_on=v_day))
  ), paged as (
    select * from ranked r where p_cursor is null
      or (p_sort='most_upvoted' and (r.upvote_count,r.created_at,r.id)<(v_count,v_time,v_id))
      or (p_sort='newest' and (r.created_at,r.id)<(v_time,v_id))
      or (p_sort='oldest' and (r.created_at,r.id)>(v_time,v_id))
    order by case when p_sort='most_upvoted' then r.upvote_count end desc,
      case when p_sort in ('most_upvoted','newest') then r.created_at end desc,
      case when p_sort='oldest' then r.created_at end asc,
      case when p_sort='oldest' then r.id end asc, r.id desc limit p_limit+1
  ) select coalesce(jsonb_agg(to_jsonb(paged)),'[]'::jsonb) into v_rows from paged;
  select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into v_items
    from jsonb_array_elements(v_rows) with ordinality as a(value,ord) where ord<=p_limit;
  if jsonb_array_length(v_rows)>p_limit then
    v_last := v_items->(p_limit-1);
    v_next := jsonb_build_object('sort',p_sort,'filter',p_filter,'scope',coalesce(v_user::text,'guest'),
      'as_of',v_as_of,'id',v_last->>'id','created_at',v_last->>'created_at','upvotes',v_last->>'upvote_count');
  end if;
  return jsonb_build_object('items',v_items,'next_cursor',v_next,'server_time',clock_timestamp());
end;
$$;
revoke all on function public.browse_brewing_questions(text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.browse_brewing_questions(text,text,integer,jsonb) to anon,authenticated;

select private.ensure_daily_rollover(clock_timestamp());

create function private.get_open_community_count()
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.question_submissions where status='open'
    and created_at<=now() and submitted_on<=(now() at time zone 'utc')::date;
$$;
revoke all on function private.get_open_community_count() from public,anon,authenticated;
grant execute on function private.get_open_community_count() to service_role;
