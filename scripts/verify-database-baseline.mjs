import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const migrationsDirectory = path.resolve('supabase/migrations');
const expectedMigrations = [
  '202610120001_baseline.sql',
  '202610160001_secure_voting.sql',
];
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith('.sql'))
  .sort();

if (JSON.stringify(migrationFiles) !== JSON.stringify(expectedMigrations)) {
  const legacyFiles = migrationFiles.filter((file) => !expectedMigrations.includes(file));
  throw new Error(
    [
      `Expected exactly ${expectedMigrations.join(', ')}; found: ${migrationFiles.join(', ') || 'none'}.`,
      legacyFiles.length > 0
        ? 'The legacy files are real inputs to Supabase, not harmless cache files.'
        : 'A required reviewed migration is missing.',
      legacyFiles.length > 0
        ? 'Preview the allowlisted cleanup with "npm run db:baseline:clean", then run "npm run db:baseline:clean -- --apply".'
        : 'Restore the migrations from Git before running database commands.',
    ].join('\n'),
  );
}

const baseline = await readFile(path.join(migrationsDirectory, expectedMigrations[0]), 'utf8');
const secureVoting = await readFile(path.join(migrationsDirectory, expectedMigrations[1]), 'utf8');
const requiredStatements = [
  'alter table public.questions enable row level security',
  'alter table public.question_translations enable row level security',
  'alter table public.installations enable row level security',
  'alter table public.votes enable row level security',
  'alter table public.question_results enable row level security',
  'security invoker',
  'create table public.question_results',
  'revoke create on schema public from public',
  'alter default privileges in schema public revoke all on tables from anon, authenticated',
];
const forbiddenLegacyObjects = [
  'create table public.users',
  'create table public.predictions',
  'create table public.countries',
  'create table public.question_submissions',
  'create table public.submission_votes',
  'get_live_results',
];

for (const statement of requiredStatements) {
  if (!baseline.toLowerCase().includes(statement)) {
    throw new Error(`Baseline is missing required SQL: ${statement}`);
  }
}

for (const object of forbiddenLegacyObjects) {
  if (`${baseline}\n${secureVoting}`.toLowerCase().includes(object)) {
    throw new Error(`Baseline restored a retired object: ${object}`);
  }
}

const requiredVotingStatements = [
  'create table private.vote_idempotency',
  'create table private.vote_rate_limits',
  'security definer',
  "set search_path = ''",
  'create or replace function public.register_installation',
  'create or replace function public.submit_vote',
  'revoke all on function public.submit_vote',
];

for (const statement of requiredVotingStatements) {
  if (!secureVoting.toLowerCase().includes(statement)) {
    throw new Error(`Secure voting migration is missing required SQL: ${statement}`);
  }
}

console.log('Database guard passed: reviewed baseline, finalized-only reads, and secure voting RPCs.');
