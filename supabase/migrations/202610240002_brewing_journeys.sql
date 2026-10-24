-- Pending intake, device/day upvote quota and public occurrence resolution.
alter table public.question_submissions drop constraint question_submissions_question_text_check;
alter table public.question_submissions add constraint submission_text_bytes check(octet_length(question_text) between 1 and 4096);
alter table public.question_submissions drop constraint question_submissions_status_check;
alter table public.question_submissions add constraint submission_status check(status in ('pending','open','selected','hidden'));
alter table public.question_submissions add column published_at timestamptz;
update public.question_submissions set published_at=created_at where status in ('open','selected');
alter table public.question_submissions add column revision integer not null default 1;
alter table public.question_submissions add column intake_request uuid unique;
alter table public.questions drop constraint questions_question_text_check;
alter table public.questions add constraint questions_text_bytes check(octet_length(question_text) between 1 and 4096);
alter table public.submission_votes add column installation_id uuid references public.installations(id);
create unique index submission_votes_device_day on public.submission_votes(installation_id,voted_on) where installation_id is not null;
-- Quota state outlives content deletion; a deleted candidate must not refund every supporter's day.
-- One latest-use row per account/device bounds quota storage; public submission_votes keeps event history.
create table private.account_upvote_allowance (
  account_id uuid primary key references auth.users(id) on delete cascade,
  voted_on date not null, submission_id uuid not null
);
create table private.device_upvote_allowance (
  installation_id uuid primary key references public.installations(id),
  voted_on date not null, submission_id uuid not null
);
revoke all on private.account_upvote_allowance,private.device_upvote_allowance from public,anon,authenticated;
insert into private.account_upvote_allowance
select distinct on(voter_id) voter_id,voted_on,submission_id from public.submission_votes order by voter_id,voted_on desc,created_at desc;
-- Older clients did not record which associated device sent an upvote. Conservatively reserve known devices.
insert into private.device_upvote_allowance
select distinct on(a.installation_id) a.installation_id,v.voted_on,v.submission_id
from private.account_devices a join public.submission_votes v on v.voter_id=a.account_id
order by a.installation_id,v.voted_on desc,v.created_at desc;

create table private.submission_reviews (
  id bigint generated always as identity primary key, submission_id uuid not null,
  revision integer not null, reviewer_id uuid, decision text not null check(decision in ('publish','hold')),
  reason text not null, created_at timestamptz not null default clock_timestamp()
);
revoke all on private.submission_reviews from public,anon,authenticated;
create extension if not exists pg_trgm with schema extensions;
create index brewing_text_search on public.question_submissions using gin(question_text extensions.gin_trgm_ops) where status='open';
create index daily_text_search on public.questions using gin(question_text extensions.gin_trgm_ops) where status in ('live','archived');

