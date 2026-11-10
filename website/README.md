# Pulse public website

An independent, responsive, read-only website. Source lives in this GitHub directory; Cloudflare serves both static assets and its small public-data Worker. It reads the existing hosted Supabase public RPCs. Mobile voting, CAPTCHA, authentication recovery and verified app links do not depend on this site.

## Included

- Today: current question, UTC date and countdown; no interim YES/NO totals. Explains the 00:00 UTC daily transition.
- Brewing: published community questions, exact cumulative upvote counts, UTC submission times; most-supported/newest/oldest ordering and all-time/today filters. Stable server pagination, refresh, persisted list/grid choice. “Most supported” is not labelled as a recent-activity trend.
- Past results: exact YES/NO counts, percentages, total and outcome. Inclusive UTC date range, question-text search, outcome and participation filters. Newest-first keyset pagination.
- Search across public original-text questions; stable website-only question links, native sharing/copy fallback, selected-question preview. Pending/removed items are unavailable. Website links do not register as mobile universal/app links.
- Individual and loaded-results PDF downloads (up to 100 results, one question per page), plus printable HTML reports. The downloadable PDF rasterizes browser text to preserve multilingual fallback glyphs; its text is image-based, not searchable/tagged. The on-screen HTML and browser Print / Save PDF route are the selectable-text alternatives. Review complex scripts on target browsers; PDF/UA conformance is not claimed.
- About, privacy information for this implementation, real configured app-store links, optional contact email. No fabricated store listings, legal promises, tracking, social embeds, website account, user history or voting controls.
- System/light/dark appearance, larger text, reduced-motion and OS contrast support. All settings stay in this browser. Website navigation/copy is English; Today/Past Results can request the app's ten supported question languages, with upstream original-text fallback. Brewing/search are original-text only. This does not implement missing AI translations.
- A failed public-data request leaves marketing content usable with a retry state. Visible-page checks refresh after UTC rollover (within approximately 15 seconds), after five minutes, on return to a stale tab, or when connectivity returns. No per-second API polling.

## Requirements and local preview

Node >=22.13. Run these commands **inside `website/`**, not the Expo repository root:

```sh
npm ci
npm test
npm run build
```

Copy `.dev.vars.example` to `.dev.vars` and replace only the project URL and **publishable** key with your hosted test project's values. Then:

```sh
npm run preview
```

Open the local address Wrangler prints. The built frontend and `/api/*` run together. No Docker or Expo server is needed. `npm run dev` starts only Vite for frontend work; its API calls need a mock or a separately configured proxy. The browser suite provides mocks automatically.

Do not put service-role keys, SMTP credentials, device peppers, Turnstile secrets or account tokens in this website. The Worker deliberately accepts only an `sb_publishable_` key. Its configuration is separate from the mobile app's `.env`.

## Cloudflare setup, step by step

1. Merge the reviewed website branch into GitHub `main` when ready. Build and test it first as above. No Cloudflare deployment is performed by creating the source files.
2. Open Cloudflare Dashboard → **Workers & Pages → Create application → connect/import a Git repository**. Choose the **Workers** Git integration, then GitHub repository `jairaja/pulse`. Approve only the repository access needed. Dashboard labels can vary.
3. Set the root directory to **`website`**. Use Node 22.13+ (Node 24 is also supported). Select `main` as the production branch.
4. Set **Build command** to `npm ci && npm test && npm run build`. Set **Deploy command** to `npx wrangler deploy`. `wrangler.jsonc` already identifies the entrypoint and `dist` assets directory. Do not choose the Expo build commands or create a separate Pages project for these same files.
5. Name the Worker, for example `pulse-public-website`, matching `wrangler.jsonc`. If you choose another name, update that file first to keep Git deployments consistent.
6. In the Worker's **Settings → Variables and Secrets**, add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from the same hosted test project whose public data you want to display. Configure runtime variables, not only build variables. Apply settings/redeploy if prompted. If the first deployment ran before these were added, the site can show a temporary data-unavailable state until configured.
7. Optionally add `PLAY_STORE_URL`, `APP_STORE_URL` and `CONTACT_EMAIL`. Only use actual public listings. Leave unavailable listings unset. A preview APK download is not a Google Play listing. Store URLs must use `play.google.com` or `apps.apple.com` over HTTPS.
8. Open the generated `workers.dev` URL. Verify `/api/today`, `/api/brewing` and `/api/results` return public JSON. If they return 503, check URL/key and whether the migrations from `docs/product-journeys-rollout.md` are applied to that project. Missing migrations are not repaired by rebuilding the website.
9. Follow the acceptance checklist below. Until then use only this test Worker URL. Production data is a separate later configuration change: use your production project's public URL/key, never its service-role key.
10. Once reviewed, add your chosen website domain in **Settings → Domains & Routes → Add custom domain**, following Cloudflare's DNS/ownership instructions. Keep your CAPTCHA and mobile question-link services on their existing independent hostnames; this Worker does not serve their association files or authentication callbacks.
11. Future pushes to the configured branch trigger Cloudflare's build/deploy. Keep the package lock committed. Use Cloudflare's deployment history to roll back the website if needed; a website rollback does not roll back Supabase migrations or mobile builds.

