import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const migrationsDirectory = path.resolve('supabase/migrations');
const expectedMigration = '202610120001_baseline.sql';
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith('.sql'))
  .sort();

if (migrationFiles.length !== 1 || migrationFiles[0] !== expectedMigration) {
  throw new Error(
    `Expected exactly ${expectedMigration}; found: ${migrationFiles.join(', ') || 'none'}`,
  );
}

const baseline = await readFile(path.join(migrationsDirectory, expectedMigration), 'utf8');
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
  if (baseline.toLowerCase().includes(object)) {
    throw new Error(`Baseline restored a retired object: ${object}`);
  }
}

console.log('Database baseline guard passed: one migration, RLS, and finalized-only reads.');
