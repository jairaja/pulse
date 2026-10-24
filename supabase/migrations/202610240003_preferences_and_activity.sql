alter table public.user_preferences add column options jsonb not null default '{}'::jsonb;
create function private.valid_preference_options(p jsonb) returns boolean language sql immutable set search_path='' as $$
  select jsonb_typeof(p)='object' and not exists(select 1 from jsonb_each(p) e where
    (e.key in ('brewingView','resultsView') and e.value not in ('"list"'::jsonb,'"grid"'::jsonb))
    or (e.key in ('largerText','highContrast','reduceMotion') and jsonb_typeof(e.value)<>'boolean')
    or e.key not in ('brewingView','resultsView','largerText','highContrast','reduceMotion'));
$$;
alter table public.user_preferences add constraint valid_options check(private.valid_preference_options(options));
drop function public.ensure_user_preferences(uuid,text,text);
drop function public.update_user_preferences(uuid,text,text);
create function public.ensure_user_preferences(p_expected_user uuid,p_language text,p_theme text,p_options jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.user_preferences%rowtype;
begin
  perform private.assert_current_session();
  if p_expected_user is distinct from auth.uid() then raise exception using errcode='42501',message='Preference account mismatch.'; end if;
  if (p_language is not null and p_language not in ('en','zh-Hans','hi','es','ar','fr','bn','pt','ru','ur'))
    or (p_theme is not null and p_theme not in ('system','light','dark')) then
    raise exception using errcode='22023',message='Unsupported preference.';
  end if;
  if p_options is null or not private.valid_preference_options(p_options) then raise exception using errcode='22023',message='Unsupported preference.'; end if;
  insert into public.user_preferences(user_id,language,theme,options) values(auth.uid(),p_language,p_theme,p_options) on conflict do nothing;
  select * into r from public.user_preferences where user_id=auth.uid();
  return jsonb_build_object('language',r.language,'theme',r.theme)||r.options;
end $$;
create function public.update_user_preferences(p_expected_user uuid,p_language text default null,p_theme text default null,p_options jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.user_preferences%rowtype;
begin
  perform private.assert_current_session();
  if p_expected_user is distinct from auth.uid() then raise exception using errcode='42501',message='Preference account mismatch.'; end if;
  if (p_language is not null and p_language not in ('en','zh-Hans','hi','es','ar','fr','bn','pt','ru','ur'))
    or (p_theme is not null and p_theme not in ('system','light','dark')) then
    raise exception using errcode='22023',message='Unsupported preference.';
  end if;
  if p_options is null or not private.valid_preference_options(p_options) then raise exception using errcode='22023',message='Unsupported preference.'; end if;
  update public.user_preferences set language=coalesce(p_language,language),theme=coalesce(p_theme,theme),
    options=options||p_options,updated_at=clock_timestamp() where user_id=auth.uid() returning * into r;
  if not found then raise exception 'Initialize preferences before updating.'; end if;
  return jsonb_build_object('language',r.language,'theme',r.theme)||r.options;
end $$;
grant execute on function public.ensure_user_preferences(uuid,text,text,jsonb),public.update_user_preferences(uuid,text,text,jsonb) to authenticated;

-- Keep one logical votes table; finalized snapshots serve public counts without per-card raw COUNTs.
create index account_history_time_lookup on private.account_vote_history(account_id,linked_at desc,question_id);
create function public.my_pulse_activity(p_kind text default 'answers',p_before timestamptz default null,p_before_id uuid default null,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_rows jsonb; v_items jsonb; v_last jsonb; v_stats jsonb;
begin
  perform private.assert_current_session();
  if p_kind not in ('answers','upvotes','questions') or p_limit not between 1 and 50 then raise exception 'Invalid history request.'; end if;
  with activity as (
    select v.id,q.id as question_id,q.question_text,v.accepted_at as happened_at,v.choice,
      'question'::text as link_kind,case when q.status='live' then 'today' else 'past-results' end as destination,
      r.result as final_result,r.total_votes,r.yes_count,r.no_count,null::text as status
    from private.account_vote_history h join public.votes v on v.id=h.vote_id
    join public.questions q on q.id=v.question_id left join public.question_results r on r.question_id=q.id
    where p_kind='answers' and h.account_id=v_user
    union all
    select v.id,s.id,s.question_text,v.created_at,null,'submission','brewing',null,null,null,null,s.status
    from public.submission_votes v join public.question_submissions s on s.id=v.submission_id
    where p_kind='upvotes' and v.voter_id=v_user
    union all
    select s.id,s.id,s.question_text,s.created_at,null,'submission','brewing',null,null,null,null,s.status
    from public.question_submissions s where p_kind='questions' and s.author_id=v_user
  ), page as (
    select * from activity where p_before is null or (happened_at,id)<(p_before,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    order by happened_at desc,id desc limit p_limit+1
  ) select coalesce(jsonb_agg(to_jsonb(page)),'[]') into v_rows from page;
  select coalesce(jsonb_agg(value order by ord),'[]') into v_items from jsonb_array_elements(v_rows) with ordinality a(value,ord) where ord<=p_limit;
  if jsonb_array_length(v_rows)>p_limit then v_last:=v_items->(p_limit-1); end if;
  select jsonb_build_object('answers',count(*),'eligible',count(*) filter(where r.result in ('YES','NO')),
    'aligned',count(*) filter(where r.result=v.choice)) into v_stats
    from private.account_vote_history h join public.votes v on v.id=h.vote_id
    left join public.question_results r on r.question_id=v.question_id where h.account_id=v_user;
  v_stats:=v_stats||jsonb_build_object('upvotes',(select count(*) from public.submission_votes where voter_id=v_user),
    'questions',(select count(*) from public.question_submissions where author_id=v_user),
    'selected',(select count(*) from public.question_submissions where author_id=v_user and status='selected'));
  return jsonb_build_object('items',v_items,'next',case when v_last is null then null else jsonb_build_object('time',v_last->>'happened_at','id',v_last->>'id') end,'stats',v_stats);
end $$;
grant execute on function public.my_pulse_activity(text,timestamptz,uuid,integer) to authenticated;

-- Guest My Pulse resolves a page in one public lookup, without one RPC/raw vote scan per card.
create function public.public_question_summaries(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_ids is null or cardinality(p_ids) not between 1 and 20 then return '[]'::jsonb; end if;
  perform private.ensure_daily_rollover(clock_timestamp());
  return (select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'text',q.question_text,'asked_on',q.asked_on,
    'destination',case when q.status='live' then 'today' else 'past-results' end)),'[]'::jsonb)
    from public.questions q where q.id=any(p_ids) and q.status in ('live','archived'));
end $$;
grant execute on function public.public_question_summaries(uuid[]) to anon,authenticated;

notify pgrst,'reload schema';