If using CLI instead, log into your Cloudflare account with `npx wrangler login`, run `npm run deploy`, and add the runtime variables in the Worker dashboard. Do not configure a second automatic deployment pipeline for the same Worker unless you intend to manage both.

Cloudflare hosting, DNS and Worker usage are subject to its current allowances/pricing. Supabase reads remain Supabase usage. There is no new database, external analytics or PDF-rendering service. PDF generation happens locally in the visitor's browser.

## Data and operational boundaries

The Worker allows GET/HEAD only on six named public routes, translating them into the existing RPC POST requests internally. No browser cookie/JWT is forwarded, no generic RPC passthrough exists, and responses explicitly project public fields. It never invokes vote, account, submission or moderation endpoints. Existing public RPCs may perform their normal database rollover catch-up before returning data; visitors cannot submit content through this site.

Cloudflare caches successful public responses for at most 20 seconds, shortened to end before the next UTC day; errors and boundary responses are not cached. Removed public content can therefore take up to 20 seconds to disappear from this cache. Already shared screenshots/PDFs cannot be recalled. This is a public-data cache, not a user's history cache. Question HTML is escaped, requests time out, payloads are bounded, and credentials/upstream SQL errors are not returned to visitors.

Archive filtering scans at most three pages of 20 rows per request, returning up to 20 matching results and a continuation cursor. A sparse filter can return no matches with more entries available; the interface offers **Explore more**. It does not download the entire archive to implement filters. Results are aggregated snapshots, not scans of the raw votes table. After 100 loaded results, continuing replaces the loaded batch to bound browser memory/report size. PDF batch downloads contain the loaded results only, not the whole database.

Brewing ordering is a snapshot with upstream cursors expiring after ten minutes or at UTC rollover. A stale cursor offers Refresh instead of quietly mixing rankings. Counts shown in the website may be up to 20 seconds old and are not real-time projections of the eventual winner.

The current upstream Brewing RPC computes candidate support counts; it is appropriate to reuse for this first release, but it has not been hosted-load-tested for mass traffic. CDN caching lowers repeated reads per location but is not a rate limiter. Watch Worker errors/request volume and Supabase query latency before public promotion; configure Cloudflare rate controls as needed for observed abuse. No scale or uptime guarantee is claimed.

The About page describes website behavior. Before public launch, the owner still needs to approve the actual privacy/terms, contact details and any mobile-store account-deletion disclosures. Do not treat a generated About page as legal review.

## Verification

Full manual acceptance: [website test plan](../docs/test-plans/website.md). [CAPTCHA decision](../docs/test-plans/README.md#website-captcha-decision): no routine challenge on public read-only browsing; targeted abuse controls remain an operational decision, not a configured guarantee.

```sh
npm test
npm run build
npx wrangler deploy --dry-run
npx playwright install chromium
npm run test:browser
```

On a machine with system Chromium, use `CHROMIUM_PATH=/path/to/chromium npm run test:browser` instead of downloading a browser. In PowerShell, set `$env:CHROMIUM_PATH` separately if needed.

The browser suite uses synthetic public fixtures, not a hosted database: desktop/mobile layouts, filters, pagination/deduplication, persisted view, question-language requests, public search, hidden questions and HTML injection, one/multi-result PDF generation, failure/retry, and automated axe checks. Outputs are in ignored `test-results/`. These checks are not hosted concurrency/load testing, real mobile browser testing, or proof of full accessibility compliance.

Validation recorded on 6 November 2026: 16 Node assertions/tests passed; production build and Wrangler deployment dry run passed; fixture browser suite passed including UTC midnight refresh while on Brewing and 200% text without horizontal overflow. Automated axe checks reported no violations in the tested desktop Today/Brewing and mobile dark/larger-text views. Generated one- and three-page PDFs were opened by the PDF parser. Local Wrangler returned 200 for the site/config and a safe 503 for unconfigured public data, with security/edge-time headers. `npm audit` reported zero known vulnerabilities in the installed dependency tree. No hosted Supabase load test, physical phone browser acceptance, or Cloudflare publication was performed.

Before launch, manually verify against the hosted test project:

- Published questions and finalized totals match the app; no live YES/NO total appears.
- Every filter, pagination and sparse result state works with real data; removed/pending questions stay unavailable.
- Individual and batch PDFs contain the intended dates/counts/text; test all supported scripts and print output.
- Midnight UTC refresh works on an already-open tab and after background/reconnect.
- App-store buttons lead to real listings; no installed/uninstalled app behavior depends on this website.
- Keyboard-only navigation, mobile Safari/Chrome, screen reader, 200% text, dark mode and reduced motion are usable.
- A public-data outage preserves the site's purpose/download information and offers retry. The mobile app still functions through its own services.
