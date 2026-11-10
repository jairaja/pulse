# Pulse website — hosted test acceptance plan

Prepared 10 November 2026 for the implementation in `website/`. **A plan, not an execution report: every case starts NOT RUN.** The website is public and read-only. There is no website login, OTP, account history, submission, upvote or daily-vote flow. App OTP readiness is a useful overall milestone, but public website browsing does not depend on signing in.

## Setup, evidence and priorities

Deploy a test Cloudflare Worker from the reviewed Git commit and point it at the hosted **test** Supabase project's URL/publishable key. It must use the same test data as the app for comparisons. No service-role key, SMTP key or Turnstile secret belongs in the website. Keep app-link, CAPTCHA and authentication-recovery hosts separate.

Record the Git commit/deployment ID, Worker URL/domain, project reference, browser/version/OS, viewport, UTC time, active filters/question language and whether provider security rules are enabled. Keep tokens/private DB data out of evidence. Use a results sheet: **ID | browser/device | UTC time | steps/fixtures | expected | actual | PASS/FAIL/BLOCKED/NOT RUN | sanitized screenshot/PDF/log | bug link**.

Prepare live/published Brewing/finalized YES/NO/tie/zero fixtures, pending/hidden/invalid IDs, a selected submission and its daily-question ID, 25+ Brewing items, 65+ finalized results for sparse filters, and 101+ results if testing the 100-loaded-result cap. Include counts 0/99/100/999/1000; different UTC dates; multilingual/RTL/emoji/HTML-looking text; questions near the character limit. Fixtures are synthetic test data. Do not manufacture a production result or reset live quotas.

Browser matrix: desktop Chrome/Edge/Firefox; Safari on macOS if available; physical iPhone Safari and Android Chrome; one tablet; private browsing/storage-blocked mode. Automated Chromium is one part of this matrix, not proof for all browsers. Test 390px mobile and a smaller supported width, 1440px desktop, keyboard-only, 200% text/zoom, dark mode, reduced motion and a screen reader.

Priority **P0** = public/private separation, correct data/UTC, independent mobile services; **P1** = core browsing/report UX; **P2** = extended compatibility/capacity. All P0 cases must pass before publication.

## Recommended execution order

1. Home/live and baseline public-data comparison (W01–W10).
2. Brewing and archive filter/pagination journeys (B and R).
3. Search, public links and sharing (S).
4. PDF and print flows (F).
5. Language/display/accessibility/browser matrix (X).
6. Outage/UTC/cache/security/operational checks (N, C, O).
7. Final incognito visitor: Today → Brewing → results filter → share → PDF → actual store link. No authentication or CAPTCHA should be required for ordinary browsing.

## W. First visit, marketing and current question — P1; data privacy is P0

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| W01 | Open root URL as a fresh/incognito visitor. | Purpose, daily rhythm and navigation readable; no signup wall, CAPTCHA, personal account prompts or fabricated participation figures. |
| W02 | Navigate Today → Brewing → Past results → About; use browser Back/Forward and reload. | Correct tab/title/active navigation; no broken routing, duplicate handlers or unrelated personal screen. |
| W03 | Compare live question/date with app and public test DB. | Same current question, correct UTC date and end boundary. Live YES/NO totals and private user answers never exposed. |
| W04 | Watch countdown and date text, including around the hour/day boundary. | Consistent hours/minutes; results/new-question explanation explicitly says 00:00 UTC, never noon or local midnight. |
| W05 | No live question exists. | Honest waiting state and ability to browse other sections; no invented question or stale “live” label. |
| W06 | Live endpoint fails while static assets work. | Retry message in relevant panel; purpose, About and configured download/contact content stay usable. |
| W07 | Inspect three recent-result cards on Home; open an older result. | Only finalized snapshots; exact totals and correct result link. Empty recent history has an honest empty state. |
| W08 | Test absent/valid Android and iOS store configuration, desktop and mobile. | Only configured real store listings shown; no dummy IDs or preview APK represented as a public store release. |
| W09 | Click header/in-page Get the app and optional Contact. | Anchors reach download information; real store/mail destination if configured; no broken placeholder. Missing configuration is explained. |
| W10 | Disable JavaScript. | Minimal purpose/enable-JS notice remains. Dynamic browsing is not falsely claimed to work without JS; re-enable and recover. |

