// Deploy on the SAME HTTPS origin configured in the app's associated domains / intent filters.
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const https = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; } };
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    if (url.pathname === '/.well-known/apple-app-site-association') {
      if (!/^[A-Z0-9]{10}$/.test(env.APPLE_TEAM_ID ?? '')) return new Response('Apple signing is not configured', { status: 503 });
      return Response.json({ applinks: { apps: [], details: [{ appID: `${env.APPLE_TEAM_ID}.com.pulse.worldtoday`, paths: ['/q/*'] }] } });
    }
    if (url.pathname === '/.well-known/assetlinks.json') {
      const fingerprints = (env.ANDROID_SHA256_FINGERPRINTS ?? '').split(',').map(v => v.trim()).filter(v => /^([A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(v));
      if (!fingerprints.length) return new Response('Android signing is not configured', { status: 503 });
      return Response.json([{ relation: ['delegate_permission/common.handle_all_urls'], target: {
        namespace: 'android_app', package_name: 'com.pulse.worldtoday', sha256_cert_fingerprints: fingerprints } }]);
    }
    const match = /^\/q\/(submission|question)\/([a-f0-9-]{36})\/?$/i.exec(url.pathname);
    if (!match) return new Response('Not found', { status: 404 });
    let item;
    try {
      const project = https(env.SUPABASE_URL);
      if (!project || !env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) throw new Error('Missing public configuration');
      const response = await fetch(`${project.replace(/\/$/, '')}/rest/v1/rpc/resolve_public_question`, {
        method: 'POST', headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_kind: match[1], p_id: match[2] }), signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) throw new Error('Public resolver unavailable'); item = await response.json();
    } catch { return new Response('This question could not load. Please refresh in a moment.', { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
    const android = https(env.PLAY_STORE_URL); const ios = https(env.APP_STORE_URL);
    const agent = request.headers.get('User-Agent') ?? '';
    const store = /Android/i.test(agent) ? android : /iPhone|iPad|iPod/i.test(agent) ? ios : null;
    const app = `pulse://q/${match[1]}/${match[2]}`;
    const title = item?.text ?? 'This question is no longer available.';
    const storeButtons = store ? `<a href="${escape(store)}">Get PULSE</a>` : [android && `<a href="${escape(android)}">Google Play</a>`, ios && `<a href="${escape(ios)}">App Store</a>`].filter(Boolean).join(' ');
    return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PULSE question</title><meta property="og:title" content="${escape(title)}"><meta name="referrer" content="no-referrer"><style>body{font:1.2rem system-ui;background:#f3f1ec;color:#151714;max-width:40rem;margin:10vh auto;padding:24px}a,button{display:inline-block;padding:16px;margin:8px;border:1px solid #315fc7;border-radius:12px;color:#315fc7}p{line-height:1.6}</style></head><body><main><h1>PULSE</h1><p>${escape(title)}</p>${item ? `<a href="${escape(app)}">Open in PULSE</a>` : ''}${storeButtons}<button id="copy">Copy question link</button><p>After installing, tap your original question link again. In an in-app browser, choose Open in browser if the app does not open.</p>${!storeButtons ? '<p>Store downloads will be available when PULSE launches.</p>' : ''}</main><script>document.getElementById('copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+location.pathname);document.getElementById('copy').textContent='Link copied'}catch{document.getElementById('copy').textContent=location.origin+location.pathname}};</script></body></html>`, {
      status: item ? 200 : 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" }
    });
  }
};
