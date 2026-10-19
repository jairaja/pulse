const headers = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; script-src https://challenges.cloudflare.com 'unsafe-inline'; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
  'Content-Type': 'text/html; charset=utf-8',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN'
};

function escapeAttribute(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
}

Deno.serve((request) => {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers });
  const siteKey = Deno.env.get('TURNSTILE_SITE_KEY');
  const cdata = new URL(request.url).searchParams.get('cdata') ?? '';
  if (!siteKey || !/^[A-Za-z0-9_-]{10,100}$/.test(siteKey) || siteKey.startsWith('REPLACE_')) {
    return new Response('Verification is not configured. Set TURNSTILE_SITE_KEY to the public widget Site Key.', { status: 503, headers });
  }
  if (!/^[a-f0-9]{64}$/.test(cdata)) return new Response('Invalid challenge', { status: 400, headers });

  return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>body{font-family:system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#fff}.box{text-align:center;padding:24px}</style></head>
<body><main class="box"><div class="cf-turnstile" data-sitekey="${escapeAttribute(siteKey)}" data-action="pulse-vote" data-cdata="${cdata}"
data-refresh-expired="manual" data-callback="ok" data-error-callback="fail" data-timeout-callback="fail"></div></main>
<script>function send(x){window.ReactNativeWebView?.postMessage(JSON.stringify(x))}function ok(token){send({type:'turnstile-success',token})}function fail(){send({type:'turnstile-error'})}</script>
</body></html>`, { headers });
});