## B. Brewing, ranking and pagination — P1; public-only visibility is P0

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| B01 | Browse as a fresh visitor with no mobile account. | Published open questions only, full text, UTC submission time, exact upvote count and Share. No author identity/private moderation reason or actionable upvote button. |
| B02 | Compare Most supported order and a count tie with app. | Cumulative support descending, later-submission tie behavior matches upstream; not falsely labelled recent momentum/unique people. |
| B03 | Select Newest first / Oldest first, then Apply filters. | Order changes as selected; old cursor/items are reset, not appended across sorts. |
| B04 | Select Submitted today (UTC); include submissions on opposite sides of UTC midnight. | Correct server-UTC filter; not visitor-local calendar day. |
| B05 | Combine sort + time filter; Reset. | Applied selections and returned data agree; reset restores defaults. |
| B06 | Load 25+ items with Explore more; retry after slow/dropped response. | Stable snapshot/cursor, no duplicate cards from repeated pages; load action visibly pending and recovers. |
| B07 | Upvote/publish from app while website list is paginated, then refresh. | Existing snapshot remains ordered; explicit refresh starts a current list; no automatic website write. |
| B08 | Leave cursor older than ten minutes or cross UTC midnight, then load more. | Clear refresh-needed response instead of mixed rankings, silent loss or crash. |
| B09 | Empty feed/filter, slow response and API error. | Distinct empty/loading/error states with recovery; not an invented zero count for failed data. |
| B10 | Toggle list/grid once; reload and revisit. | One toggle with accessible destination label; choice persists in this browser; narrow/large-text layouts remain readable. |
| B11 | Remove/hide/select a question from the app, then refresh website. | Removed/private content unavailable after cache expiry; selected winner moves out of Brewing. Old downloaded screenshots cannot be recalled. |
| B12 | Attempt own/mine/others filters via crafted website request. | Private/account-specific filters rejected; no account lookup or personalized public cache. |

## R. Finalized results, filters and totals — P0 correctness, P1 navigation

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| R01 | Compare several result cards against app and `question_results` snapshots. | Exact YES/NO/total/date/outcome; total = YES + NO. No raw-vote aggregation per visitor/card. |
| R02 | Check YES majority, NO majority, equal nonzero counts and zero total. | Correct outcome and percentages; 0 votes is not displayed as 100% NO or a meaningful majority. Rounded nonzero shares total 100%. |
| R03 | From-only, To-only and combined date filters; include exact boundary dates. | Inclusive UTC dates, newest first; end date itself is included. |
| R04 | From after To or invalid/impossible date via direct request. | Readable validation, no broad unintended query or SQL/stack leak. |
| R05 | Filter Yes/No/Tied and totals Any/100+/1000+. | Matching counts/outcome only; thresholds include exactly 100 and 1000. |
| R06 | Search question contains phrase, Unicode and no-match text. | Contains matching displayed question text; not fuzzy semantic search or unrestricted archive download. |
| R07 | Combine dates, outcome, minimum and text; Apply/Reset. | Every active filter is honored; current filtered cursor does not mix with earlier query. |
| R08 | Paginate 25+ results and retry/double-click. | No duplicate/skipped matching rows; correct descending date cursor. |
| R09 | Use sparse filter with no matches in first 60 scanned entries, but a match farther back. | Says no match in this archive portion and offers continuation; does not falsely declare no matches anywhere. Upstream scan is capped at three pages/request. |
| R10 | Load until lower date bound crossed. | Pagination stops appropriately; it does not loop through older irrelevant history. |
| R11 | Load 100 results, then continue with more available. | Next action explicitly replaces loaded batch; browser/report memory remains bounded; no implication that all history is already loaded. |
| R12 | Click Report of loaded results after filters/pagination. | Report scope equals loaded matching cards, not unseen results or all database rows. |
| R13 | Invalid upstream totals/status or backend error in operator fixture test. | Safe unavailable state, not a misleading chart; no internal payload displayed. |

## S. Public search, website links and sharing — P1; privacy is P0

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| S01 | Search a phrase matching live, Brewing and past questions. | Up to six public original-text matches with correct destinations; no login. |
| S02 | Blank/one-character/100-character/over-limit query, no match and network failure. | Clear validation/no-match/retry behavior; request size bounded, no raw SQL error. |
| S03 | Submit different searches rapidly; older reply arrives last. | Newest submitted query owns results; stale response is ignored/cancelled. |
| S04 | Choose each type of search result; reload/copy its URL. | Exact website question preview, no fabricated mobile-app deep-link dependency. |
| S05 | Share a Brewing card with native share supported; cancel share. | Public question text/link only; cancel does not claim it was posted. |
| S06 | Share where native sharing absent; test clipboard allowed and blocked. | Copy fallback succeeds with feedback, or gives an honest browser-address fallback. No silent failure. |
| S07 | Open copied URL in incognito/another browser. | Exact public item and no personal choice/account state. |
| S08 | Reuse submission URL after community selection and after finalization. | Resolver follows current public state and shows corresponding question/result. |
| S09 | Pending/hidden/unknown/malformed ID or unsupported kind. | Private-safe unavailable/validation state; no pending text, private reason, account ID or unrelated personalized result. |
| S10 | Question text contains HTML tags, quotes, script-looking text and emoji. | Rendered as text in cards/search/report; no script/HTML execution. |
| S11 | Close shared-question preview, change tabs and use browser Back/Forward. | Correct URL/selection restored or cleared; ordinary browsing stays usable. |
| S12 | Marketing website down; independently open app and verified app link. | App routes/authentication recovery remain independent; no need to move association/auth files onto this website. |

