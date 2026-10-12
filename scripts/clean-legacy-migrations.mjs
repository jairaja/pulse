import { access, rm } from 'node:fs/promises';
import path from 'node:path';

const apply = process.argv.includes('--apply');
const migrationsDirectory = path.resolve('supabase/migrations');
const legacyMigrations = [
  '202603070001_init.sql',
  '202610110001_phase1_final_results.sql',
  '202610110002_world_only_results.sql',
  '202610110003_public_past_results.sql',
];

const existing = [];
for (const file of legacyMigrations) {
  const absolutePath = path.join(migrationsDirectory, file);
  try {
    await access(absolutePath);
    existing.push({ absolutePath, file });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

if (existing.length === 0) {
  console.log('No allowlisted legacy migrations found. Nothing to clean.');
  process.exit(0);
}

console.log(`${apply ? 'Deleting' : 'Would delete'} only these superseded migrations:`);
for (const { file } of existing) console.log(`- supabase/migrations/${file}`);

if (!apply) {
  console.log('\nPreview only. Re-run with: npm run db:baseline:clean -- --apply');
  process.exit(0);
}

for (const { absolutePath } of existing) await rm(absolutePath);

console.log('\nCleanup complete. Run npm run verify:database, then commit any tracked deletions.');
