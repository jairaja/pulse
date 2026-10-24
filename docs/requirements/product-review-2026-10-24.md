# PULSE product review — 24 October 2026

**Status: review proposal, not implementation approval.** This document addresses the owner's 27-point request. No app, API, migration, permissions or runtime terminology is changed by this review. Prototype screens use sample data only. Recommendations below are explicitly proposals; they do not silently replace currently deployed guest voting or security behavior.

## Decisions and current gaps

- **Guest daily voting is confirmed by the owner:** keep guest YES/NO voting; require verified sign-in only for Brewing submissions/upvotes. Guests also browse/share. The contradictory sentence in point 1 is superseded by that clarification. Guest history includes ongoing guest answers, not just an old migration. No account can be inferred for an unidentified person using another unlinked device.
- **Reject the blanket login-day voting ban as a security replacement.** Keep independent server account/question and recognized-device/question uniqueness, idempotency, active-session checks and risk controls. Repeated requests from an already eligible session alone disprove the assumption that a wait until midnight proves no previous vote. A wait also discourages people invited to upvote today and burdens legitimate new-device/recovery logins. If retained for a measured abuse experiment, it is an additional server policy, never an identity proof.
- CAPTCHA is a bot-friction signal, not proof of a person or physical hardware. Device attestation is different, does not give a universal permanent device ID, and does not prove one natural person. Never reuse a redeemed CAPTCHA token for other actions.
- Current `lib/auth.tsx` automatically attempts `claimAccountHistory()` when an account session becomes available. It is not the proposed once-only, consent-based signup import. Current `claim_installation_history` also permanently binds an installation to an account; safe shared-device/account-switching policy needs redesign rather than promising that another email will simply work.
- Current Brewing upvotes write through an authenticated RPC without the daily gateway's CAPTCHA/device-verification chain. Human/physical-device upvotes need a server integration and removal of the old unprotected write path. Hiding a button is insufficient.
- Current signed-out vote attribution uses a persisted installation/account association; that is not proof of a currently signed-in user. Review `submit_vote` before changing logout/import behavior: new guest votes must remain unowned rather than silently crediting the last account. Security associations and consent-based history ownership need separate models.
- Current My Pulse is a placeholder. Single active-session enforcement, sharing/verified link fallback, AI moderation/search, expanded accessibility/view preferences and Admin role-management/publishing are not implemented by these docs.

## Terminology

| Previous product role | New product role | Privileges |
| --- | --- | --- |
| Guest | Guest | Public browse/share, eligible device-checked daily YES/NO vote, device-local history/preferences |
| Signed-in user | Member | Guest + eligible daily vote, one submission and one upvote per UTC day, own history |
| Admin / administrator (old product role) | **Moderator** | Member + audited removal of inappropriate open candidates |
| Superuser (old product role) | **Admin** | Moderator + managing Moderators and publishing Announcements |

The product surface is **Announcements**. Platform push APIs, database `superuser` privileges, provider identifiers and historical audit strings keep their actual technical names. Existing stored role `admin` currently means future Moderator; stored `superuser` means future Admin. A reviewed forward migration and API/client compatibility plan must apply this two-way mapping without collapsing privileges or rewriting append-only historical audit records. Code renaming is deferred under “no code yet.” Existing rollout SQL refers to current stored values, not the future labels.

## 1. Share any public question and preserve its identity

Use the native share sheet for WhatsApp, Messages, Telegram, Signal and available social apps; include Copy link. A successful published submission has Share question and View in Brewing actions. Other public Brewing/live/finalized questions are shareable by everyone, including guests. Share only published content; a pending/removed question must not leak through public links or image previews. Default shares are neutral; including the sender's answer/nickname requires explicit choice, never email, device identifiers or private history.

Use one stable HTTPS public link per question occurrence, for example `https://<owned-domain>/q/<public-id>`. A resolver maps its submission to the current Brewing/live/finalized state and exact question, including the submission-ID → selected-daily-ID relationship. Repeated wording on another day remains a separate occurrence; do not identify questions by their text. Installed apps use verified iOS Universal Links / Android App Links; live questions open Home, finalists open the exact Past Results detail, candidates open/highlight Brewing. Maintain a destination through sign-in without auto-casting a vote.

