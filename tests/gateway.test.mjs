import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

test('actual gateway handler: fail closed, no writes before verification, strict responses, safe logs', async () => {
  const env = new Map(Object.entries({
    SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'publishable', SUPABASE_SERVICE_ROLE_KEY: 'secret',
    DEVICE_FINGERPRINT_PEPPER: 'pepper'.repeat(10),
    TURNSTILE_SECRET_KEY: 'provider-secret', TURNSTILE_EXPECTED_HOSTNAME: 'verify.example.com'
  }));
  let handler;
  const writes = [];
  const receiptReads = [];
  let receiptData = [];
  let receiptError = null;
  let registrationError = null;
  let voteError = null;
  let sessionError = null;
  const oldDeno = globalThis.Deno;
  const oldFetch = globalThis.fetch;
  const oldLog = console.log;
  const logs = [];
  globalThis.Deno = { env: { get: name => env.get(name) }, serve: callback => { handler = callback; } };
  globalThis.__pulseTestClient = { createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'verified-account' } }, error: sessionError }) },
    rpc: async (name, args) => {
      if (name === 'get_device_vote_receipt') {
        receiptReads.push(args);
        return { data: receiptData, error: receiptError };
      }
      writes.push({ name, args });
      return name === 'register_installation'
        ? { data: 'installation', error: registrationError }
        : { data: [{ status: 'ACCEPTED', receipt_id: 'receipt' }], error: voteError };
    }
  }) };
  console.log = line => logs.push(line);
  try {
    const source = readFileSync(new URL('../supabase/functions/vote/index.ts', import.meta.url), 'utf8');
    // Replace only the Deno package import; fail clearly if the handler stops using this dependency.
    const importPattern = /import\s*\{\s*createClient\s*\}\s*from\s*['"]npm:@supabase\/supabase-js@[^'"]+['"];?/g;
    assert.equal([...source.matchAll(importPattern)].length, 1, 'Expected one Supabase client import');
    const javascript = ts.transpileModule(
      source.replace(importPattern, 'const { createClient } = globalThis.__pulseTestClient;'),
      { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }
    ).outputText;
    await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
    assert.equal(typeof handler, 'function');
    const vote = { credential: 'DO-NOT-LOG-CREDENTIAL'.repeat(3),
      questionId: '20000000-0000-4000-8000-000000000001', choice: 'YES',
      idempotencyKey: '30000000-0000-4000-8000-000000000001',
      deviceEvidence: { platform: 'ios', deviceIdentifier: 'DO-NOT-LOG-DEVICE', deviceType: 'phone', isPhysicalDevice: true, isRooted: false } };
    const binding = createHash('sha256')
      .update(`${vote.credential}:${vote.questionId}:${vote.choice}:${vote.idempotencyKey}`).digest('hex');
    const proof = { ...vote, captchaBinding: binding, captchaToken: 'DO-NOT-LOG-TOKEN' };
    const call = (payload, headers = {}) => handler(new Request('https://test/vote', {
      method: 'POST', headers, body: JSON.stringify(payload)
    }));
    const signedToken = `header.${Buffer.from(JSON.stringify({session_id:'40000000-0000-4000-8000-000000000001'})).toString('base64url')}.signature`;
    const verified = { challenge_ts: new Date().toISOString(), success: true, action: 'pulse-vote', hostname: 'verify.example.com', cdata: binding };
    let providerCalls = 0;
    globalThis.fetch = async (url, options) => {
      providerCalls++;
      assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
      assert.equal(options.method, 'POST');
      assert.equal(options.body.get('secret'), 'provider-secret');
      assert.equal(options.body.get('response'), proof.captchaToken);
      return Response.json(verified);
    };
    assert.equal((await handler(new Request('https://test/vote'))).status, 405);
    for (const name of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'DEVICE_FINGERPRINT_PEPPER']) {
      const value = env.get(name);
      env.delete(name);
      assert.equal((await call(proof)).status, 503);
      env.set(name, value);
    }
    assert.equal((await handler(new Request('https://test/vote', { method: 'POST', body: '{' }))).status, 400);
    for (const payload of [null, [], {}, { ...proof, operation: 'unknown' }, { ...proof, choice: 'MAYBE' }]) {
      assert.equal((await call(payload)).status, 400);
    }
    assert.equal((await call({ ...proof, deviceEvidence: { ...vote.deviceEvidence, isPhysicalDevice: false } })).status, 403);
    for (const field of ['credential', 'questionId', 'choice', 'idempotencyKey']) {
      assert.equal((await call({ ...proof, [field]: field === 'choice' ? 'NO' : 'substituted' })).status, 403);
    }
    assert.equal(providerCalls, 0, 'Reject invalid binding before contacting the provider');
    for (const name of ['TURNSTILE_SECRET_KEY', 'TURNSTILE_EXPECTED_HOSTNAME']) {
      const value = env.get(name);
      env.delete(name);
      assert.equal((await call(proof)).status, 403);
      env.set(name, value);
    }
    for (const change of [{ challenge_ts: 'invalid' }, { challenge_ts: new Date(Date.now() - 301000).toISOString() }, { challenge_ts: new Date(Date.now() + 31000).toISOString() }, { success: false }, { action: 'other' }, { hostname: 'other.example.com' }, { cdata: 'other' }]) {
      globalThis.fetch = async () => Response.json({ ...verified, ...change });
      const response = await call(proof);
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, 'CAPTCHA_REQUIRED');
    }
    globalThis.fetch = async () => new Response('', { status: 503 });
    assert.equal((await call(proof)).status, 403);
    // An upstream transport exception rejects the handler; Supabase returns an error, never a vote success.
    globalThis.fetch = async () => { throw new Error('sensitive provider error'); };
    await assert.rejects(call(proof), /sensitive provider error/);
    assert.equal(writes.length, 0, 'No database calls before successful verification');

    // Clearing storage creates a new credential, not a new stable device identity.
    const statusRequest = { operation: 'status', credential: vote.credential,
      deviceEvidence: vote.deviceEvidence, questionId: vote.questionId, accountId: 'untrusted-account' };
    env.delete('TURNSTILE_SECRET_KEY');
    assert.deepEqual(await (await call(statusRequest)).json(), { status: 'NOT_VOTED' });
    receiptData = [{ receipt_id: 'original-receipt', accepted_choice: 'YES', accepted_at: '2026-10-20T12:00:00Z' }];
    const recovered = await call({ ...statusRequest, credential: 'new-credential-after-clear'.repeat(2) });
    assert.deepEqual(await recovered.json(), { ...receiptData[0], status: 'ALREADY_VOTED' });
    assert.equal(receiptReads[0].p_account_id, null);
    assert.equal(receiptReads[0].p_device_fingerprint_hash, receiptReads[1].p_device_fingerprint_hash);
    assert.notEqual(receiptReads[0].p_credential, receiptReads[1].p_credential);
    assert.equal(writes.length, 0, 'Receipt restoration must never register or submit a vote');
    receiptError = { code: '42883', message: 'DO-NOT-LOG-database-details' };
    assert.equal((await call(statusRequest)).status, 503, 'Missing migration must not look like NOT_VOTED');
    receiptError = null;
    for (const invalid of [null, {}, [null], [{}], [{ accepted_choice: 'YES' }], [{}, {}]]) {
      receiptData = invalid;
      assert.equal((await call(statusRequest)).status, 503, 'Malformed RPC response must not look like NOT_VOTED');
    }
    receiptData = [];
    const readsBeforeInvalidDevice = receiptReads.length;
    assert.equal((await call({ ...statusRequest, deviceEvidence: {} })).status, 403);
    assert.equal(receiptReads.length, readsBeforeInvalidDevice);
    sessionError = { message: 'invalid session' };
    assert.equal((await call(statusRequest, { Authorization: `Bearer ${signedToken}` })).status, 401);
    assert.equal(receiptReads.length, readsBeforeInvalidDevice);
    sessionError = null;
    assert.equal((await call(statusRequest, { Authorization: `Bearer ${signedToken}` })).status, 200);
    assert.equal(receiptReads.at(-1).p_account_id, 'verified-account');
    env.set('TURNSTILE_SECRET_KEY', 'provider-secret');

    globalThis.fetch = async () => Response.json(verified);
    const accepted = await call({ ...proof, accountId: 'untrusted-account' });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { status: 'ACCEPTED', receipt_id: 'receipt' });
    assert.deepEqual(writes.map(write => write.name), ['register_installation', 'submit_vote']);
    assert.equal(writes[0].args.p_account_id, null, 'Ignore client-supplied account identity');
    assert.match(writes[0].args.p_device_fingerprint_hash, /^[a-f0-9]{64}$/);
    assert.notEqual(writes[0].args.p_device_fingerprint_hash, vote.deviceEvidence.deviceIdentifier);
    assert.deepEqual(writes[1].args, { p_credential: vote.credential, p_account_id: null,
      p_session_id: null, p_question_id: vote.questionId, p_choice: vote.choice, p_idempotency_key: vote.idempotencyKey });

    writes.length = 0;
    sessionError = { message: 'invalid session' };
    assert.equal((await call(proof, { Authorization: `Bearer ${signedToken}` })).status, 401);
    assert.equal(writes.length, 0);
    sessionError = null;
    assert.equal((await call(proof, { Authorization: `Bearer ${signedToken}` })).status, 200);
    assert.equal(writes[0].args.p_account_id, 'verified-account');

    writes.length = 0;
    registrationError = { code: 'P0001', message: 'DO-NOT-LOG-database-details' };
    assert.equal((await call(proof)).status, 403);
    assert.deepEqual(writes.map(write => write.name), ['register_installation']);
    registrationError = null;
    voteError = { code: 'P0001', message: 'DO-NOT-LOG-database-details' };
    assert.equal((await call(proof)).status, 400);
    assert.ok(logs.length > 0);
    for (const line of logs) {
      assert.equal(line.includes('DO-NOT-LOG'), false);
      assert.equal(line.includes('sensitive'), false);
      const entry = JSON.parse(line);
      assert.equal(typeof entry.event, 'string');
      assert.match(entry.requestId, /^[a-f0-9-]{36}$/);
      assert.ok(Number.isFinite(Date.parse(entry.timestamp)));
      for (const key of Object.keys(entry)) {
        assert.ok(['event', 'requestId', 'timestamp', 'reason', 'code', 'status'].includes(key), `Unexpected log field: ${key}`);
      }
    }
  } finally {
    globalThis.Deno = oldDeno;
    globalThis.fetch = oldFetch;
    console.log = oldLog;
    delete globalThis.__pulseTestClient;
  }
});
