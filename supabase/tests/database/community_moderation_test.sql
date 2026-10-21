begin;
select no_plan();
insert into auth.users(id,email_confirmed_at) values
 ('73000000-0000-4000-8000-000000000001',now()),
 ('73000000-0000-4000-8000-000000000002',now()),
 ('73000000-0000-4000-8000-000000000003',now()),
 ('73000000-0000-4000-8000-000000000004',now());
insert into private.community_roles(user_id,role) values
 ('73000000-0000-4000-8000-000000000002','admin'),('73000000-0000-4000-8000-000000000003','superuser');
insert into public.question_submissions(id,author_id,question_text) values
 ('74000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','A question requiring moderator review?'),
 ('74000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000004','Another question for review?');
select ok(not has_table_privilege('authenticated','private.community_roles','INSERT'),'clients cannot grant themselves roles');
select ok(not has_table_privilege('authenticated','private.community_removals','SELECT'),'audit details are not public');
select ok(not has_function_privilege('anon','public.remove_brewing_question(uuid,uuid,text,uuid)','EXECUTE'),'guests cannot remove content');
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(public.get_my_community_role(),'member','normal user has no moderation power');
select throws_ok($$select public.remove_brewing_question('73000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001','Bad content','75000000-0000-4000-8000-000000000001')$$,'42501','Moderator access is required.','member cannot hide questions');
reset role;
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is(public.get_my_community_role(),'admin','admin is server recognized');
select throws_ok($$insert into public.questions(question_text,asked_on,status) values('Administrator cannot reserve tomorrow?',current_date+1,'scheduled')$$,'42501',null,'application admin has no direct schedule or winner-override privilege');
select throws_ok($$select public.remove_brewing_question('73000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000001','Bad content','75000000-0000-4000-8000-000000000001')$$,'42501','Moderator account mismatch.','stale account cannot act as new identity');
select throws_ok($$select public.remove_brewing_question('73000000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000001','  ','75000000-0000-4000-8000-000000000001')$$,'22023','Enter a removal reason of 5 to 1000 characters.','empty reason rejected');
select lives_ok($$select public.remove_brewing_question('73000000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000001','Inappropriate content','75000000-0000-4000-8000-000000000001')$$,'admin removes with reason');
select lives_ok($$select public.remove_brewing_question('73000000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000001','Inappropriate content','75000000-0000-4000-8000-000000000001')$$,'same request retry remains idempotent');
select throws_ok($$select public.remove_brewing_question('73000000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000002','Different reason','75000000-0000-4000-8000-000000000001')$$,'22023','This removal request conflicts with an earlier request.','request cannot be rebound to different question');
reset role;
select is((select status from public.question_submissions where id='74000000-0000-4000-8000-000000000001'),'hidden','removal is a soft delete');
select is((select count(*)::integer from private.community_removals),1,'only one private audit record');
select is((select reason from private.community_removals),'Inappropriate content','reason is preserved');
select is((select moderator_id from private.community_removals),'73000000-0000-4000-8000-000000000002'::uuid,'actor identity is audited');
select is((select submitter_id from private.community_removals),'73000000-0000-4000-8000-000000000001'::uuid,'submitter identity is audited');
select is((select moderator_role from private.community_removals),'admin','actor role is snapshotted');
select throws_ok($$update private.community_removals set reason='Rewrite audit'$$,'42501','Removal audit is append-only.','audit cannot be rewritten');
set local role anon;
select is((select count(*)::integer from public.list_brewing_submissions() where id='74000000-0000-4000-8000-000000000001'),0,'hidden question absent from old public list');
reset role;
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select throws_ok($$select public.submit_brewing_question('Can I replace my removed question today?')$$,'P0001','You already submitted a question today. Try again at 00:00 UTC.','removal never refunds daily submission allowance');
reset role;
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is(public.get_my_community_role(),'superuser','superuser is recognized');
select lives_ok($$select public.remove_brewing_question('73000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000002','Another valid reason','75000000-0000-4000-8000-000000000002')$$,'superuser has same moderation capability');
reset role;
insert into public.question_submissions(id,author_id,question_text,submitted_on,status)
values('74000000-0000-4000-8000-000000000003','73000000-0000-4000-8000-000000000004','Already selected daily question?',current_date-1,'selected');
set local role authenticated;
select throws_ok($$select public.remove_brewing_question('73000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000003','Do not remove live polls','75000000-0000-4000-8000-000000000003')$$,'22023','This question is no longer available in Brewing.','moderators cannot remove selected/live/historical questions through Brewing');
reset role;
delete from private.community_roles where user_id='73000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select throws_ok($$select public.remove_brewing_question('73000000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000001','Inappropriate content','75000000-0000-4000-8000-000000000001')$$,'42501','Moderator access is required.','revoked admin cannot act even with stale UI');
reset role;
select throws_ok($$delete from private.community_removals where submission_id='74000000-0000-4000-8000-000000000001'$$,'42501','Removal audit is append-only.','audit cannot be deleted');
delete from auth.users where id='73000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from private.community_removals where submission_id='74000000-0000-4000-8000-000000000001'),1,'audit survives later deletion of the submitter and question');
select * from finish();
rollback;
