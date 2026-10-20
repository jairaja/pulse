import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('Brewing client reads only the preview RPC and excludes counts from its display model', async () => {
  let response = { data: [], error: null };
  const calls = [];
  const dependencies = { supabase: { rpc: async (name, args) => {
    calls.push({ name, args }); return response;
  } }, supabaseConfigurationError: null };
  const exports = {};
  const source = readFileSync(new URL('../lib/pulseApi.ts', import.meta.url), 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext }
  }).outputText;
  runInNewContext(javascript, { exports, require: () => dependencies });
  assert.equal(await exports.fetchBrewingQuestion(), null);
  assert.equal(calls[0].name, 'get_brewing_question');
  assert.equal(calls[0].args.p_language_code, 'en');

  response = { data: [{ id: 'tomorrow', question_text: 'Preview?', source_language: 'en',
    asked_on: '2026-10-21', sponsored: false, yes_count: 123 }], error: null };
  const question = await exports.fetchBrewingQuestion('fr');
  assert.equal(question.id, 'tomorrow');
  assert.equal(question.questionText, 'Preview?');
  assert.equal(calls.at(-1).args.p_language_code, 'fr');
  assert.ok(!('yes_count' in question));
  response = { data: null, error: null };
  await assert.rejects(exports.fetchBrewingQuestion(), error => error.code === 'INVALID_RESPONSE');
  response = { data: null, error: { code: 'network' } };
  await assert.rejects(exports.fetchBrewingQuestion(), error => error.code === 'network');
});