-- Bypass paths in old clients are retired. Only the gateway verifies fresh action-bound CAPTCHA/device evidence.
revoke all on function public.upvote_brewing_question(uuid),public.submit_brewing_question(text) from public,anon,authenticated,service_role;
create function public.accept_brewing_upvote(p_account uuid,p_session uuid,p_credential text,p_device_hash text,p_submission uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_device uuid; v_day date; v_started date:=(clock_timestamp() at time zone 'utc')::date;
  v_s public.question_submissions%rowtype; v_previous uuid; v_accepted timestamptz;
begin
  perform private.assert_account_session(p_account,p_session);
  v_device:=public.register_installation(p_credential,null,p_device_hash);
  perform private.assert_account_session(p_account,p_session,v_device);
  perform private.ensure_daily_rollover(clock_timestamp());
  perform pg_catalog.pg_advisory_xact_lock_shared(70757365);
  v_day:=(clock_timestamp() at time zone 'utc')::date;
  if v_day<>v_started then raise exception 'Refresh the question list to continue.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('brewing-device:'||v_device::text||v_day::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('brewing-account:'||p_account::text||v_day::text,0));
  select submission_id into v_previous from private.account_upvote_allowance where account_id=p_account and voted_on>=v_day;
  if found then
    if v_previous=p_submission then return jsonb_build_object('status','ALREADY_UPVOTED','id',p_submission); end if;
    raise exception 'You already used your upvote today. Try again at 00:00 UTC.';
  end if;
  if exists(select 1 from private.device_upvote_allowance where installation_id=v_device and voted_on>=v_day) then
    raise exception 'This device already used its upvote today. Try again at 00:00 UTC.';
  end if;
  select * into v_s from public.question_submissions where id=p_submission for share;
  if not found or v_s.status<>'open' then raise exception 'This question is not available for upvotes.'; end if;
  if v_s.author_id=p_account then raise exception 'You cannot upvote your own question.'; end if;
  v_accepted:=clock_timestamp();
  if (v_accepted at time zone 'utc')::date<>v_day then raise exception 'Refresh the question list to continue.'; end if;
  insert into public.submission_votes(voter_id,submission_id,voted_on,installation_id,created_at)
    values(p_account,p_submission,v_day,v_device,v_accepted);
  insert into private.account_upvote_allowance values(p_account,v_day,p_submission)
    on conflict(account_id) do update set voted_on=excluded.voted_on,submission_id=excluded.submission_id;
  insert into private.device_upvote_allowance values(v_device,v_day,p_submission)
    on conflict(installation_id) do update set voted_on=excluded.voted_on,submission_id=excluded.submission_id;
  return jsonb_build_object('status','ACCEPTED','id',p_submission);
end $$;
create function public.get_brewing_device_allowance(p_account uuid,p_session uuid,p_credential text,p_device_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_device uuid; v_day date:=(clock_timestamp() at time zone 'utc')::date;
begin
  perform private.assert_account_session(p_account,p_session);
  v_device:=public.register_installation(p_credential,null,p_device_hash);
  perform private.assert_account_session(p_account,p_session,v_device);
  return jsonb_build_object('server_time',clock_timestamp(),'resets_at',((v_day+1)::timestamp at time zone 'utc'),
    'submitted_question_id',(select id from public.question_submissions where author_id=p_account and submitted_on=v_day),
    'upvoted_question_id',(select submission_id from private.account_upvote_allowance where account_id=p_account and voted_on>=v_day),
    'device_used',exists(select 1 from private.device_upvote_allowance where installation_id=v_device and voted_on>=v_day));
end $$;
create function public.accept_brewing_submission(p_account uuid,p_session uuid,p_credential text,p_device_hash text,
  p_text text,p_request uuid,p_edit uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_device uuid; v_day date:=(clock_timestamp() at time zone 'utc')::date; v_id uuid; v_text text:=btrim(p_text); v_accepted timestamptz;
begin
  perform private.assert_account_session(p_account,p_session);
  v_device:=public.register_installation(p_credential,null,p_device_hash);
  perform private.assert_account_session(p_account,p_session,v_device);
  perform pg_catalog.pg_advisory_xact_lock_shared(70757365);
  v_day:=(clock_timestamp() at time zone 'utc')::date;
  if v_text is null or octet_length(v_text) not between 1 and 4096 or p_request is null then raise exception 'Invalid question.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('brewing-submit:'||p_account::text||v_day::text,0));
  select id into v_id from public.question_submissions where author_id=p_account and intake_request=p_request;
  if found then
    if not exists(select 1 from public.question_submissions where id=v_id and question_text=v_text
      and (p_edit is null or id=p_edit)) then raise exception 'This submission request conflicts with an earlier request.'; end if;
    return v_id;
  end if;
  -- Exact active duplicates are serialized; approximate matches remain suggestions, never automatic rejection.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('question-text:'||lower(v_text),0));
  if exists(select 1 from public.question_submissions where status in ('open','pending')
    and lower(question_text)=lower(v_text) and id is distinct from p_edit) then raise exception 'This question is already in Brewing.'; end if;
  if p_edit is not null then
    update public.question_submissions set question_text=v_text,revision=revision+1,intake_request=p_request
      where id=p_edit and author_id=p_account and status='pending' returning id into v_id;
    if v_id is null then raise exception 'Only your pending question can be edited.'; end if;
    return v_id;
  end if;
  v_accepted:=clock_timestamp();
  if (v_accepted at time zone 'utc')::date<>v_day then raise exception 'Refresh the question list to continue.'; end if;
  insert into public.question_submissions(author_id,question_text,submitted_on,status,intake_request,created_at)
    values(p_account,v_text,v_day,'pending',p_request,v_accepted) on conflict(author_id,submitted_on) do nothing returning id into v_id;
  if v_id is null then raise exception 'You already submitted a question today. Try again at 00:00 UTC.'; end if;
  return v_id;
end $$;

create function public.review_brewing_submission(p_id uuid,p_revision integer,p_publish boolean,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_s public.question_submissions%rowtype;
begin
  -- service_role is reserved for the moderation worker; human decisions require Moderator/Admin.
  if auth.role()<>'service_role' then
    perform private.assert_current_session();
    if not exists(select 1 from private.community_roles where user_id=v_user and role in ('moderator','admin')) then
      raise exception using errcode='42501',message='Moderator access is required.';
    end if;
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 5 and 1000 then raise exception 'Enter a review reason.'; end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(70757365);
  select * into v_s from public.question_submissions where id=p_id for update;
  if not found or v_s.status<>'pending' or v_s.revision<>p_revision then raise exception 'Question changed. Refresh before reviewing.'; end if;
  insert into private.submission_reviews(submission_id,revision,reviewer_id,decision,reason)
    values(p_id,p_revision,v_user,case when p_publish then 'publish' else 'hold' end,btrim(p_reason));
  if p_publish then update public.question_submissions set status='open',published_at=clock_timestamp() where id=p_id; end if;
end $$;
grant execute on function public.review_brewing_submission(uuid,integer,boolean,text) to authenticated,service_role;

-- Rename stored roles together: historical audit snapshots retain their original vocabulary.
alter table private.community_roles drop constraint community_roles_role_check;
update private.community_roles set role=case role when 'admin' then 'moderator' when 'superuser' then 'admin' end;
alter table private.community_roles add constraint community_roles_role_check check(role in ('moderator','admin'));
alter table private.community_removals add column role_vocabulary text not null default 'legacy';
alter table private.community_removals alter column role_vocabulary set default 'current';
alter table private.community_removals add constraint audit_role_vocabulary check(
  (role_vocabulary='legacy' and moderator_role in ('admin','superuser')) or
  (role_vocabulary='current' and moderator_role in ('moderator','admin')));
alter table private.community_removals drop constraint community_removals_moderator_role_check;
alter table private.community_removals add constraint community_removals_moderator_role_check check(moderator_role in ('admin','superuser','moderator'));
comment on column private.community_removals.moderator_role is 'Historical role at removal. role_vocabulary=legacy: admin meant Moderator and superuser meant Admin; current uses moderator/admin.';

create function public.list_pending_questions() returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.assert_current_session();
  return (select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from (
    select id,question_text,revision,created_at from public.question_submissions where status='pending'
      and (author_id=auth.uid() or exists(select 1 from private.community_roles where user_id=auth.uid()))
    order by created_at limit 50) s);
end $$;
grant execute on function public.list_pending_questions() to authenticated;

create function public.search_public_questions(p_query text,p_limit integer default 6)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_query is null or length(btrim(p_query))<2 or octet_length(p_query)>4096 or p_limit not between 1 and 10 then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
    select * from (
      select s.id,s.question_text,'brewing'::text as destination,s.created_at,
        extensions.similarity(s.question_text,p_query) as score from public.question_submissions s
        where status='open' and (s.question_text operator(extensions.%) p_query or s.question_text ilike '%'||replace(replace(replace(btrim(p_query),'\','\\'),'%','\%'),'_','\_')||'%')
      union all
      select q.id,q.question_text,case when q.status='live' then 'today' else 'past-results' end,q.created_at,
        extensions.similarity(q.question_text,p_query) from public.questions q
        where q.status in ('live','archived') and (q.question_text operator(extensions.%) p_query or q.question_text ilike '%'||replace(replace(replace(btrim(p_query),'\','\\'),'%','\%'),'_','\_')||'%')
    ) hits order by score desc,created_at desc,id limit p_limit) r);
end $$;
grant execute on function public.search_public_questions(text,integer) to anon,authenticated;
create function public.resolve_public_question(p_id uuid,p_kind text default 'question')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid:=p_id; v_s public.question_submissions%rowtype; v_q public.questions%rowtype; v_result jsonb;
begin
  perform private.ensure_daily_rollover(clock_timestamp());
  if p_kind='submission' then
    select * into v_s from public.question_submissions where id=p_id;
    if not found or v_s.status not in ('open','selected') then return null; end if;
    if v_s.status='open' then return jsonb_build_object('id',v_s.id,'text',v_s.question_text,'destination','brewing',
      'created_at',v_s.created_at,'upvote_count',(select count(*) from public.submission_votes where submission_id=v_s.id),
      'is_own',coalesce(v_s.author_id=auth.uid(),false)); end if;
    v_id:=v_s.selected_question_id;
  elsif p_kind<>'question' then return null; end if;
  select * into v_q from public.questions where id=v_id and status in ('live','archived');
  if not found then return null; end if;
  v_result:=jsonb_build_object('id',v_id,'text',v_q.question_text,'destination',case when v_q.status='live' then 'today' else 'past-results' end,'asked_on',v_q.asked_on);
  if v_q.status='archived' then
    v_result:=v_result||coalesce((select to_jsonb(r)-'created_at' from public.question_results r where question_id=v_id),'{}'::jsonb);
  end if;
  return v_result;
end $$;
grant execute on function public.resolve_public_question(uuid,text) to anon,authenticated;

revoke all on function public.accept_brewing_upvote(uuid,uuid,text,text,uuid),
  public.get_brewing_device_allowance(uuid,uuid,text,text),public.accept_brewing_submission(uuid,uuid,text,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.accept_brewing_upvote(uuid,uuid,text,text,uuid),
  public.get_brewing_device_allowance(uuid,uuid,text,text),public.accept_brewing_submission(uuid,uuid,text,text,text,uuid,uuid) to service_role;

-- Only publicly available questions before the boundary can win, including after moderation outages.
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
    where s.status = 'open' and s.submitted_on < v_day and s.published_at < v_boundary
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

create or replace function public.remove_brewing_question(p_expected_user uuid, p_submission_id uuid, p_reason text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_role text; v_question public.question_submissions%rowtype;
  v_started_day date := (clock_timestamp() at time zone 'utc')::date;
  v_existing private.community_removals%rowtype; v_reason text := btrim(p_reason); v_removed_at timestamptz;
begin
  perform private.assert_current_session();
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

create or replace function public.get_brewing_allowance() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_day date:=(clock_timestamp() at time zone 'utc')::date;
begin
  perform private.assert_current_session();
  return jsonb_build_object('server_time',clock_timestamp(),'resets_at',((v_day+1)::timestamp at time zone 'utc'),
    'submitted_question_id',(select id from public.question_submissions where author_id=auth.uid() and submitted_on=v_day),
    'upvoted_question_id',(select submission_id from private.account_upvote_allowance where account_id=auth.uid() and voted_on>=v_day));
end $$;

create or replace function private.ensure_daily_rollover(p_now timestamptz default clock_timestamp())
returns void language plpgsql security definer set search_path='' as $$
declare v_day date:=(p_now at time zone 'utc')::date;
begin
  if exists(select 1 from public.questions where status='live' and asked_on<v_day)
    or (not exists(select 1 from public.questions where asked_on=v_day and status in ('live','archived'))
      and exists(select 1 from public.question_submissions where status='open' and submitted_on<v_day
        and published_at<(v_day::timestamp at time zone 'utc'))) then
    perform private.finalize_daily_pulse(p_now);
  end if;
end $$;
