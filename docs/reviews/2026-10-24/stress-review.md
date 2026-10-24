# Stress review evidence and limits

Run `node docs/reviews/2026-10-24/review-models.mjs` to reproduce the offline review; `model-results.json` stores the result. No current application behavior is modified. “100,000 attempts” is a sequential model of eligibility predicates, not requests to Supabase or a concurrent load test.

| Experiment / counterexample | Result / implication |
| --- | --- |
| 100,000 fresh action attempts from a session logged in yesterday | A login-day check alone allows all 100,000. Modeled independent account/question and device/question guards accept only one. A delay is not a duplicate counter. |
| Used account + fresh device; fresh account + used device | Different failure conditions; one check cannot substitute for both. A guest on a wholly unlinked device cannot be attributed to an account by these guards. |
| Login 00:01 versus 23:59 UTC | A same-day ban waits 1,439 minutes versus 1 minute, despite no demonstrated risk difference. It undermines same-day sharing invitations. |
| 100 accounts support one open question for 1,000 days | 100,000 permitted upvote events under one-total-per-account/day. Label as accumulated upvotes, not unique people/supporters. |
| 100 accounts on one shared device in a day | Account/day rules alone allow 100 upvotes; an additional device/day guard allows one. This counters account-switching abuse but also excludes legitimate shared-device users. It is an explicit owner decision, not implemented by this review. |
| New-account import model | Only server-accepted, unowned pre-cutoff history is eligible; an applied retry is idempotent, a decline stays declined, existing accounts and a different originating device cannot import. The server's ability to establish those trusted facts is assumed, not implemented/tested here. |
| 1,000 modeled session replacements | Only the latest generation authorizes a private action. Atomic claim and real revocation delivery still need server/concurrency tests; offline visual logout is not modeled as immediate. |
| Typeahead response 2 arrives before response 1 | Ignore stale response 1 using request sequencing; cancellation alone is insufficient if an old response completes anyway. |
| “Should schools start later?” / “Should schools start earlier?” | 60% simple word-set overlap despite differing propositions. Lexical or semantic similarity is not safe evidence to automatically reject a near duplicate. |
| Share target moves Brewing → live → finalized → removed | A stable public occurrence resolver needs each route, including unavailable fallback. Real Universal/App Links, stores, embedded browsers and install attribution were not tested. |
| 1K / 100K / 1M / 100M DAU model | Arithmetic capacity bounds only; no database throughput or price quote. See the capacity review. |

Additional design attacks addressed in the requirements/manual matrix: request-code logout denial of service; stale access tokens after refresh revocation; account-switch cache leaks; automatic import despite opt-out; shared-device history disclosure; duplicate share links after selection; pending content becoming eligible after midnight; moderation outages; phone-only store filters bypassed by sideloading; CAPTCHA relay/replay and changed device IDs.

## Remaining validation before implementation/release

- Real transactions for first-signup entitlement, single-session claim, protected upvotes and preference patches, including simultaneous requests and lost replies.
- Independent security review of attestation, current-session checks, device evidence and old-client write endpoint cutover. No CAPTCHA/token/device-identification guarantee follows from this model.
- Measured multilingual retrieval/moderation corpus (including negation, different propositions with similar words, Chinese short prefixes, Hindi/Bengali/Urdu normalization and provider outages). No actual AI model/Quora algorithm benchmark is claimed.
- Physical Android/iOS/phone/tablet, share-target/browser/store, accessibility/screen-reader/RTL, large text/grid fallback and lifecycle tests.
- A separately approved hosted load test with dataset, compute tier, traffic mix, costs, limits and stop criteria. Do not reinterpret in-memory model event counts as production users or requests/s.