## F. Result report, PDF and print — P1

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| F01 | Open PDF report from one finalized card. | Accessible preview shows exactly that result/date/totals and no private answer. |
| F02 | Download single PDF; open in browser PDF viewer and another PDF reader. | Valid `.pdf`, one readable page, correct question/counts/outcome/UTC dates/generated time/public source URL. |
| F03 | Download batch after loading multiple filtered pages. | One page/result, correct number/order/content, no unseen or duplicate result. |
| F04 | Attempt empty batch; inspect 100-result limit and next-batch behavior. | Empty report explained; no unbounded whole-database PDF job. |
| F05 | Export YES/NO/tie/zero totals and large exact counts. | Report agrees with card/snapshot; no zero denominator or rounding error. |
| F06 | Test all ten question languages, Arabic/Urdu RTL, Bengali/Hindi joining, Mandarin, accents and emoji. | Correct readable browser-font rendering in PDF; no missing glyphs/truncation or reversed meaning. Native-reader review needed, not file validity alone. |
| F07 | Export longest supported/historical question. | Full text fits or clear fallback to printable report; no silently cropped conclusion. |
| F08 | Print / save PDF from report preview; inspect multiple pages. | Report text/figures only; navigation/dialog controls hidden; no clipped cards. Text can remain selectable through browser print. |
| F09 | Try text selection/screen reader in downloaded file. | Current direct PDF is image-based and not tagged/searchable; retain accessible HTML/print alternative. Do not claim PDF/UA compliance. |
| F10 | Cancel download/print, retry, close modal; generate another report. | No app/data change or stuck button. Selection and report scope remain correct. |
| F11 | Disconnect after result/PDF code is loaded; repeat generation. | Existing data can generate locally; a missing lazy module gives a safe retry/print option. No server PDF-rendering service required. |
| F12 | Start batch export, then navigate/change filters while it runs. | Export uses the captured selected batch, not a changing mixture of new data. |

## X. Display, question languages and accessibility — P1

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| X01 | Test desktop, phone and tablet portrait/landscape. | Readable cards/forms/navigation; no unintended horizontal scrolling or off-screen action. |
| X02 | Switch System/Light/Dark; restart browser; change OS appearance. | Correct behavior/persistence; contrast remains sufficient for labels/errors/counts. |
| X03 | Enable Larger text and 200% browser text/zoom; use saved grid. | Full question and controls usable; list fallback allowed without silently erasing saved choice. |
| X04 | Use OS contrast/reduced-motion settings and keyboard only. | Focus visible, no forced animation, labels/status not color-only; native controls remain usable. |
| X05 | Open/close settings and report with keyboard/Escape; inspect focus. | Dialog named, focus contained while open and restored reasonably on close; background not accidentally operated. |
| X06 | Screen reader reads live state, chart, filters, selected view, loading/error and reports. | Useful labels and exact chart equivalents; no meaningless unlabeled icons or “read-only vote” controls presented as actionable. |
| X07 | Choose each of ten question languages. | Today/Past request published translations where available, otherwise original text. English navigation is a stated first-release limit; Brewing/search remain original text. |
| X08 | Reload after language/view/theme changes, then open on a separate browser/device. | Local browser preferences persist; unrelated browser does not inherit them. No account/DB preference sync implied. |
| X09 | Private mode, disabled/full local storage and blocked clipboard. | Browsing still works with safe defaults; optional local settings/share failures do not crash site. |
| X10 | Native Safari/Chrome date inputs, keyboard forms and pinch/text zoom. | Inputs remain operable and their displayed local presentation does not change UTC filtering semantics. |

