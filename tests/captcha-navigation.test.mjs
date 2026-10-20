import assert from 'node:assert/strict';
import { test } from 'node:test';
import { challengeNavigationAllowed, captchaLoadError, CAPTCHA_CERTIFICATE_ERROR, CAPTCHA_LOAD_ERROR } from '../lib/captchaNavigation.ts';

test('challenge allows exact HTTPS origins and rejects prefix lookalikes and insecure navigation', () => {
  const origin = 'https://verify.example.com';
  for (const target of [`${origin}/?binding=x`, 'https://challenges.cloudflare.com/widget', 'about:blank', 'about:srcdoc']) {
    assert.equal(challengeNavigationAllowed(target, origin), true, target);
  }
  for (const target of [`${origin}.evil.com`, `${origin}@evil.com`, 'http://verify.example.com', 'javascript:alert(1)', 'file:///etc/passwd']) {
    assert.equal(challengeNavigationAllowed(target, origin), false, target);
  }
  assert.equal(challengeNavigationAllowed('http://localhost:54321/challenge', 'http://localhost:54321'), true);
  assert.equal(challengeNavigationAllowed('http://localhost.evil.test:54321/challenge', 'http://localhost:54321'), false);
  assert.equal(captchaLoadError('SSL error: The certificate authority is not trusted', 3), CAPTCHA_CERTIFICATE_ERROR);
  assert.equal(captchaLoadError('NSURLError', -1202), CAPTCHA_CERTIFICATE_ERROR);
  assert.equal(captchaLoadError('Connection refused', -1004), CAPTCHA_LOAD_ERROR);
});
