# Mobile vote verification deployment

The mobile app requests a two-minute signed challenge, shows a managed Turnstile widget in a WebView,
then submits one token with the same vote payload and idempotency key. Siteverify must return success,
exact `pulse-vote` action, an allowed hostname, matching `cdata`, and a current challenge timestamp.
The signing key is independent from the Turnstile key and device pepper. It binds a random nonce,
expiry, question, choice, installation credential, fingerprint hash, verified account identity and
bearer-token hash (a session refresh during verification requires a fresh challenge).
Single-use enforcement relies on Cloudflare's atomic token redemption; this does not implement a
durable consumed-nonce store or platform attestation. See #60 for that separate boundary.

## Required configuration

1. Create separate Cloudflare Turnstile widgets for staging and production. Use **Managed** mode,
   restrict each widget to its exact verification hostname, and disable pre-clearance (no Cloudflare
   zone clearance is needed). Do not use wildcard/any-hostname settings or production test keys.
2. Replace the public sitekey in `captcha/turnstile.js`. Host the `captcha/` directory on your registered
   HTTPS origin. Serve it without analytics, query logging of the fragment, redirects or a service
   worker. Set response headers `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`,
   `Cache-Control: no-store`, and HSTS. Add CSP `frame-ancestors 'none'` as a response header (meta
   cannot enforce that directive). Keep the page's CSP and load Cloudflare's script directly.
3. Configure `EXPO_PUBLIC_TURNSTILE_URL` as the exact hosted HTML URL with no query/fragment and rebuild
   the mobile app. The sitekey is public; the secret must never enter Expo configuration.
4. Set Supabase-managed `CAPTCHA_MODE=required`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_HOSTNAMES` (comma
   separated exact hostnames), and a randomly generated `CAPTCHA_CHALLENGE_SECRET` with at least 32
   bytes of entropy. Keep existing Supabase and fingerprint secrets. Deploy the updated `vote` function.
   Missing configuration fails closed with 503. `CAPTCHA_MODE=disabled` is only an explicit local/staging
   setting; never use it as an outage bypass. Required mode is the default.
5. Canary the paired app/gateway release on staging, then a controlled production cohort. Older app
   versions cannot satisfy the new protocol: communicate a minimum-version/update requirement before
   enabling the gateway in production. Monitor errors and abort rollout when false rejections rise.

The initial policy verifies every vote. Risk-based exemption is deferred until trusted gateway signals
and attestation exist; client-supplied flags cannot justify skipping verification. Reading stays public.
CAPTCHA is abuse friction, not evidence of a unique human or authentic device.

## Token lifecycle and accessibility

Tokens are local to the pending function call and cleared after every attempt. They never enter query
cache, storage, analytics or mutation variables. Cancellation, unmount, question change, backgrounding,
expiry or failed verification requires a new attempt. Network loss after accepted submission can be
recovered using the database's same-device/same-choice receipt behavior; tokens themselves are not
retried. Session changes between challenge and vote invalidate the binding.

The modal offers explicit cancel/retry, visible status, scalable native text and the managed widget's
keyboard/screen-reader support. Turnstile has no audio-puzzle mode; do not promise one. Before production,
test VoiceOver, TalkBack, large text, low bandwidth, app backgrounding, expiry and provider outage on
physical iOS/Android devices. A support/accessibility route must never bypass server verification.
The browser preview does not support this native WebView flow and fails closed for voting.

## Verification and remaining gates

`npm run test:security` covers payload/key substitution, expiry, malformed challenge values,
strict provider response checks, provider failure, and concurrent single-use redemption against a
simulated provider. It does not demonstrate Cloudflare production configuration or real-device UX.
Cloudflare test keys may be used in an isolated test deployment with explicit test hostname settings;
they do not prove real challenge solving or hostname enforcement. Keep #61 open until real-device,
accessibility, hostname/action rejection, consumed-token and provider-outage evidence is attached.

Current references checked on 2026-10-17:

- [Cloudflare mobile implementation](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/)
- [Cloudflare server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Expo WebView installation](https://docs.expo.dev/versions/latest/sdk/webview/)
