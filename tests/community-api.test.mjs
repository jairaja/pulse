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
    supabase: { rpc: async (name, args) => { calls.push({ name, args }); return response; } } };
  const exports = {};
  const source = readFileSync(new URL('../lib/communityApi.ts', import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText,
    { exports, require: () => dependencies });
  return { api: exports, calls, set: value => { response = value; } };
}

test('community writes send no author, voter or quota-date fields and preserve safe server errors', async () => {
  const c = client();
  c.set({ data: 'new-question', error: null });
  assert.equal(await c.api.submitCommunityQuestion('A daily question?'), 'new-question');
  assert.equal(c.calls[0].name, 'submit_brewing_question');
  assert.deepEqual(JSON.parse(JSON.stringify(c.calls[0].args)), { p_question_text: 'A daily question?' });
  c.set({ data: null, error: null });
  await c.api.upvoteCommunityQuestion('other-question');
  assert.equal(c.calls[1].name, 'upvote_brewing_question');
  assert.deepEqual(JSON.parse(JSON.stringify(c.calls[1].args)), { p_submission_id: 'other-question' });
  c.set({ data: null, error: { code: '42501', message: 'You cannot upvote your own question.' } });
  await assert.rejects(c.api.upvoteCommunityQuestion('own-question'), /cannot upvote your own/);
  c.set({ data: null, error: { code: 'internal', message: 'private database details' } });
  await assert.rejects(c.api.submitCommunityQuestion('A question?'), error => error.message === 'Could not submit your question.');
});

test('community feed and quota parsing rejects malformed responses and handles empty public feeds', async () => {
  const c = client();
  c.set({ data: [], error: null });
  assert.equal((await c.api.fetchCommunityQuestions()).items.length, 0);
  c.set({ data: [{ id: 'q', question_text: 'Question?', created_at: '2026-10-20T12:00:00Z', upvote_count: '2', is_own: false, upvoted_today: true }], error: null });
  const feed = await c.api.fetchCommunityQuestions('cursor');
  assert.equal(feed.items[0].upvoteCount, 2);
  assert.equal(feed.items[0].upvotedToday, true);
  assert.equal(c.calls.at(-1).args.p_before, 'cursor');
  c.set({ data: [{ id: 'q', upvote_count: -1 }], error: null });
  await assert.rejects(c.api.fetchCommunityQuestions(), error => error.code === 'INVALID_RESPONSE');
  c.set({ data: { server_time: '2026-10-20T12:00:00Z', resets_at: '2026-10-21T00:00:00Z', submitted_question_id: null, upvoted_question_id: 'other' }, error: null });
  const allowance = await c.api.fetchBrewingAllowance();
  assert.equal(allowance.submittedQuestionId, null);
  assert.equal(allowance.upvotedQuestionId, 'other');
  c.set({ data: {}, error: null });
  await assert.rejects(c.api.fetchBrewingAllowance(), error => error.code === 'INVALID_RESPONSE');
});
