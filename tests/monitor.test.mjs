import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { publishAlerts } from '../scripts/ops-alerts.mjs';

test('missing monitor credentials produce explicit critical alerts and a nonzero exit, without external publication', () => {
  const result = spawnSync(process.execPath, ['scripts/monitor-production.mjs'], { encoding: 'utf8', timeout: 10000,
    env: { ...process.env, OPS_DATABASE_URL: '', SUPABASE_PROJECT_REF: '', SUPABASE_ACCESS_TOKEN: '',
      OPS_HEARTBEAT_URL: '', GITHUB_STEP_SUMMARY: '' } });
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).alerts.map(a => a.code).sort(), ['DATABASE_MONITOR', 'GATEWAY_PROBE', 'TELEMETRY_MONITOR']);
});
test('alert delivery deduplicates across pages and duplicate signals, assigns owner, and propagates delivery failures', async () => {
  const posted = [];
  const now = new Date('2026-10-17T15:00:00Z');
  const alert = code => ({ code, severity: 'critical', message: 'Sanitized failure' });
  const github = async (path, method, body) => {
    if (method === 'POST') { posted.push(body); return body; }
    if (path.endsWith('page=1')) return Array.from({ length: 100 }, () => ({ body: 'unrelated issue' }));
    return [{ body: '<!-- pulse-alert:EXISTING:2026-10-17 -->' }];
  };
  await publishAlerts([alert('EXISTING'), alert('NEW'), alert('NEW')], { github, now, runUrl: 'test-run', assignee: 'operator' });
  assert.equal(posted.length, 1);
  assert.deepEqual(posted[0].assignees, ['operator']);
  assert.ok(posted[0].body.includes('test-run'));
  await assert.rejects(publishAlerts([alert('NEW')], { github: async () => { throw new Error('delivery failed'); }, now }));
});
