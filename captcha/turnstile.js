const sitekey = window.PULSE_TURNSTILE_SITE_KEY;
const cdata = new URLSearchParams(location.search).get('cdata') ?? '';
const status = document.getElementById('status');
let loaded = false;
let finished = false;
const send = (message) => window.ReactNativeWebView?.postMessage(JSON.stringify(message));

function fail(message) {
  if (finished) return;
  finished = true;
  status.textContent = message;
  send({ type: 'turnstile-error', cdata });
}

window.addEventListener('error', () => fail('Verification could not load. Return to PULSE and try again.'));
setTimeout(() => {
  if (!loaded) fail('Verification timed out. Check your connection and try again in PULSE.');
}, 20000);

window.onTurnstileLoad = () => {
  if (loaded || finished) return;
  loaded = true;
  if (typeof sitekey !== 'string' || !/^[A-Za-z0-9_-]{10,100}$/.test(sitekey) || sitekey.startsWith('REPLACE_')) {
    fail('Verification is not configured. Set the public Turnstile Site Key in config.js and redeploy this page.');
    return;
  }
  if (!/^[a-f0-9]{64}$/.test(cdata)) {
    fail('Open verification by submitting a vote in PULSE. This page needs a valid vote binding.');
    return;
  }
  window.turnstile.render('#verification', {
    sitekey, action: 'pulse-vote', cData: cdata, theme: 'auto', size: 'flexible',
    language: 'auto', appearance: 'always', execution: 'render',
    'refresh-expired': 'manual', 'refresh-timeout': 'manual', retry: 'never',
    callback: token => {
      if (finished) return;
      if (typeof token !== 'string' || token.length < 10 || token.length > 2048) {
        fail('Verification returned an invalid token. Return to PULSE and try again.');
        return;
      }
      finished = true;
      status.textContent = 'Verification complete. Returning to PULSE…';
      send({ type: 'turnstile-success', token, cdata });
    },
    'error-callback': () => { fail('Verification failed. Return to PULSE and try again.'); return true; },
    'expired-callback': () => fail('Verification expired. Return to PULSE and submit again.'),
    'timeout-callback': () => fail('Verification timed out. Return to PULSE and submit again.')
  });
  status.textContent = 'Complete verification below. You can cancel in PULSE at any time.';
};
