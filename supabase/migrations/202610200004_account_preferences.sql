-- Account preference sync only; this does not change the number of allowed login sessions.
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null check(language in ('en','zh-Hans','hi','es','ar','fr','bn','pt','ru','ur')),
  theme text not null check(theme in ('system','light','dark')),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from public, anon, authenticated;

create function public.ensure_user_preferences(p_expected_user uuid, p_language text, p_theme text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.user_preferences%rowtype;
begin
  if auth.uid() is null or p_expected_user is null or auth.uid() <> p_expected_user then
    raise exception using errcode='42501', message='Preference account mismatch.';
  end if;
  if p_language is null or p_language not in ('en','zh-Hans','hi','es','ar','fr','bn','pt','ru','ur')
    or p_theme is null or p_theme not in ('system','light','dark') then
    raise exception using errcode='22023', message='Unsupported preference.';
  end if;
  insert into public.user_preferences(user_id, language, theme) values(auth.uid(),p_language,p_theme)
    on conflict(user_id) do nothing;
  select * into r from public.user_preferences where user_id=auth.uid();
  return jsonb_build_object('language',r.language,'theme',r.theme);
end;
$$;
create function public.update_user_preferences(p_expected_user uuid, p_language text default null, p_theme text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.user_preferences%rowtype;
begin
  if auth.uid() is null or p_expected_user is null or auth.uid() <> p_expected_user then
    raise exception using errcode='42501', message='Preference account mismatch.';
  end if;
  if (p_language is not null and p_language not in ('en','zh-Hans','hi','es','ar','fr','bn','pt','ru','ur'))
    or (p_theme is not null and p_theme not in ('system','light','dark')) then
    raise exception using errcode='22023', message='Unsupported preference.';
  end if;
  update public.user_preferences set language=coalesce(p_language,language), theme=coalesce(p_theme,theme),
    updated_at=clock_timestamp() where user_id=auth.uid() returning * into r;
  if not found then raise exception using errcode='22023', message='Initialize preferences before updating.'; end if;
  return jsonb_build_object('language',r.language,'theme',r.theme);
end;
$$;
revoke all on function public.ensure_user_preferences(uuid,text,text), public.update_user_preferences(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ensure_user_preferences(uuid,text,text), public.update_user_preferences(uuid,text,text) to authenticated;
