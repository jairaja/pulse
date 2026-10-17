import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const migrationsDirectory = path.resolve('supabase/migrations');
const expectedMigrations = [
  '202610120001_baseline.sql',
  '202610160001_secure_voting.sql',
  '202610170001_operations_finalization_history.sql',
  '202610180001_device_fingerprint.sql',
  '202610190001_operational_monitoring.sql',
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
const operations = await readFile(path.join(migrationsDirectory, expectedMigrations[2]), 'utf8');
const deviceFingerprint = await readFile(path.join(migrationsDirectory, expectedMigrations[3]), 'utf8');
const monitoring = await readFile(path.join(migrationsDirectory, expectedMigrations[4]), 'utf8');
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
  if (`${baseline}\n${secureVoting}\n${operations}\n${deviceFingerprint}\n${monitoring}`.toLowerCase().includes(object)) {
    throw new Error(`Baseline restored a retired object: ${object}`);
  }
}

for (const statement of [
  'create or replace function public.get_operational_health',
  'grant execute on function public.get_operational_health() to service_role'
]) {
  if (!monitoring.toLowerCase().includes(statement)) {
    throw new Error(`Monitoring migration is missing required SQL: ${statement}`);
  }
}

for (const statement of [
  'add column device_fingerprint_hash text',
  'create unique index installations_device_fingerprint_hash_key',
  'create function public.register_installation',
  'grant execute on function public.register_installation(text, uuid, text) to service_role'
]) {
  if (!deviceFingerprint.toLowerCase().includes(statement)) {
    throw new Error(`Device fingerprint migration is missing required SQL: ${statement}`);
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

const requiredOperations = [
  'create table private.runtime_controls',
  'create table private.account_vote_history',
  'create or replace function public.claim_installation_history',
  'create or replace function public.list_my_vote_history',
  'create or replace function private.finalize_daily_pulse',
  "cron.schedule('pulse-daily-finalization', '0 12 * * *'",
  'grant execute on function public.submit_vote(text, uuid, uuid, text, uuid) to service_role'
];
for (const statement of requiredOperations) {
  if (!operations.toLowerCase().includes(statement)) {
    throw new Error(`Operations migration is missing required SQL: ${statement}`);
  }
}

const voteFunction = await readFile(path.resolve('supabase/functions/vote/index.ts'), 'utf8');
const supabaseConfig = await readFile(path.resolve('supabase/config.toml'), 'utf8');
for (const statement of [
  "auth.getUser(bearer)",
  "admin.rpc('submit_vote'",
  "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')",
  "Deno.env.get('DEVICE_FINGERPRINT_PEPPER')",
  'p_device_fingerprint_hash: deviceFingerprintHash',
  "Deno.env.get('TURNSTILE_EXPECTED_HOSTNAME')",
  'result.cdata === expectedCdata'
]) {
  if (!voteFunction.includes(statement)) throw new Error(`Vote gateway is missing: ${statement}`);
}
if (!supabaseConfig.includes('[functions.vote]') || !supabaseConfig.includes('verify_jwt = false')) {
  throw new Error('Vote gateway must use explicit in-function JWT verification.');
}
if (!supabaseConfig.includes('[functions.turnstile-challenge]') || !supabaseConfig.includes('[functions.operational-health]')) {
  throw new Error('Turnstile and operational health functions must be explicitly configured.');
}

console.log('Database guard passed: baseline, gateway-only voting, finalization, and account history.');
