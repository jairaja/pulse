import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

test('actual gateway handler: fail closed, no writes before verification, strict responses, safe logs', async () => {
  const env = new Map(Object.entries({
    SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'publishable', SUPABASE_SERVICE_ROLE_KEY: 'secret',
    DEVICE_FINGERPRINT_PEPPER: 'pepper'.repeat(10), CAPTCHA_CHALLENGE_SECRET: 'signing-secret'.repeat(4),
    TURNSTILE_SECRET_KEY: 'provider-secret', TURNSTILE_HOSTNAMES: 'verify.example.com'
  }));
  let handler;
  let writes = 0;
  const oldDeno = globalThis.Deno;
  const oldFetch = globalThis.fetch;
  const oldLog = console.log;
  const logs = [];
  globalThis.Deno = { env: { get: name => env.get(name) }, serve: callback => { handler = callback; } };
  globalThis.__pulseTestClient = { createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'account' } }, error: null }) },
    rpc: async name => { writes++; return { data: name === 'register_installation' ? 'installation' : [{ status: 'ACCEPTED' }], error: null }; }
  }) };
  console.log = line => logs.push(line);
  try {
    const source = readFileSync(new URL('../supabase/functions/vote/index.ts', import.meta.url), 'utf8')
      .replace("import { createClient } from 'npm:@supabase/supabase-js@2.118.0';", 'const { createClient } = globalThis.__pulseTestClient;')
      .replace("'./captcha.ts'", JSON.stringify(new URL('../supabase/functions/vote/captcha.ts', import.meta.url).href));
    const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText;
    await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
    const vote = { credential: 'DO-NOT-LOG-CREDENTIAL'.repeat(3),
      questionId: '20000000-0000-4000-8000-000000000001', choice: 'YES',
      idempotencyKey: '30000000-0000-4000-8000-000000000001',
      deviceEvidence: { platform: 'ios', deviceIdentifier: 'DO-NOT-LOG-DEVICE', deviceType: 'phone', isPhysicalDevice: true, isRooted: false } };
    const call = payload => handler(new Request('https://test/vote', { method: 'POST', body: JSON.stringify(payload) }));
    assert.equal((await handler(new Request('https://test/vote'))).status, 405);
    env.delete('TURNSTILE_SECRET_KEY');
    assert.equal((await call({ ...vote, operation: 'challenge' })).status, 503);
    env.set('TURNSTILE_SECRET_KEY', 'provider-secret');
    for (const payload of [null, [], {}, { ...vote, questionId: 'wrong' }]) assert.equal((await call(payload)).status, 400);
    assert.equal((await call({ ...vote, credential: 'x'.repeat(17000) })).status, 413);
    const challenge = await (await call({ ...vote, operation: 'challenge' })).json();
    assert.equal(challenge.required, true);
    assert.equal(writes, 0);
    const proof = { ...vote, captchaChallenge: challenge.challenge, captchaToken: 'DO-NOT-LOG-TOKEN' };
    globalThis.fetch = async () => Response.json({ success: true, action: 'pulse-vote', hostname: 'verify.example.com', cdata: challenge.cdata, challenge_ts: new Date().toISOString() });
    assert.equal((await call({ ...proof, choice: 'NO' })).status, 403);
    assert.equal(writes, 0);
    const another = await (await call({ ...vote, operation: 'challenge' })).json();
    assert.notEqual(another.cdata, challenge.cdata);
    assert.equal((await call({ ...proof, captchaChallenge: another.challenge })).status, 403);
    assert.equal(writes, 0);
    assert.equal((await call(proof)).status, 200);
    assert.equal(writes, 2);
    globalThis.fetch = async () => { throw new Error('sensitive provider error'); };
    assert.equal((await call(proof)).status, 503);
    assert.equal(writes, 2);
    globalThis.fetch = async () => Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] });
    assert.equal((await call(proof)).status, 403);
    assert.equal(writes, 2);
    assert.ok(logs.length > 0);
    for (const log of logs) {
      assert.equal(log.includes('DO-NOT-LOG'), false);
      assert.equal(log.includes('sensitive'), false);
      assert.deepEqual(Object.keys(JSON.parse(log)).sort(), ['event', 'version', 'request_id', 'status', 'outcome', 'duration_ms', 'timestamp'].sort());
    }
  } finally {
    globalThis.Deno = oldDeno;
    globalThis.fetch = oldFetch;
    console.log = oldLog;
    delete globalThis.__pulseTestClient;
  }
});
