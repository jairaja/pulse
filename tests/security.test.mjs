import assert from 'node:assert/strict';
import { test } from 'node:test';
import { issueChallenge, verifyChallenge, verifyTurnstile } from '../supabase/functions/vote/captcha.ts';
import { evaluateHealth } from '../scripts/ops-policy.mjs';

const binding = { credential: 'installation-secret'.repeat(3), questionId: 'question', choice: 'YES',
  idempotencyKey: 'retry-key', deviceFingerprintHash: 'device', accountId: null, sessionHash: 'anonymous' };
const secret = 'test-secret'.repeat(5);
const now = 1792230000000;
test('challenge rejects every substituted vote field and tampering; expires strictly', async () => {
  const value = await issueChallenge(binding, secret, now);
  assert.notEqual(value.cdata, (await issueChallenge(binding, secret, now)).cdata);
  assert.equal(await verifyChallenge(value.challenge, binding, secret, now), true);
  for (const field of Object.keys(binding)) {
    assert.equal(await verifyChallenge(value.challenge, { ...binding, [field]: 'substituted' }, secret, now), false, field);
  }
  assert.equal(await verifyChallenge(value.challenge, binding, 'other secret', now), false);
  assert.equal(await verifyChallenge(value.challenge + '.extra', binding, secret, now), false);
  assert.equal(await verifyChallenge(value.challenge, binding, secret, now + 120000), false);
  assert.equal(await verifyChallenge(value.challenge, binding, secret, now - 1), false);
  for (const invalid of [null, {}, '', 'a.b.c.d', value.challenge.replace(/.$/, 'z')]) {
    assert.equal(await verifyChallenge(invalid, binding, secret, now), false);
  }
});
const success = { success: true, hostname: 'verify.example.com', action: 'pulse-vote',
  cdata: 'binding', challenge_ts: new Date(now).toISOString() };
const fetchResult = result => async () => Response.json(result);
test('Siteverify requires success, exact host, action, binding, and a current timestamp', async () => {
  const verify = result => verifyTurnstile('single-use-token', 'binding', secret, ['verify.example.com'], fetchResult(result), now);
  assert.equal(await verify(success), true);
  for (const change of [{ success: false }, { action: undefined }, { action: 'login' }, { hostname: 'evil.example.com' },
    { hostname: undefined }, { cdata: 'other' }, { cdata: undefined }, { challenge_ts: undefined },
    { challenge_ts: new Date(now - 300001).toISOString() }, { challenge_ts: new Date(now + 30001).toISOString() }]) {
    assert.equal(await verify({ ...success, ...change }), false);
  }
  assert.equal(await verifyTurnstile(null, 'binding', secret, [], fetchResult(success), now), false);
  await assert.rejects(verifyTurnstile('single-use-token', 'binding', secret, [], async () => { throw new Error('timeout'); }));
  await assert.rejects(verifyTurnstile('single-use-token', 'binding', secret, [], async () => new Response('', { status: 503 })));
});
test('concurrent reuse is rejected by Siteverify; gateway does not cache a successful token', async () => {
  const used = new Set();
  const provider = async (_url, options) => {
    const token = options.body.get('response');
    const accepted = !used.has(token);
    used.add(token);
    return Response.json({ ...success, success: accepted });
  };
  const results = await Promise.all(Array.from({ length: 100 }, () =>
    verifyTurnstile('single-use-token', 'binding', secret, ['verify.example.com'], provider, now)));
  assert.equal(results.filter(Boolean).length, 1);
});
const healthy = { utc_hour: 14, utc_minute: 0, current_live_questions: 1, overdue_questions: 0,
  tomorrow_questions: 1, voting_enabled: true, finalizer_jobs: 1, finalizer_status: 'succeeded', finalizer_age_seconds: 7200 };
test('operational policy catches outages and does not report low-volume ratios as abuse', () => {
  assert.deepEqual(evaluateHealth(healthy, { requests: 1, p95_ms: 4000, server_errors: 1 }), []);
  for (const [field, value, code] of [['current_live_questions', 0, 'LIVE_QUESTION'], ['overdue_questions', 1, 'FINALIZATION_LAG'],
    ['tomorrow_questions', 0, 'QUESTION_QUEUE'], ['voting_enabled', false, 'VOTING_DISABLED'],
    ['finalizer_jobs', 0, 'SCHEDULER_CONFIG'], ['finalizer_status', 'failed', 'SCHEDULER_FAILED'],
    ['finalizer_age_seconds', null, 'SCHEDULER_STALE']]) {
    assert.ok(evaluateHealth({ ...healthy, [field]: value }, null).some(a => a.code === code));
  }
  assert.ok(!evaluateHealth({ ...healthy, utc_hour: 12, utc_minute: 14, current_live_questions: 0 }, null).some(a => a.code === 'LIVE_QUESTION'));
  const alerts = evaluateHealth(healthy, { requests: 100, p95_ms: 4000, server_errors: 10,
    captcha_outages: 3, captcha_rejections: 70, rate_limited: 25 });
  for (const code of ['GATEWAY_ERRORS', 'GATEWAY_LATENCY', 'CAPTCHA_OUTAGE', 'CAPTCHA_REJECTIONS', 'ABUSE_BURST']) {
    assert.ok(alerts.some(a => a.code === code));
  }
  assert.ok(evaluateHealth(healthy, { requests: 0, p95_ms: 0 }).some(a => a.code === 'TELEMETRY_EMPTY'));
});