Without the app, show a small public question landing page with the appropriate App Store/Play Store action and Open app; desktop offers both stores/QR. An automatic store handoff can be attempted where supported but should retain visible choices. Embedded browsers, user settings and link verification prevent a 100% universal auto-open promise. Social apps differ in image/text/link support; Instagram images/feed captions are not guaranteed clickable. Store installation alone does not reliably preserve the original question on iOS: MVP instructs “After installing, tap the original link again.” Android Install Referrer can help a later deferred-link design; do not add invasive fingerprint-based attribution. Do not build on retired Firebase Dynamic Links. Test expired/removed/malformed links, app upgrade, browser back and locale fallback. Withdrawal can stop future public responses and request cache purges, but cannot recall an image or text already shared/downloaded by another service.

## 2. Phones and tablets

Recommend supporting physical phones **and tablets** for reading, sharing and eligible participation. Tablet exclusion does not prove humanity or stop device farms, and excludes accessibility/shared-family use. The repository currently enables iPad support and accepts phone/tablet signals. Responsive list/grid can serve tablets well.

If a phone-only MVP is chosen, distinguish store discovery, installation and service eligibility. Play device-catalog/manifest filters do not reliably prevent a shared APK being sideloaded; actual OS/CPU requirements can still prevent some installs. Setting Expo `supportsTablet:false` targets iPhone layouts but does not guarantee iPad installation is impossible (compatibility mode may apply). An IPA needs valid signing/provisioning/distribution and cannot normally be installed merely by sharing a file; authorized compatible devices may still install it. Client device-type checks can be forged. Attestation does not universally attest “phone rather than tablet”; any strict service-side form-factor rule needs trustworthy platform evidence and must state its limits. Recommend supported secure OS/WebView/device integrity rather than screen size as the eligibility boundary.

## 3. Guest My Pulse

Keep the destination accessible and useful: show server-accepted **unowned guest answers on this device**, a device-only activity count and finalized comparisons where enough data exists. Label “On this device” and explain that it will not follow a new device. Offer account creation/import without blocking history access. Empty guests see benefits and Browse past results, never invented charts.

Clear/hide signed-out account-derived answers; guest access must not expose another account's private history. Device-only unclaimed answers may include another person on a shared device, so disclose that limitation and make import opt-in. An accepted vote/quota can remain consumed even when the private choice is hidden. Never equate device possession with ownership of all its past answers.

## 4–5. One-time history import and later restoration

Import is technically possible only from **server-accepted, unowned device votes**, not arbitrary local cache entries and never another account's answers. Unowned means no account ownership in the authoritative vote/history relations; a nullable raw vote column alone is insufficient. A vote must not be claimed by two accounts under concurrent import attempts, and an existing account answer for that question is never overwritten. Recommend opt-in, unchecked, because a shared device's earlier answers may belong to someone else. If the owner prefers opt-out, disclose that tradeoff explicitly and still show what is being included.

Preferred timing is immediately after successful OTP verification, when the server can identify a genuinely new verified account without public email enumeration. If the checkbox must be on the OTP screen, label it conditionally: “Add this device’s earlier votes if this creates a new account”; show the same pre-verification UI for existing/new emails. Server-side eligibility, not a client flag/email lookup, decides whether it can run.

Create a single signup import entitlement bound to the new verified auth UID, signup session and originating device, with a frozen eligible-history cutoff. `pending → applied` or `declined` is one-time and audited. A failed response may retry the **same** entitled operation, including controlled same-device onboarding recovery, but an existing account signing in later/on another device cannot gain a new import. A user row may exist before OTP is verified, so `auth.users.created_at` alone is not sufficient evidence. Seal a decline; do not silently import later. Concurrent first sign-ins must choose one originating ceremony. Imported history never changes votes/results or their acceptance time, and opting out does not erase a device's already-used voting quota.

