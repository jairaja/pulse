-- Test-only helpers. Never installed by migrations or callable in the application.
create function pg_temp.enroll_sessions() returns void language plpgsql as $$
declare u record; d uuid;
begin
 for u in select id from auth.users where email_confirmed_at is not null loop
  d:=public.register_installation(u.id::text,null,encode(extensions.digest(convert_to(u.id::text,'utf8'),'sha256'),'hex'));
  insert into private.account_sessions values(u.id,u.id,d,clock_timestamp(),clock_timestamp()) on conflict do nothing;
 end loop;
end $$;
create function pg_temp.test_user(p_user text) returns text language plpgsql as $$ begin
 perform set_config('request.jwt.claim.sub',p_user,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'session_id',p_user,'role','authenticated')::text,true);
 return p_user;
end $$;
create function pg_temp.gateway_upvote(p_id uuid) returns jsonb language sql security definer as $$
 select public.accept_brewing_upvote(auth.uid(),auth.uid(),auth.uid()::text,
  encode(extensions.digest(convert_to(auth.uid()::text,'utf8'),'sha256'),'hex'),p_id);
$$;
create function pg_temp.gateway_submit_published_fixture(p_text text) returns uuid language plpgsql security definer as $$
declare q uuid;
begin
 q:=public.accept_brewing_submission(auth.uid(),auth.uid(),auth.uid()::text,
  encode(extensions.digest(convert_to(auth.uid()::text,'utf8'),'sha256'),'hex'),p_text,md5(auth.uid()::text||p_text)::uuid);
 -- Legacy quota/feed suites assume already-published content. The pending/review flow has its own suite.
 update public.question_submissions set status='open',published_at=created_at where id=q;
 return q;
end $$;
