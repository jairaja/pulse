# Session provider, CAPTCHA frequency and useful engagement measurement

24 October 2026. These answers accompany the approved journeys implementation. Analytics and a new session-expiration policy are proposals; collection and dashboard changes were not enabled.

## Who provides the session?

**Supabase Auth** sends the email OTP, verifies it, issues the short-lived access JWT and maintains the refresh-token session. The app's Supabase client refreshes valid sessions while active. Its access-token expiration is not the duration a person stays signed in: a refresh token can obtain another access token.

Pulse now adds a server-owned **active session lease**. Successful OTP plus post-OTP CAPTCHA atomically activates one Supabase session ID for the account. Replacing or ending the lease stops old private API writes immediately, including requests using an otherwise unexpired JWT. Every protected REST RPC runs the lease guard; trusted gateways repeat checks inside the same transaction as the write. Replacement waits for transactions that were already authorized, then subsequent old-session operations fail. An old logout cannot revoke a newer session; an old completed ceremony/session cannot reactivate itself.

The prior session's refresh token is not what enforces this guarantee. Even if Supabase can still refresh an old provider session, its Pulse lease is invalid and it cannot use private Pulse operations. Realtime normally updates an online old device promptly; 15-second foreground checks and reconnect checks are fallback. Offline UI cannot be changed remotely until communication resumes. On restart, private cached data is not displayed until the lease is checked.

Supabase's default session behavior and available time-box/inactivity/single-session settings depend on project configuration and plan. Confirm **Authentication → Settings / Sessions** in your dashboard; menu names can change. No new 30/90-day limit is hardcoded by this change. If you choose the earlier proposed policy, 30 days of inactivity plus re-verification after 90 days is a reasonable initial option, with activity defined carefully and provider limits verified. A daily user should not need daily OTPs; a returning monthly user should receive a clear re-verification flow rather than a permanent next-day voting ban. Logins and logouts do not refund votes/upvotes.

## CAPTCHA after OTP: what it proves and what it does not

**Cloudflare Turnstile** supplies the CAPTCHA widget and Siteverify result. The account gateway first verifies the actual OTP with Supabase and binds that resulting session to its server-issued email/device ceremony. The app then displays CAPTCHA. Completing it is required before activating the Pulse session or importing history. A general bearer token cannot stand in for the OTP of a newly requested sign-in attempt.

Login CAPTCHA reduces automated account-session activation. It does not prove a physical device, identify a unique person, or prove that all future actions under a long-lived session remain human. Session theft, modified clients, CAPTCHA-solving services, account/device farms, and human-assisted automation remain possible. Android ID/IDFV plus client device flags are best-effort signals until Play Integrity/App Attest verification is deployed. The test suite explicitly demonstrates that a modified identifier creates a different hash; it does not label those flags attestation.

**Implemented starting policy:** fresh, single-use, action-bound CAPTCHA for login, each daily YES/NO submission, each Brewing upvote, and question submission/edit. Receipt recovery, browsing, sharing and allowance reads do not require a puzzle. Confirmation precedes upvote CAPTCHA; cancellation consumes no daily quota. One upvote/day and one daily vote normally mean two voting checks/day; asking adds a check, and sign-in adds one occasionally. Turnstile may complete a check without an interactive puzzle, but behavior must be measured on real supported devices.

A token solved for login is not replayed for an upvote: the binding includes verified session, purpose, target (or normalized question), unique request ID and, for import, the ceremony and checkbox choice. Siteverify must also accept the exact host/action/cdata and a current timestamp. Tokens expire and are single-use; no successful token is cached. CAPTCHA/provider failures leave actions unaccepted and questions pending rather than silently bypassing verification.

**Refined recommendation for later:** move to risk-based step-up after measuring friction and deploying platform integrity. A separately issued, short-lived server assurance record could cover a narrow set of low-risk actions for perhaps 10–15 minutes. Bind it to session, recognized device and purpose; invalidate it on logout/replacement, cap usage, and require fresh action-bound attestation where available. Its lifetime is independent of a 30-day login. Do not store a month-long `human=true` flag or reuse a Turnstile token. A sudden burst, changed evidence or suspicious failures should require a fresh challenge or temporary rate limit. Keep CAPTCHA accessible; OS assistive input is not itself evidence of a bot.

Post-OTP CAPTCHA does not prevent OTP-email spam before the challenge. The gateway limits sending to eight requests/hour per email hash or recognized device and limits verification attempts per ceremony; Supabase's own email/OTP rate controls also apply. That remains susceptible to targeted rate-limit exhaustion, so observe delivery and abuse. Add an accessible pre-email risk step-up or integrated Supabase sending CAPTCHA if that attack appears; enabling the dashboard feature alone would break the current sending flow without its token integration.