Later logins load canonical account history/preferences into an account-scoped cache. Replace the account view, not the immutable vote ledger or unrelated public content. Do not import the new device's local history, mix accounts, or silently destroy unclaimed history. Strip old account private caches/subscriptions before showing the new account. Show “This device already voted” without revealing a previous person's choice where history is not owned by the current account.

## 6. One active device session

Replace the old session only **after successful OTP verification**, not after entering another person's email or requesting a code. Claim a server session generation atomically; invalidate/revoke the old session at every authenticated action boundary, not only when its refresh token expires. Private Realtime delivery can update an online old device promptly; start/foreground/reconnect validation recovers missed events. An offline/suspended device cannot be visually logged out instantly, but its private writes must be refused when it reconnects. Handle simultaneous verifications, stale JWTs and lost-device recovery. Do not let a stale old logout revoke the new lease.

## 7–10. Duplicate voting, login/logout restrictions and copy

Keep account identity (verified auth UID) and recognized device evidence as separate server inputs. Email is a verified contact claim, not a device ID or one-human proof. Database uniqueness and canonical-history checks enforce account/question and device/question limits under concurrent requests. A single eligible session can submit repeated fresh requests; a midnight waiting rule does not count or deduplicate them. In a guest model, an unlinked second device cannot be attributed to a particular account. A device logout ban itself requires identifying that device, so it cannot eliminate device checks.

Recommended: no automatic next-day lock for ordinary sign-in/logout. Guests may continue daily voting after logout only if that recognized device has not already voted for the question and passes the security checks. New guest votes must not silently belong to the last signed-in account. After A logs out, B may vote on that device only if **both B and the recognized device** are unused for that question and all integrity checks pass. Already-used account/device limits survive logout, storage clearing and account switches where the signals remain available. Consider targeted temporary risk restrictions only on evidence; device recall is best-effort, not an impossible permanent hardware guarantee.

OTP copy: **“Enter the code sent to {email}. Signing in here will sign your account out on any other device.”**

Import opt-in: **“Add earlier votes from this device to my new account.”** Helper: **“Only votes not already linked to an account. Leave this off on a shared device.”**

Logout copy: **“Log out of Pulse? Your account history stays saved. Logging out won’t reset today’s votes or your upvote allowance.”** Buttons: Log out / Cancel.

If the owner retains the additional wait policy, enforce `eligible_from` by server UTC day for the account/session/device as specified, including an empty/delayed live-question slot. Apply it consistently to daily votes and upvotes; browsing/sharing/question submission remain available. Auth refresh is not a new login. Exact copy: **“After you sign in, daily voting and upvotes will unlock at 00:00 UTC on {date} ({timeLeft}). You can still browse, share and ask a question now.”** Logout variant: **“You’ll be signed out. Under this policy, signing in again pauses that account’s votes and upvotes until the next 00:00 UTC. This device’s restriction ends at 00:00 UTC on {date}. Your existing activity stays recorded.”** Because guest daily voting is confirmed, a conditional wait-policy screen may add “If this device has not voted yet, you can answer today’s question before verifying the code.” Do not show that as pressure to vote or imply the entire app becomes unusable. It is unnecessary under the recommended no-wait policy. Define manual, forced, expired and recovered session treatment explicitly before implementing any quarantine.

## 11. Yesterday on Home

Show a compact “Yesterday’s result” teaser under today's primary question. Keep it until the next UTC rollover, even after first viewing; do not auto-disappear on first view. Offer Dismiss for this specific result and retain a Past Results link. Remember dismissal device-locally for guests and in account preferences if cross-device consistency is desired. Never let yesterday dominate the live action or reveal today's partial totals.

## 12. Session duration

Proposed starting policy: **30 days of authenticated inactivity and a 90-day absolute re-verification limit**, subject to Supabase plan/support and measured friction. Daily/weekly/fortnightly use stays signed in until that absolute limit; a return at/after 30 inactive days asks for a new OTP. Background refresh alone is not user activity. Restore data after re-verification; never discard history. Session replacement, security revocation or account deletion ends access immediately at the server. Use secure token storage; no daily OTP requirement. If the owner favors indefinite active sessions, retain the inactivity/risk controls and document that alternative rather than implying the current defaults implement either policy.

## 13–15. Brewing upvote journey and bot friction

Before the first submission of an upvote, show a compact confirmation sheet with the full target question: **“Upvote this question? You have one upvote per UTC day. It can’t be changed after it’s recorded.”** Buttons Upvote / Cancel. No quota is consumed by opening/cancelling a sheet or by a failed security/network request. Disable confirm while sending; only a server receipt records success. If a response is lost, retry the same idempotent action or reconcile allowance; never count a second request as a second action.

On success mark the chosen control with a check and “Upvoted today”; disable other upvote actions for that UTC day while preserving readable counts, sharing and browsing. Show **“Today’s upvote is used. Your next one is available at 00:00 UTC on {date}.”** If a conditional login-day policy is selected, show its distinct unlock reason/date, not “upvote used.” Self-upvotes remain unavailable by immutable author account identity. Guests get a clear sign-in explanation; no CAPTCHA for mere browsing.

Use server JWT + active lease, account/day uniqueness, idempotency, physical-device integrity policy, request-bound nonce/replay protection, rate limits and risk scoring. For parity with device-limited daily voting, propose an additional recognized-device/day upvote guard to prevent account switching on one phone from multiplying upvotes. This deliberately restricts shared-device households and needs owner approval; show a distinct device-already-used reason without naming the other account. The current RPC does not implement it. Cover revoked sessions, removed/selected targets and boundary races; the server repairs rollover before a late write. Revoke/deprecate old direct write paths when a protected gateway ships. CAPTCHA should be a risk-triggered step-up (new session/device, suspicious activity or time-limited assurance expiry), not an unexplained repeated puzzle for every ordinary action. Existing per-vote CAPTCHA stays until an equivalent reviewed replacement ships. A CAPTCHA token is short-lived/single-use; any longer assurance is a separate server-issued, scoped expiring signal. A long-lived sign-in is not a permanent human/device verification. Preserve legitimate OS accessibility input (screen readers, voice/switch controls); do not classify all assistive automation as a bot. Fresh request-bound attestation/assertions continue according to platform protocol.

Allow the same member to support the same **still-open, non-owned** question on different UTC days. Enforce one total upvote per account/day and idempotent same-day retry. Label totals as accumulated upvotes, not unique supporters. This may favor persistent campaigns; retain discovery filters and audit abuse rather than secretly changing ranking. Multiple emails/devices remain a residual Sybil problem; no one-human-one-vote claim.

## 16. Per-screen list/grid preferences

Default to list; offer two-column grid independently on Brewing and Past Results. Persist `brewing_view` and `results_view` locally for guests and server-side per account for members, restoring on another device. Whitelist values and patch fields so a language/theme change cannot erase a view preference. Account changes must not replay A's pending settings under B. Larger text/narrow widths may make the grid unsuitable: use a readable list temporarily with an explanation, retaining the requested preference. Do not shrink/truncate the full question to force a grid.

## 17. Counts

Show exact finalized YES/NO totals and denominator in Past Results, read from the immutable result snapshot. Brewing shows exact accumulated upvotes. Use compact visual formatting such as 1.2K when useful, with the exact total on detail/accessibility text. Avoid arbitrary 100+/500+ buckets that obscure whether an upvote registered or which candidate leads. Totals describe PULSE participants, not a representative sample of the whole world. No raw daily-question interim results are exposed. Engagement effects need an ethical experiment, not an unsupported claim that a particular bucket increases engagement.

## 18. My Pulse for members

Provide Daily answers, Upvoted questions, Submitted questions and Selected questions, with date filters and links to exact current/public states. Keep history even when a candidate becomes selected; record each day's upvote separately and show “Supported on 3 days” rather than implying three unique supporters. Removed questions show a neutral unavailable state without exposing private moderation reasons by default. Selection is a status/badge, not a second submission.

