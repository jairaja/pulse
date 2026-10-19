import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const script = readFileSync(new URL('../captcha/turnstile.js', import.meta.url), 'utf8');
const binding = 'a'.repeat(64);
function page({ search = `?cdata=${binding}`, sitekey = '0x4AAAA-development-public-key' } = {}) {
  const messages = [];
  const timers = [];
  const status = { textContent: '' };
  let options;
  const window = {
    PULSE_TURNSTILE_SITE_KEY: sitekey,
    ReactNativeWebView: { postMessage: message => messages.push(JSON.parse(message)) },
    addEventListener: () => {},
    turnstile: { render: (_selector, value) => { options = value; } }
  };
  runInNewContext(script, { window, location: { search }, document: { getElementById: () => status },
    URLSearchParams, setTimeout: callback => timers.push(callback) });
  return { window, messages, timers, status, get options() { return options; } };
}

test('hosted page uses the active app query binding and native bridge protocol', () => {
  const p = page();
  p.window.onTurnstileLoad();
  assert.equal(p.options.cData, binding);
  assert.equal(p.options.action, 'pulse-vote');
  assert.equal(p.options.sitekey, '0x4AAAA-development-public-key');
  p.options.callback('provider-token');
  assert.deepEqual(p.messages, [{ type: 'turnstile-success', token: 'provider-token', cdata: binding }]);
  p.options.callback('duplicate-token');
  p.timers[0]();
  assert.equal(p.messages.length, 1, 'Do not submit twice or time out after successful script loading');
});

test('missing or placeholder site keys and invalid query bindings fail before rendering', () => {
  for (const sitekey of [undefined, '', '<development widget site key>', 'REPLACE_WITH_ENVIRONMENT_SITEKEY']) {
    const p = page({ sitekey: sitekey ?? '' });
    p.window.onTurnstileLoad();
    assert.equal(p.options, undefined);
    assert.match(p.status.textContent, /not configured/);
    assert.equal(p.messages[0].type, 'turnstile-error');
  }
  for (const search of ['', '?cdata=wrong', `?cdata=${'A'.repeat(64)}`]) {
    const p = page({ search });
    p.window.onTurnstileLoad();
    assert.equal(p.options, undefined);
    assert.match(p.status.textContent, /valid vote binding/);
    assert.equal(p.messages[0].type, 'turnstile-error');
  }
});

test('page rejects invalid tokens and reports provider failure, expiry and load timeout', () => {
  for (const token of ['', 'short', 'x'.repeat(2049), null]) {
    const p = page();
    p.window.onTurnstileLoad();
    p.options.callback(token);
    assert.equal(p.messages[0].type, 'turnstile-error');
  }
  for (const name of ['error-callback', 'expired-callback', 'timeout-callback']) {
    const p = page();
    p.window.onTurnstileLoad();
    p.options[name]();
    p.options.callback('later-provider-token');
    assert.deepEqual(p.messages, [{ type: 'turnstile-error', cdata: binding }]);
  }
  const p = page();
  p.timers[0]();
  p.window.onTurnstileLoad();
  assert.equal(p.options, undefined);
  assert.match(p.status.textContent, /timed out/);
  assert.equal(p.messages[0].type, 'turnstile-error');
});

test('local HTML function distinguishes configuration failure from invalid challenge', async () => {
  const source = readFileSync(new URL('../supabase/functions/turnstile-challenge/index.ts', import.meta.url), 'utf8');
  let key;
  let handler;
  runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText,
    { Deno: { env: { get: () => key }, serve: value => { handler = value; } }, URL, Response });
  const request = new Request(`https://test/turnstile-challenge?cdata=${binding}`);
  for (key of [undefined, '<development widget site key>', 'REPLACE_WITH_ENVIRONMENT_SITEKEY']) {
    const response = handler(request);
    assert.equal(response.status, 503);
    assert.match(await response.text(), /Set TURNSTILE_SITE_KEY/);
  }
  key = '0x4AAAA-development-public-key';
  assert.equal(handler(new Request('https://test/turnstile-challenge')).status, 400);
  const response = handler(request);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /0x4AAAA-development-public-key/);
});
