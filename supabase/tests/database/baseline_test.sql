begin;

select plan(42);

select has_table('public', 'questions', 'questions table exists');
select has_table('public', 'question_translations', 'translations table exists');
select has_table('public', 'installations', 'installations table exists');
select has_table('public', 'votes', 'votes table exists');
select has_table('public', 'question_results', 'immutable result snapshots exist');

select hasnt_table('public', 'users', 'legacy users table is absent');
select hasnt_table('public', 'predictions', 'predictions table is absent');
select hasnt_table('public', 'countries', 'country table is absent');
select has_table('public', 'question_submissions', 'community submissions are available');
select has_table('public', 'submission_votes', 'community upvotes are available');

select has_function(
  'public',
  'get_today_question',
  array['text'],
  'today question RPC exists'
);
select has_function(
  'public',
  'list_finalized_results',
  array['text', 'integer', 'date'],
  'paginated finalized results RPC exists'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'questions',
        'question_translations',
        'installations',
        'votes',
        'question_results'
      )
      and c.relrowsecurity
  ),
  5,
  'RLS is enabled on every application table'
);

select ok(
  not has_table_privilege('anon', 'public.votes', 'INSERT'),
  'anonymous clients cannot insert votes directly'
);

insert into public.questions (id, question_text, asked_on, status)
values (
  '20000000-0000-4000-8000-000000000001',
  'Database test question?',
  (now() at time zone 'utc')::date,
  'live'
)
on conflict (asked_on) where status in ('live','archived') do update
set status = 'live', results_finalized_at = null;

select lives_ok(
  $$ select public.register_installation(
    'test-credential-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    null::uuid,
    repeat('a', 64)
  ) $$,
  'a valid opaque installation credential can be registered'
);
select is(
  public.register_installation('test-credential-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', null::uuid, repeat('a', 64)),
  public.register_installation('test-credential-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', null::uuid, repeat('a', 64)),
  'installation registration is idempotent'
);
select ok(
  not exists (
    select 1 from public.installations
    where token_hash = 'test-credential-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  ),
  'raw installation credentials are never stored'
);
select is(
  (
    select status from public.submit_vote(
      'test-credential-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      null,
      (select id from public.questions where asked_on = (now() at time zone 'utc')::date),
      'YES',
      '30000000-0000-4000-8000-000000000001'
    )
  ),
  'ACCEPTED',
  'a valid vote is accepted'
);
select is(
  (
    select status from public.submit_vote(
      'test-credential-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      null,
      (select id from public.questions where asked_on = (now() at time zone 'utc')::date),
      'YES',
      '30000000-0000-4000-8000-000000000001'
    )
  ),
  'ACCEPTED',
  'an idempotent retry returns the accepted receipt'
);
select is(
  (
    select status from public.submit_vote(
      'test-credential-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      null,
      (select id from public.questions where asked_on = (now() at time zone 'utc')::date),
      'NO',
      '30000000-0000-4000-8000-000000000002'
    )
  ),
  'ALREADY_VOTED',
  'an accepted vote cannot be changed'
);
select is(
  (
    select count(*)::integer from public.votes
    where installation_id = public.register_installation(
      'test-credential-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      null::uuid,
      repeat('a', 64)
    )
  ),
  1,
  'retries and conflicts create only one vote'
);
select ok(
  not has_table_privilege('authenticated', 'public.votes', 'SELECT'),
  'authenticated clients cannot read raw votes'
);
select ok(
  has_table_privilege('anon', 'public.questions', 'SELECT'),
  'anonymous clients can read questions subject to RLS'
);
select ok(
  (
    select bool_and(p.prosecdef and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%')
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_today_question', 'list_finalized_results')
  ),
  'public daily RPCs use a fixed search path for narrowly scoped rollover and reads'
);
select has_index(
  'public',
  'question_translations',
  'question_translations_one_selected',
  'only one selected translation is allowed per language'
);

select has_function(
  'public',
  'register_installation',
  array['text', 'uuid', 'text'],
  'installation registration RPC exists'
);
select has_function(
  'public',
  'submit_vote',
  array['text', 'uuid', 'uuid', 'text', 'uuid'],
  'idempotent vote RPC exists'
);
select has_table('private', 'vote_idempotency', 'vote idempotency records are private');
select has_table('private', 'vote_rate_limits', 'vote rate limits are private');
select has_index(
  'public',
  'installations',
  'installations_device_fingerprint_hash_key',
  'a platform fingerprint can map reinstall registration to one installation'
);
select is(
  public.register_installation(
    'test-credential-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', null::uuid, repeat('a', 64)
  ),
  (select installation_id from public.votes
   where question_id = (select id from public.questions
     where asked_on = (now() at time zone 'utc')::date)),
  'a replacement credential with the same fingerprint resolves to the existing installation'
);
select is(
  (
    select status from public.submit_vote(
      'test-credential-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      null,
      (select id from public.questions where asked_on = (now() at time zone 'utc')::date),
      'NO',
      '30000000-0000-4000-8000-000000000003'
    )
  ),
  'ALREADY_VOTED',
  'credential rotation after reinstall cannot create another vote for the same device fingerprint'
);
select ok(
  not has_table_privilege('anon', 'private.vote_idempotency', 'SELECT'),
  'anonymous clients cannot read idempotency records'
);
select ok(
  (
    select bool_and(
      p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
    )
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('register_installation', 'submit_vote')
  ),
  'privileged voting RPCs are definers with an empty search path'
);


select has_table('private', 'runtime_controls', 'runtime kill switch exists');
select has_table('private', 'account_vote_history', 'canonical account history links exist');
select has_function('public', 'claim_installation_history', array['text'], 'history claim RPC exists');
select has_function('public', 'list_my_vote_history', array['timestamp with time zone', 'integer'], 'account history RPC exists');
select has_function('private', 'finalize_daily_pulse', array['timestamp with time zone'], 'atomic daily finalizer exists');
select ok(
  not has_function_privilege('anon', 'public.submit_vote(text,uuid,uuid,text,uuid)', 'EXECUTE'),
  'anonymous clients cannot bypass the vote Edge Function'
);

select has_function('public', 'get_operational_health', array[]::text[], 'operational health RPC exists');
select ok(
  not has_function_privilege('anon', 'public.get_operational_health()', 'EXECUTE'),
  'anonymous clients cannot read operational health'
);

select * from finish();
rollback;