## Stress review and results

| Scenario | Expected behavior / evidence |
| --- | --- |
| Wrong/reused login token, modified consent or target | Bound proof rejected before session replacement; real handler tests. |
| Old bearer plus a new ceremony, no newly verified OTP | DB rejects the missing ceremony/session binding; SQL test. |
| CAPTCHA provider outage or timeout | No upvote/publication/session activation; real handler tests with mocked provider transport. |
| 32 concurrent accounts on one device, two upvote targets | Real local SQL: exactly one upvote, 31 quota failures, no deadlocks. |
| 24 simultaneous guest votes with different request IDs | Real local SQL: one immutable row, one acceptance, 23 duplicate responses. |
| Two signup imports on a shared device | Real local SQL: exactly one canonical owner of the earlier guest vote. |
| Four simultaneous account logins | Real local SQL: one surviving lease; three replaced sessions cannot authorize. |
| Different legitimate/forged device identifiers | The current signal can differ; attestation/abuse controls remain necessary. A family sharing one device also shares its upvote quota. |
| One account inactive for a fortnight/month | Provider configuration decides refresh/session availability; Pulse checks its current lease. No new blanket login-day wait. |
| Old/offline device | Server rejects replaced lease immediately; UI catches up on reconnection. Instant offline notification is impossible. |

This is correctness/concurrency testing on a disposable PostgreSQL instance plus actual handler tests with provider mocks. It is not hosted load testing, real Turnstile scoring, device-farm testing or a guarantee of one human per vote.

## How time-spent tracking could improve Pulse

Measure whether people accomplish useful tasks, with time as context. A healthy daily voting app may have a **shorter** successful session after a UI improvement. More minutes can mean slow CAPTCHA, unreadable text, confusing navigation or a network failure rather than engagement.

Useful questions and measurements:

- **Can a visitor finish voting?** Home → answer selected → confirmation → verification → server receipt. Track completion rate, errors and median/90th-percentile time to receipt. A long verification segment indicates a CAPTCHA/network/device issue; do not optimize it by removing duplicate checks.
- **Do people return for results?** Yesterday/Past Results views and day-1/day-7/day-30 return cohorts. Check whether the dismissible yesterday teaser helps result discovery. Distinguish calendar-day UTC behavior from local-time cohorts when interpreting return patterns.
- **Is Brewing useful?** Browse → question opened → upvote confirmation → accepted support; Ask → similar question opened or accepted intake → published. Viewing an existing question instead of submitting a duplicate can be a good outcome.
- **Does sharing help?** Share-sheet opened, Copy link, public link opened, app opened from that occurrence, and eventual accepted actions. The native share sheet cannot reliably prove that a message was posted, and an install cannot always be attributed/deferred-linked. Label those separate measures honestly.
- **Where does the experience fail?** Coarse app version, OS family, latency/error category and locale can reveal usability issues. Keep account/device-security data separate from engagement analysis. Accessibility settings should help users, not become an abuse or fingerprinting signal.

If implemented later, count foreground time separately from interaction-active time. Pause on background; bound heartbeat intervals so a crash/offline period does not become hours of usage. Consider an inactivity threshold, but long reading or screen-reader use should not be labelled failure. Report distributions and conversion funnels by version/cohort, not just a global average. Exclude development/stress traffic. Small cohorts need minimum-size/privacy safeguards; avoid publishing identifiable rare groups.

Use optional, clearly explained analytics with a Settings control where appropriate, short retention and coarse/aggregated events. Do not collect email addresses, raw device fingerprints, OTPs, vote choices, question drafts, session replay or keystrokes for engagement. Guest measurement can use a dedicated, resettable analytics identifier distinct from the security device key; authenticated retention can use a purpose-specific pseudonymous identifier if justified. Limit offline queues, deduplicate event IDs and handle retries. Do not make an analytics outage block voting. These collection choices, retention and consent should be settled before a telemetry implementation.

Start with a small dashboard: successful vote completion; p50/p90 time to receipt; verification failure rate; results return rate; Brewing support conversion; published-question completion; D1/D7/D30 retention. Use those to pick one change, compare comparable release cohorts or a controlled experiment, and keep a guardrail on errors/accessibility. **No engagement tracker has been activated in this implementation.**

Official references (provider settings should be checked against the current dashboard):

- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developer.android.com/google/play/integrity/overview
- https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity
