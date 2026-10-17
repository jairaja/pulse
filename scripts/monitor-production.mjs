import { appendFileSync, readFileSync } from 'node:fs';
import { databaseClient } from './ops-db.mjs';
import { evaluateHealth } from './ops-policy.mjs';
import { publishAlerts } from './ops-alerts.mjs';

const publish = process.argv.includes('--publish');
const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : 'manual run';
const alerts = [];
try {
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!ref || !/^[a-z0-9]+$/.test(ref)) throw new Error('Not configured');
  const response = await fetch(`https://${ref}.supabase.co/functions/v1/vote`, {
    method: 'GET', signal: AbortSignal.timeout(10000)
  });
  if (response.status !== 405 || (await response.json()).error !== 'Method not allowed.') throw new Error('Probe failed');
} catch {
  alerts.push({ code: 'GATEWAY_PROBE', severity: 'critical', message: 'Independent gateway reachability probe failed.' });
}
let health, gateway;
let db;
try {
  db = databaseClient(process.env.OPS_DATABASE_URL);
  await db.connect();
  await db.query('begin read only');
  health = (await db.query(readFileSync(new URL('../ops/health.sql', import.meta.url), 'utf8'))).rows[0];
  await db.query('rollback');
} catch {
  alerts.push({ code: 'DATABASE_MONITOR', severity: 'critical', message: 'Database health check failed; inspect private infrastructure logs.' });
} finally { await db?.end().catch(() => {}); }

try {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !/^[a-z0-9]+$/.test(ref) || !token) throw new Error('Not configured');
  const end = new Date(Date.now() - 120_000); // permit log ingestion delay
  const url = new URL(`https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs`);
  url.searchParams.set('sql', readFileSync(new URL('../ops/gateway-metrics.sql', import.meta.url), 'utf8'));
  url.searchParams.set('iso_timestamp_start', new Date(end.getTime() - 900_000).toISOString());
  url.searchParams.set('iso_timestamp_end', end.toISOString());
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Logs unavailable');
  const data = await response.json();
  if (data.error || !Array.isArray(data.result) || data.result.length !== 1) throw new Error('Invalid log query response');
  gateway = data.result[0];
  if (health) alerts.push(...evaluateHealth(health, gateway));
} catch {
  alerts.push({ code: 'TELEMETRY_MONITOR', severity: 'critical', message: 'Gateway telemetry could not be evaluated.' });
  if (health) alerts.push(...evaluateHealth(health, null));
}

const report = { timestamp: new Date().toISOString(), health, gateway, alerts };
console.log(JSON.stringify(report));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  `## PULSE operations\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`);

async function github(path, method = 'GET', body) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || !process.env.GITHUB_TOKEN) throw new Error('GitHub alerts not configured');
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    method, headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('GitHub alert delivery failed');
  return response.json();
}
if (publish && alerts.length) {
  // One incident per condition/day. Never auto-close: an operator must verify recovery.
  await publishAlerts(alerts, { github, runUrl, assignee: process.env.OPS_ALERT_ASSIGNEE });
}
if (process.env.OPS_HEARTBEAT_URL && !alerts.length) {
  const url = new URL(process.env.OPS_HEARTBEAT_URL);
  if (url.protocol !== 'https:') throw new Error('Heartbeat requires HTTPS');
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Heartbeat delivery failed');
}
if (alerts.length) process.exitCode = 1;
