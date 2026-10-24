import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(`../lib/${file}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext }
  }).outputText, { exports, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const model = load('preferencesModel');
const { createPreferenceController } = load('preferenceController', { './preferencesModel': model });
const plain = value => JSON.parse(JSON.stringify(value));
function fixture({ owner = null, data = new Map(), remote = null, storageFailure = false } = {}) {
  const states = [];
  const controller = createPreferenceController({ owner, scope: 'test-project',
    storage: { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => {
      if (storageFailure) throw new Error('Disk unavailable'); data.set(key, value);
    } }, remote: remote ?? { ensure: async () => { throw new Error('offline'); } },
    changed: state => states.push(plain(state)) });
  return { ...controller, data, states, latest: () => states.at(-1) };
}

test('guest preferences survive restarts, old theme migrates, corrupt cache and failed storage are safe', async () => {
  const device = fixture({ data: new Map([['pulse.theme-preference', 'dark']]) });
  await device.start(); assert.equal(device.latest().preferences.theme, 'dark');
  await device.set({ language: 'ur' });
  const restarted = fixture({ data: device.data }); await restarted.start();
  assert.deepEqual(restarted.latest(), { status: 'device', preferences: { language: 'ur', theme: 'dark' } });
  assert.deepEqual(plain(model.parsePatch({ language: 'unsupported', theme: 'dark', user: 'someone' })), { theme: 'dark' });
  const corrupt = fixture({ data: new Map([['pulse.preferences.device.v1', '{broken']]) });
  await corrupt.start(); assert.equal(corrupt.latest().preferences.language, 'en');
  const unavailable = fixture({ storageFailure: true }); await unavailable.start();
  assert.equal(unavailable.latest().status, 'pending');
});

test('new-device sign-in restores account settings without overwriting them with local defaults', async () => {
  let saved = { language: 'ar', theme: 'light' }; let patches = 0;
  const remote = { ensure: async () => saved, patch: async (_, patch) => { patches++; saved = { ...saved, ...patch }; return saved; } };
  const device = fixture({ owner: 'account', remote }); await device.start();
  assert.deepEqual(device.latest(), { status: 'synced', preferences: saved });
  assert.equal(patches, 0);
  await device.set({ language: 'hi' });
  assert.deepEqual(saved, { language: 'hi', theme: 'light' });
  const otherDevice = fixture({ owner: 'account', remote }); await otherDevice.start();
  assert.deepEqual(otherDevice.latest().preferences, saved);
});

test('offline edits persist and retry only changed fields; remote changes to the other field survive', async () => {
  let offline = true; let saved = { language: 'fr', theme: 'light' }; const patches = [];
  const remote = { ensure: async () => { if (offline) throw new Error('offline'); return saved; },
    patch: async (_, patch) => { patches.push(plain(patch)); saved = { ...saved, ...patch }; return saved; } };
  const device = fixture({ owner: 'account', remote }); await device.start(); await device.set({ language: 'bn' });
  assert.equal(device.latest().status, 'pending'); device.stop();
  saved.theme = 'dark'; offline = false;
  const restarted = fixture({ owner: 'account', remote, data: device.data }); await restarted.start();
  assert.deepEqual(patches, [{ language: 'bn' }]);
  assert.deepEqual(restarted.latest().preferences, { language: 'bn', theme: 'dark' });
});

test('edits while a response is in flight converge; old account responses cannot update new UI', async () => {
  let release; let wait = false; let saved = { language: 'en', theme: 'system' };
  const remote = { ensure: async () => saved, patch: async (_, patch) => {
    if (wait) await new Promise(resolve => { release = resolve; });
    saved = { ...saved, ...plain(patch) }; return saved;
  } };
  const device = fixture({ owner: 'a', remote }); await device.start(); wait = true;
  const first = device.set({ language: 'es' });
  while (!release) await Promise.resolve();
  const second = device.set({ language: 'ru' }); wait = false; release();
  await Promise.all([first, second]); assert.equal(device.latest().preferences.language, 'ru');
  assert.equal(saved.language, 'ru');
  wait = true; release = null; const old = device.set({ theme: 'dark' });
  while (!release) await Promise.resolve();
  const emissions = device.states.length; device.stop(); release(); await old;
  assert.equal(device.states.length, emissions);
});

test('one-button view selections and accessibility flags restore independently on another device', async () => {
  let saved = { language: 'ur', theme: 'dark', brewingView: 'list', resultsView: 'grid', highContrast: true };
  const remote = { ensure: async () => saved, patch: async (_, patch) => { saved = { ...saved, ...patch }; return saved; } };
  const first = fixture({ owner: 'member', remote }); await first.start();
  await first.set({ brewingView: 'grid', largerText: true, reduceMotion: true });
  await first.set({ highContrast: false });
  const second = fixture({ owner: 'member', remote }); await second.start();
  assert.deepEqual(second.latest().preferences, { language: 'ur', theme: 'dark', brewingView: 'grid', resultsView: 'grid', highContrast: false, largerText: true, reduceMotion: true });
  assert.deepEqual(plain(model.parsePatch({ brewingView: 'cards', largerText: 'true', reduceMotion: false })), { reduceMotion: false });
});