Useful summaries: total questions answered, YES/NO distribution, activity over time, questions submitted/selected, and alignment with the finalized PULSE majority **only on questions the user answered and whose results are finalized**. Exclude ties and zero-vote results from a defined alignment denominator, show the denominator, and avoid personality/moral scores or representative-population claims. Start with summaries and an accessible bar chart; do not add a pie merely for decoration. Every chart has text/table equivalents and no color-only meaning. Empty/low-volume states are honest; legacy 10-answer insight threshold is a proposal, not a prerequisite for viewing one's history.

## 19–20. Role and Announcements naming

Apply the terminology table to product requirements, journeys, draft issue titles/bodies and prototypes now. Plan the runtime/API/DB labels and migration separately under the no-code constraint. Admins alone publish Announcements/manage Moderators; neither role can pick a daily winner. Preserve actual platform/API and PostgreSQL security terminology, and explain historical stored-role values rather than rewriting audit evidence.

## 21. Ask a question, search and moderation

Move the compose action to a top-right **+** on Brewing. It opens a dedicated Ask a question screen with Back returning to the prior list position/filter. Guests and members whose daily slot is used get an unavailable visual state, but the explanatory control remains focusable/tappable: a truly disabled native button cannot show a tooltip. Show a readable sign-in/reset explanation and action, not a hover-only tooltip or a write/navigation into an unauthorized form.

Recommend **180 user-perceived characters (Unicode grapheme clusters)** for new source questions, with a separate bounded request-byte limit. Current client UTF-16 counts and server code-point length differ; both need one explicit new counting contract. Preserve legacy/translated wording and never truncate a proposition; translations may need a larger bound. 180 is a review recommendation, not an applied schema change. Show a live counter and language-aware validation, preserving the draft on recoverable errors. Do not impose a universal five-character minimum: a short Chinese question such as “开心吗？” is a valid four-grapheme YES/NO question. Require nonblank, meaningful content and evaluate wording rather than adding filler to meet an English-centric minimum.

Tips: ask one clear YES/NO question; use neutral wording; one idea; avoid assumptions/leading language, personal details, advertisements, links, harassment and repeated active questions. Account/day reset is 00:00 UTC; a pending review occupies the same daily submission slot. Submission is not a guarantee of selection.

Start typeahead with server-side indexed lexical/full-text + trigram/prefix matching, locale-aware normalization and a debounced/cancelable request (about 300 ms, useful minimum prefix). Query published Brewing/live/Past Results only; show at most six scoped suggestions with status labels. Test Hindi/Bengali/Urdu and Chinese tokenization separately; PostgreSQL's English dictionary or trigram search alone is not semantic multilingual search. Keep raw drafts out of public logs/third-party AI calls per keystroke. Exact active duplicates can direct to the existing question with transactional duplicate protection; near matches should suggest, not falsely block. Past questions may repeat as new dated occurrences, consistent with existing product intent.

Selecting a suggestion opens/highlights that exact question in Brewing/Past Results or Home for the current live question, preserving draft and return position. Add semantic embeddings only if measured multilingual recall justifies cost/complexity; do not claim to know Quora's private algorithm or promise AI correctness.

Use a staged pre-publication policy: format/duplicate/abuse checks followed by an asynchronous, bounded AI triage; uncertain content goes to human review. Show Pending review with a durable status/receipt; no upvotes/public sharing until published. Outage/timeout remains pending rather than silently publishing unreviewed content. Evaluate false positives/negatives across all supported languages before rollout; provide an appeal/edit path. Reserve one daily slot at server-accepted intake, allow limited edits/retries to that same submission, and do not refund a published-then-removed slot. Validate before intake where possible. Use `published_at` in midnight eligibility: content published after the boundary cannot retroactively win it, even if submitted yesterday. Do not promise real-time provider latency without measurements.

## 22–24. Journeys and testing

