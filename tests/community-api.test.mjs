import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function client() {
  let response = { data: null, error: null };
  const calls = [];
  class PulseApiError extends Error { constructor(message, code) { super(message); this.code = code; } }
  const dependencies = { PulseApiError, supabaseConfigurationError: null,
    getInstallationCredential: async () => 'credential', collectClientDeviceEvidence: async () => ({ platform: 'ios' }),
    invokeAction: async (name, args) => { calls.push({ name, args }); if(response.error) throw new Error(response.error.message); return response.data; },
    supabase: { rpc: async (name, args) => { calls.push({ name, args }); return response; } } };
  const exports = {};
  const source = readFileSync(new URL('../lib/communityApi.ts', import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText,
    { exports, require: () => dependencies });
  return { api: exports, calls, set: value => { response = value; } };
}

test('community writes use verified action gateway with no client account/date identity', async () => {
  const c = client(); const proof = { credential: 'credential', requestId: 'request', captchaToken: 'token', captchaBinding: 'binding', deviceEvidence: {} };
  c.set({ data: { id: 'new-question', status: 'PENDING' }, error: null });
  assert.equal(await c.api.submitCommunityQuestion({ text: 'A daily question?', proof }), 'new-question');
  assert.equal(c.calls[0].name, 'community-action');
  assert.deepEqual(JSON.parse(JSON.stringify(c.calls[0].args)), { operation: 'submit', text: 'A daily question?', editId: null, ...proof });
  c.set({ data: {id:'other-question',status:'ACCEPTED'}, error: null });
  await c.api.upvoteCommunityQuestion({ id: 'other-question', proof });
  assert.equal(c.calls[1].name, 'community-action');
  assert.deepEqual(JSON.parse(JSON.stringify(c.calls[1].args)), { operation: 'upvote', id: 'other-question', ...proof });
  c.set({ data: null, error: { message: 'You cannot upvote your own question.' } });
  await assert.rejects(c.api.upvoteCommunityQuestion({id:'own-question',proof}), /cannot upvote your own/);
  c.set({ data: { id:'wrong',status:'ACCEPTED'},error:null });
  await assert.rejects(c.api.upvoteCommunityQuestion({id:'other-question',proof}), /Could not verify this upvote/);
});

test('community feed and quota parsing rejects malformed responses and handles empty public feeds', async () => {
  const c = client();
  c.set({ data: { items: [], next_cursor: null }, error: null });
  assert.equal((await c.api.fetchCommunityQuestions()).items.length, 0);
  c.set({ data: { items: [{ id: 'q', question_text: 'Question?', created_at: '2026-10-20T12:00:00Z', upvote_count: '2', is_own: false, upvoted_today: true }], next_cursor: { id: 'q' } }, error: null });
  const feed = await c.api.fetchCommunityQuestions({ sort: 'oldest', filter: 'mine', cursor: { id: 'cursor' } });
  assert.equal(feed.items[0].upvoteCount, 2);
  assert.equal(feed.items[0].upvotedToday, true);
  assert.equal(c.calls.at(-1).name, 'browse_brewing_questions');
  assert.deepEqual(JSON.parse(JSON.stringify(c.calls.at(-1).args)), { p_limit: 20, p_sort: 'oldest', p_filter: 'mine', p_cursor: { id: 'cursor' } });
  c.set({ data: { items: [{ id: 'q', upvote_count: -1 }], next_cursor: null }, error: null });
  await assert.rejects(c.api.fetchCommunityQuestions(), error => error.code === 'INVALID_RESPONSE');
  c.set({ data: { server_time: '2026-10-20T12:00:00Z', resets_at: '2026-10-21T00:00:00Z', submitted_question_id: null, upvoted_question_id: 'other' }, error: null });
  const allowance = await c.api.fetchBrewingAllowance();
  assert.equal(allowance.submittedQuestionId, null);
  assert.equal(allowance.upvotedQuestionId, 'other');
  c.set({ data: {}, error: null });
  await assert.rejects(c.api.fetchBrewingAllowance(), error => error.code === 'INVALID_RESPONSE');
});


test('moderation identity and idempotency fields are sent; server role and removal responses are validated', async () => {
  const c = client();
  for (const role of ['member', 'moderator', 'admin']) {
    c.set({ data: role, error: null }); assert.equal(await c.api.fetchCommunityRole(), role);
  }
  c.set({ data: 'owner', error: null }); await assert.rejects(c.api.fetchCommunityRole(), /moderator access/);
  const attempt = { userId: 'moderator', id: 'question', reason: 'Inappropriate content', requestId: 'retry-id' };
  c.set({ data: { id: 'question', removed_at: '2026-10-21T13:00:00Z' }, error: null });
  assert.equal(await c.api.removeCommunityQuestion(attempt), 'question');
  assert.deepEqual(JSON.parse(JSON.stringify(c.calls.at(-1))), { name: 'remove_brewing_question', args: {
    p_expected_user: 'moderator', p_submission_id: 'question', p_reason: 'Inappropriate content', p_request_id: 'retry-id' } });
  c.set({ data: null, error: { code: '42501', message: 'Moderator access is required.' } });
  await assert.rejects(c.api.removeCommunityQuestion(attempt), /Moderator access is required/);
  c.set({ data: null, error: { code: 'internal', message: 'Sensitive SQL detail' } });
  await assert.rejects(c.api.removeCommunityQuestion(attempt), { message: 'Could not remove this question.' });
  c.set({ data: { id: 'another', removed_at: 'not-a-date' }, error: null });
  await assert.rejects(c.api.removeCommunityQuestion(attempt), /Invalid community response/);
});
