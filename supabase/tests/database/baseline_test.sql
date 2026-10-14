begin;

select plan(18);

select has_table('public', 'questions', 'questions table exists');
select has_table('public', 'question_translations', 'translations table exists');
select has_table('public', 'installations', 'installations table exists');
select has_table('public', 'votes', 'votes table exists');
select has_table('public', 'question_results', 'immutable result snapshots exist');

select hasnt_table('public', 'users', 'legacy users table is absent');
select hasnt_table('public', 'predictions', 'predictions table is absent');
select hasnt_table('public', 'countries', 'country table is absent');
select hasnt_table('public', 'question_submissions', 'future submissions are not premature');
select hasnt_table('public', 'submission_votes', 'future submission votes are not premature');

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
    select bool_and(not p.prosecdef)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_today_question', 'list_finalized_results')
  ),
  'public RPCs use invoker security'
);
select has_index(
  'public',
  'question_translations',
  'question_translations_one_selected',
  'only one selected translation is allowed per language'
);

select * from finish();
rollback;
