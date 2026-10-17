// Replace with the public sitekey for this environment before hosting. Never insert the secret here.
const sitekey = 'REPLACE_WITH_ENVIRONMENT_SITEKEY';
const cdata = location.hash.slice(1);
const send = (type, token) => {
  window.ReactNativeWebView?.postMessage(JSON.stringify({ type, token, cdata }));
};
let loaded = false;
window.addEventListener('error', () => send('error'));
setTimeout(() => { if (!loaded) send('timeout'); }, 20000);
window.onTurnstileLoad = () => {
  loaded = true;
  if (!/^[a-f0-9]{64}$/.test(cdata) || sitekey.startsWith('REPLACE_')) {
    document.getElementById('status').textContent = 'Verification is unavailable. Return to PULSE and try again later.';
    send('error');
    return;
  }
  window.turnstile.render('#verification', {
    sitekey, action: 'pulse-vote', cData: cdata, theme: 'auto', size: 'flexible',
    language: 'auto', appearance: 'always', execution: 'render',
    'refresh-expired': 'manual', 'refresh-timeout': 'manual', retry: 'never',
    callback: token => send('token', token),
    'error-callback': () => { send('error'); return true; },
    'expired-callback': () => send('expired'), 'timeout-callback': () => send('timeout')
  });
  document.getElementById('status').textContent = 'Complete verification below. You can cancel in PULSE at any time.';
};
