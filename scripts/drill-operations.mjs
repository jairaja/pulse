import { readFileSync, writeFileSync } from 'node:fs';
import { databaseClient } from './ops-db.mjs';

if (process.env.OPS_ENVIRONMENT !== 'staging' || !process.env.OPS_STAGING_DATABASE_URL ||
    !process.env.OPS_STAGING_DB_HOST) throw new Error('Set staging environment, staging URL, and independently approved staging host');
const host = new URL(process.env.OPS_STAGING_DATABASE_URL).hostname;
if (host !== process.env.OPS_STAGING_DB_HOST) throw new Error('Staging host does not match allowlist');
const db = databaseClient(process.env.OPS_STAGING_DATABASE_URL);
let passed = false;
try {
  await db.connect();
  await db.query('begin');
  await db.query("set local lock_timeout = '2s'");
  await db.query("set local statement_timeout = '10s'");
  const before = (await db.query('select voting_enabled from private.runtime_controls where singleton')).rows[0];
  await db.query(readFileSync(new URL('../ops/drill.sql', import.meta.url), 'utf8'));
  await db.query('rollback');
  const after = (await db.query('select voting_enabled from private.runtime_controls where singleton')).rows[0];
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Rollback validation failed');
  passed = true;
} finally {
  await db.query('rollback').catch(() => {});
  await db.end().catch(() => {});
  const evidence = { timestamp: new Date().toISOString(), environment: 'staging', passed,
    checks: ['database kill-switch rejection', 'finalizer replay snapshot invariance', 'transaction rollback'],
    limitations: ['Does not demonstrate committed gateway shutdown', 'Does not rotate provider secrets', 'Does not demonstrate paging or deployment rollback'] };
  writeFileSync('ops-drill-evidence.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
}