## N. Network, UTC refresh and cache — P0 correctness, P1 recovery

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| N01 | Leave Today open over real 00:00 UTC. | Countdown transitions and question/results refresh without restart; live totals remain hidden until finalization. |
| N02 | Leave Brewing/Past Results open over midnight without visiting Today. | Refresh still occurs; selected candidate moves appropriately and new result appears. |
| N03 | Background/offline through midnight, then foreground/reconnect. | Stale tab refreshes to server day; no permanent frozen question. |
| N04 | Observe open tab after five minutes, manually Refresh and rapidly change tabs. | Stale refresh works; abort/stale-generation handling prevents late responses populating wrong view. |
| N05 | Change client timezone/clock in isolated browser test. | Edge/server clock and UTC eligibility govern day/countdown; client clock cannot reveal future/live result data. |
| N06 | Observe normal public-cache hit and near-midnight request. | Cache lifetime at most 20 seconds, shortened before boundary; fresh edge-time header on hits. No deliberate stale-while-revalidate across midnight. |
| N07 | Slow upstream response crosses midnight. | Response not cached as fresh next-day data; subsequent refresh resolves boundary state. |
| N08 | Remove/hide a public question then access cached/uncached URL. | Public cache can lag up to 20 seconds; after expiry content unavailable. Previously downloaded PDFs cannot be recalled. |
| N09 | Supabase timeout/429/5xx/malformed response or missing runtime config. | Honest component error/retry; static purpose/About/download information still works. No secrets/SQL/stack trace in response. |
| N10 | Cloudflare website outage or old deployment rollback. | App still independently functions; restoration/rollback affects website only, not DB/mobile versions. |
| N11 | Offline reload versus returning to an already loaded tab. | Honest browser/offline failure; no promised offline-first cache/service worker that does not exist. |

## C. Public-only API, credentials and abuse — P0

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| C01 | Inspect browser Network/local storage/cookies during all public flows. | No website account/session/OTP requests, account data, email address, device fingerprint or private answer; only browser display preferences persisted. |
| C02 | Inspect Worker environment/build output. | Only public project key used for DB reads; service-role, SMTP, Turnstile secrets absent from website code/bundle/config responses. Publishable key is not a secret or substitute for authorization. |
| C03 | Send POST/PUT/PATCH/DELETE or attempt generic/private RPC proxy routes. | Website API rejects writes/unknown paths; no vote/account/moderation invocation. Operator test, not normal visitor UI. |
| C04 | Send browser Authorization/Cookie to public routes; compare two users' responses. | No forwarded user identity or personalized cache; same public projection for same filters/language. |
| C05 | Inspect public payloads including resolver/search. | Explicit public fields only; no author IDs, private review notes, account lease state or server secrets. |
| C06 | Invalid cursor/filter/language/date/ID and excessive query length. | Bounded rejection; no arbitrary upstream function/host selection, broad scan or error leak. |
| C07 | HTML-looking content and malicious configured store/contact URL in isolated test. | Content escaped; only HTTPS official store hosts allowed; no executable links. |
| C08 | Inspect CSP/security headers, iframe embedding and external network requests. | Headers present; no unexpected external fonts/tracker/social embeds or executable injected content. |
| C09 | Normal visitor browses/searches/exports PDF. | No routine CAPTCHA. Local PDF export does not trigger backend protected write. |
| C10 | If abuse controls are configured, exercise modest agreed bursts and suspicious requests. | Normal readers remain usable; intended edge limit/challenge returns recoverable response. Availability of Cloudflare features depends on plan/configuration. Do not promise a rule that is not deployed. |
| C11 | Consider direct public Supabase requests outside website. | Public endpoints remain public under database grants. A website CAPTCHA/public key hiding does not secure or rate-limit all direct Supabase access. |

## O. Deployment and capacity checks — P1/P2, explicit scoped execution

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| O01 | Deploy reviewed commit using Git root `website`; inspect build logs. | Correct build/assets/Worker version, no Expo-root build. Runtime settings survive subsequent deploys. |
| O02 | Compare test and eventual production config/domains. | Correct project, real store URLs, no test fixtures shown accidentally as production; website domain does not replace app-link/CAPTCHA hosts. |
| O03 | Run existing Node and fixture browser suites. | Passing recorded output for exact commit; do not confuse mocks with hosted behavior. |
| O04 | After owner agrees staging budget/rate, run cache-hit/miss public-read workloads with common and sparse filters. | Record request rate, cache ratio, p50/p95 latency, errors, upstream call count, Worker/Supabase CPU/DB impact. No claims of “100k users tested” from fixture tests. |
| O05 | During agreed workload include a few app reads/real test writes. | Website traffic does not create unacceptable DB contention or prevent mobile transactions; define acceptable latency/error thresholds before the run. |
| O06 | Set operational alerts/budget checks for observed public traffic. | Detect repeated 503/timeouts or unexpected read costs; alerts and provider logs contain no user tokens/private content. |

Run from `website/`: `npm ci`, `npm test`, `npm run build`, `npx wrangler deploy --dry-run`. Browser prerequisites and `npm run test:browser` are described in [website/README.md](../../website/README.md). These can run before app OTP is fixed because public fixtures/read access need no login.

Release exit: P0 cases pass; core P1 flows pass on target Safari/Chrome; downloaded PDFs reviewed for supported scripts; real hosted UTC boundary observed; legal/contact/store configuration approved; no undocumented private-data exposure or dependency on website uptime for the app. Full UI localization, real-time trending score, tagged/searchable direct PDFs and backend load guarantees are not implemented claims.
