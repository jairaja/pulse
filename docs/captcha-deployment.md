# Mobile vote verification deployment

## Why hosted verification can show raw HTML

The default hosted Supabase Edge Function URL can serve HTML as plain text instead of a browser page.
Changing the function's Content-Type alone does not fix that gateway behavior. Serve the HTML widget
from a static HTTPS site and keep the vote API in Supabase. Seeing literal HTML with
`data-sitekey="&lt;development widget site key&gt;"` also means a placeholder was saved instead of a real
Turnstile Site Key. Both the page hosting and widget configuration need correction.

The supported static page is the complete `captcha/` directory. It reads `?cdata=...` and posts
`turnstile-success` / `turnstile-error` messages, matching the active `TurnstileChallenge` component.
The older `EXPO_PUBLIC_TURNSTILE_URL` / fragment-based page protocol is not used by that component.

## 1. Configure the public page

1. In Cloudflare Dashboard, open **Turnstile**. Create or select a **Managed** widget for this
   development environment. Keep production in a separate widget. No purchased domain is required.
2. Copy its **Site Key**. It is public and different from its **Secret Key**.
3. In a deployment copy of `captcha/config.js`, replace `REPLACE_WITH_ENVIRONMENT_SITEKEY` with
   the actual Site Key. Do not include angle brackets or descriptive placeholder words. Never put
   the Secret Key in this directory, an Expo public variable, or a Pages upload.

## 2. Upload to Cloudflare Pages

1. In Cloudflare Dashboard, open **Workers & Pages** and create a **Pages** project using
   **Direct Upload / Upload assets**. Choose a stable project name, for example `pulse-verify-dev`
   if available. UI labels can vary; use Pages static hosting, not a Worker script deployment.
2. Upload the contents of `captcha/`, including index.html, config.js, turnstile.js, styles.css and
   the extensionless `_headers` file. index.html must be at the site's root, not `/captcha/index.html`.
   Upload only this directory, never the repository or an environment-secret file.
3. Deploy and record the stable production URL, for example `https://pulse-verify-dev.pages.dev/`.
   Use that URL, not a deployment-specific preview hostname. The site must be publicly reachable
   without a login screen; do not put Cloudflare Access authentication in front of the widget.
4. In the Turnstile widget's **Hostname Management**, add exactly `pulse-verify-dev.pages.dev`
   (substitute your actual hostname, without scheme, slash, port, or path). Save.
5. Open the site in Safari/Chrome. It should render a heading and a message asking you to open it
   from PULSE. That is expected without a vote binding; it must not show raw HTML. A public page
   showing a configuration error still has a missing/placeholder config.js key.

Pages applies `_headers` to serve a no-store page with CSP, no-referrer, nosniff, HSTS and frame
embedding restrictions. Its frame-ancestors policy does not block the top-level native WebView.
Keep Cloudflare's official script URL; do not proxy or self-host the Turnstile SDK.

## 3. Configure the hosted vote function

In the hosted **development** Supabase project, open **Edge Functions > Secrets** and set:

- `TURNSTILE_SECRET_KEY`: the actual Secret Key paired with the Site Key used in config.js.
- `TURNSTILE_EXPECTED_HOSTNAME`: the static page's exact hostname, such as `pulse-verify-dev.pages.dev`.

Keep the existing `DEVICE_FINGERPRINT_PEPPER` unchanged. Supabase supplies SUPABASE_URL,
SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY. Never copy local Docker credentials into the hosted
project. The static page does not need TURNSTILE_SITE_KEY in Supabase; that variable is used only by
`turnstile-challenge` when serving the local-function HTML alternative.

The equivalent CLI uses a private file outside the checkout containing the two Turnstile variables:

```bash
npx supabase secrets set --env-file <PRIVATE_FILE_PATH> --project-ref <DEV_PROJECT_REF>
```

Do not paste the placeholders literally. Confirm the vote function has been deployed from current
main. If needed:

```bash
npx supabase functions deploy vote --project-ref <DEV_PROJECT_REF>
```

The app now loads static Pages HTML and submits to Supabase `vote`; it no longer uses the hosted
`turnstile-challenge` endpoint for that environment. No database reset/migration is needed.

## 4. Point the app at the page

In the project-root `.env`, use the stable page URL:

```dotenv
EXPO_PUBLIC_TURNSTILE_CHALLENGE_URL=https://pulse-verify-dev.pages.dev/
```

Substitute your real Pages URL. Leave EXPO_PUBLIC_SUPABASE_URL and its matching publishable key
pointing to the hosted development project. Do not add cdata yourself: the app adds the current
vote's 64-character binding to the URL.

For Expo Go, stop Metro and run:

```bash
npm start -- --clear
```

Fully reload PULSE. Cancel any earlier challenge and start a fresh attempt.

For EAS preview/simulator builds, update the same public variable in the **preview** environment,
then rebuild and install the app; restarting Metro does not update a standalone binary's embedded
configuration. For development builds, use whichever EAS environment their build profile selects.

## 5. Verify the complete route

On physical iOS and Android devices:

1. Submit a fresh eligible vote. The WebView must show the widget, not HTML source or a config error.
2. Complete verification. Confirm the hosted `vote` function is called and the expected development
   database accepts one vote. Repeating submission must not add another accepted vote.
3. Close/cancel verification, disconnect the network and test an expired/failed challenge. No vote
   should be accepted without successful server-side verification.
4. Test VoiceOver/TalkBack and large text; the managed widget has no audio-puzzle mode.

The static page alone cannot mark a vote accepted. The active gateway recomputes the client binding
from the installation credential, question, choice and idempotency key, then checks Siteverify's
success, `pulse-vote` action, exact hostname and matching cdata. Cloudflare enforces token redemption;
CAPTCHA does not establish unique humans or provide platform attestation. No verification bypass is
part of this setup. Test UI and server-side rejection independently.

Automated page tests use a mocked Turnstile SDK; they validate query binding, configuration failure,
callback messages, token bounds, expiry and timeouts, not real Cloudflare service configuration.

References:

- https://developers.cloudflare.com/pages/get-started/direct-upload/
- https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