See `docs/reviews/2026-10-24/journeys-and-manual-tests.md` and the interactive prototype for Guest/Member/Moderator/Admin branches. Add automated E2E journeys (recommend a small Maestro suite on preview builds), integration/RLS/concurrency tests and targeted unit tests. The repository already has a recorded foundation of 26 Node cases/200 PostgreSQL assertions from the previous implementation; that is not coverage of the proposed features or a physical-device E2E suite. Use isolated fixtures/test accounts and safe OTP handling, never a production auth bypass. Test values/invariants and real outcomes, not implementation-mirroring assertions or arbitrary 100% coverage. Physical accessibility, share targets, link handoffs and security-device tests still need manual acceptance.

## 25. Vote storage and cost

Keep one **logical indexed votes table**, not one independently managed table per question. Past Results already reads `question_results` finalized aggregates, not repeated raw-vote counts per visitor. PostgreSQL table metadata estimates are not authoritative exact counts. At larger proven scale, consider declarative time/hash partitions under one logical table, aggregate snapshots, keyset pagination, caching, connection pooling and bounded read workloads. Partition uniqueness/FKs, idempotency and account/device guards must remain globally correct; partitioning is not simply adding a date column and hoping existing unique constraints still work.

Capacity assumptions, 1K/100K/1M/100M scenarios and cost limits are in `capacity-and-storage.md`. They are arithmetic planning estimates, not a hosted benchmark or Supabase price quote. Per-question tables do not eliminate write volume, constraints, backups or aggregate work; they complicate history, migrations, permissions and cross-question queries. Avoid per-vote writes to one hot total row; finalize once under a correct snapshot/closure protocol, and maintain separate read models for expensive history/insights where justified.

## 26. Account/device associations

Yes, keep a **private, minimum necessary many-to-many account/device-session association** with first/last seen, active/revoked lease and bounded security events. It supports session replacement, alerts, shared devices and abuse review; it is not permanent ownership of a device by the first email. Use account UUIDs and opaque/HMACed installation/device references, not raw fingerprint/email bundles in public tables or logs. Separate current-session ownership, historical device relationships and immutable vote eligibility. Retention/deletion and changed-device-ID/reinstall cases need explicit policy. Neither attestation nor this map identifies a unique human or guarantees an unlimited lifetime device ID.

## 27. Accessibility settings

Add an Accessibility section with text size, high contrast, reduced motion and useful display options (system defaults first). Always respect OS font scaling/screen-reader settings; app settings must not disable larger OS text or force tiny grid labels. Account preferences persist across devices; guest choices persist locally. Contrast targets: 4.5:1 normal text, 3:1 large text and meaningful UI boundaries; target 44 pt iOS/48 dp Android touch areas, visible focus, labels, non-color state cues, RTL and full 200% text testing. Confirm actual standards in implementation review, not by assuming the mockup certifies compliance.

## Glossary for the earlier response

- **Draft rows / legacy drafts:** database records from the old administrator-scheduling design, preserved to avoid deleting existing data. They are not a new user-facing draft queue and cannot reserve the next daily question. New private compose/review drafts have their own future lifecycle.
- **RPC:** Remote Procedure Call: an app invokes a named backend/database operation such as “get today's question,” rather than directly editing tables.
- **Installed older apps:** people may still run an APK/iOS version from before a change. The old preview operation returns an empty answer so those clients don't reveal obsolete drafts or immediately crash. This does not guarantee indefinite backward compatibility for unsafe write APIs.
- **Partial unique index:** a database rule that enforces uniqueness only on matching rows. Here it allows at most one live/finalized daily question for each UTC date; ignored old scheduled records cannot reserve that date.
- **Missed job:** the `pulse-daily-finalization` task scheduled for 00:00 UTC. It freezes the ended question's real totals, selects the community winner, opens the new day and removes that candidate from Brewing. Read/write catch-up repairs a missed boundary before returning relevant data; it does not manufacture votes or open tomorrow early.

## Review decisions still needed

Additional device/day upvote cap versus shared-device inclusion; whether to retain any experimental login/logout cooldown despite the recommendation against it; signup import opt-in versus opt-out; tablet support; session expiry limits; 180-grapheme source limit; moderation intake/edit/appeal policy. The implementation must not begin until these product decisions are clear. This is a requested review gate, not an instruction to stop producing the complete review artifacts.
