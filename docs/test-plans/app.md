# Pulse app — hosted test acceptance plan

Prepared 10 November 2026 against the implemented account/community journeys. **This is a test plan, not a record of completed tests. Every case starts NOT RUN.** The older October review includes proposals that this plan does not treat as implemented requirements.

## Setup and recording results

Use the hosted **test** Supabase project only. Confirm the mobile build's API URL, public key, CAPTCHA page, deployed functions and migrations all refer to that environment. Record the Git commit, build ID, project reference, device/OS/WebView, UTC date, Auth settings, OTP lifetime, SMTP/default service, enabled AI worker and link domain. Never record OTPs, access/refresh tokens, device peppers or SMTP keys in tickets, screenshots or shared logs.

Prepare the following without repeatedly resetting quotas or deleting accounts:

- Physical devices A and B. Ideally test Android + iPhone; also use two Android phones while Apple signing is pending. Expo Go can cover compatible public/auth UI but cannot establish Pulse's verified domain association. A simulator cannot pass the physical-device checks; record that as a blocked physical-flow test, not a product failure.
- Accounts NEW-IMPORT and NEW-DECLINE (never previously registered); EXISTING (with saved history/preferences); OTHER; MODERATOR; ADMIN. Use inboxes your current email transport can deliver to. Plus-address aliases are provider-dependent; do not assume different aliases are different people/devices. Do not give ordinary testers Supabase organization access to work around email restrictions.
- Public fixtures: a live question; finalized YES/NO/tie/zero-vote questions; at least 25 finalized questions; at least 25 published Brewing questions; own/other candidates; pending and hidden submissions; near-tied candidates with different timestamps; ten finalized non-tied personal answers for the comparison threshold. Use the existing development data scripts in the test project and document fixture dates. Operator-created fixture data must not alter a genuine production vote.
- Known UTC boundary window, e.g. start at 23:55 UTC and observe through 00:05 UTC. Changing a phone clock is not a way to advance the server's UTC day. Accelerated boundary/concurrency tests belong in a disposable isolated database, followed by a real hosted midnight observation.
- Supabase Authentication logs, function logs, Table Editor/SQL Editor, two inboxes, screen recording and a results sheet. DB/API probes below are operator tasks; a normal tester never needs a service-role key.

For each case record: **ID | build/device | UTC time | fixture/account alias | steps/variation | expected | actual | PASS/FAIL/BLOCKED/NOT RUN | sanitized evidence | bug link**. A screenshot of “Vote counted” is insufficient evidence of uniqueness: compare accepted rows and receipts as well. BLOCKED means missing setup or unavailable platform, not PASS.

Priorities: **P0** = release blocker (authorization, ownership, uniqueness, UTC correctness); **P1** = core journey/UX; **P2** = extended compatibility, resilience or capacity. Repeat P0 cases on each supported physical platform and any changed authentication/security implementation.

## Recommended execution order

1. Confirm email/OTP/CAPTCHA works once for new and existing accounts (A01–A07).
2. Complete guest vote → new account import → logout → existing login (I01–I08, L01–L06).
3. Test both directions of device/account duplicates and two-device session replacement (S and V).
4. Test submit → review → publish → upvote → daily selection (Q, M, U, T).
5. Test history, preferences, sharing and accessibility (H, P, D, X).
6. Test failures and operator security/concurrency checks (R, O). Observe real midnight and do a final clean happy path.

## A. Email, OTP and post-OTP CAPTCHA — P0

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| A01 | Request signup code for NEW-IMPORT; inspect newly delivered email. | Code appears as six digits, correct Pulse subject/body; no localhost link required. User record alone is not proof of completed login. |
| A02 | Sign out; request a code for an existing account. | Existing-account template also contains a six-digit code; complete OTP + CAPTCHA successfully. |
| A03 | Enter malformed email, blank email, surrounding spaces, then an ordinary valid address. | Clear validation; normalization is consistent; no crash or misleading sent-state. |
| A04 | Enter blank/short/non-digit/wrong OTP, then correct newest code. | Invalid attempts do not sign in or replace another device; correction is possible subject to limits. |
| A05 | Let a code expire; request another; try the expired code. | Expired code rejected; new flow can succeed. Record actual configured expiry, not an assumed duration. |
| A06 | Press resend before/after the visible cooldown; request repeatedly only within agreed test limits. | Client cooldown works; server/provider rate limits give a recoverable error; no request storm or account-enumeration detail. |
| A07 | Submit correct OTP and complete human verification. | CAPTCHA follows OTP. Only after both succeed does Pulse activate the account lease and restore/import history. |
| A08 | Cancel/fail CAPTCHA after correct OTP; retry promptly without killing the app. | No private account journey before completion; short-lived in-memory retry can reuse verified OTP session while valid; no reusable CAPTCHA token. |
| A09 | Kill/restart after OTP but before CAPTCHA; allow ceremony to expire in a separate run. | No durable signed-in Pulse session; request a fresh code when required. |
| A10 | Request OTP while offline; disconnect during OTP verification; reconnect. | Clear pending/error state; no fake success; retry/resend works without losing existing account data. |
| A11 | Use the default email service with an allowed recipient and an outside recipient; alternatively repeat with configured SMTP. | Record delivery-policy rejection separately from bad OTP. With correctly configured SMTP, external verified test inboxes receive email within provider limits. |
| A12 | On B request a code while A is signed in; enter wrong code/cancel CAPTCHA on B. | A stays signed in. Merely starting or failing the flow does not evict A. |
| A13 | Lose network after the completion transaction commits; retry the same completion. | At most one lease/import; receipt/result reconciles. No second claim or changed import decision. Operator evidence required. |
| A14 | Open an old link-only email from before template changes. | It is not accepted as proof that the current code flow works; request a new email. No broken localhost link is part of the supported journey. |
| A15 | Finish signup, skip optional nickname, then set/change/clear it later. | Account is usable without a nickname; blank and normalized values handled; no nickname automatically added to public shares. |
| A16 | Enter a nickname beyond its 30-character limit; test whitespace and non-Latin text. | Clear validation without losing login/history; no truncated or silently published personal identity. Nickname persistence is currently local, not a promised cross-device profile sync. |

## I. First-account history import — P0

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| I01 | As guest on A cast one accepted vote, then create NEW-IMPORT on A with default checkbox checked. | Checkbox says “Add earlier votes from this device to my new account.” Eligible unowned earlier vote appears once in account history; raw global vote total does not increase. |
| I02 | Repeat with a separate new account/eligible fixture and checkbox unchecked. | No import; decline is consumed and cannot be reversed by a later login. |
| I03 | Resend before completing original signup on its origin device. | Origin signup entitlement remains usable for eligible earlier history; resending does not extend the frozen eligible-history cutoff. |
| I04 | Put guest history on B, then log in to EXISTING there, even if checkbox is checked. | Restore only EXISTING's account history. B's unrelated guest history is not claimed or merged. |
| I05 | Start signup on A but complete an existing-account login from B. | B cannot claim A's signup-device history. Account creation versus login is determined by server evidence, not checkbox/client metadata. |
| I06 | Sign in/out with OTHER, then create a new account on the shared device. | No vote owned by OTHER is exposed or transferred. Only eligible unowned history after the latest reset epoch can qualify. |
| I07 | Complete signup/import, log out, make a later eligible guest vote on another day, then log in to that existing account. | Later login never performs a second signup import. |
| I08 | Retry lost import responses or race two completions in an operator test. | One canonical owner, no duplicated history/counts, no transfer from another owner. |
| I09 | Fail/cancel CAPTCHA with import checked, then complete the original flow. | No import before activation; final eligible consent is committed once with the lease. |

## S. One active device and session lifetime — P0

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| S01 | Complete login for EXISTING on A, then B. Repeat B → A. | Most recently completed valid login is active. Old online UI resets via notice or foreground fallback (~15 seconds plus network delay); old private requests are denied after the committed replacement. |
| S02 | Disable Realtime delivery in an isolated test while keeping normal foreground connectivity. | Foreground fallback detects replacement; lack of a notice does not preserve authorization. |
| S03 | Put A offline or background it; complete login on B; return/reconnect A. | A cannot receive an instant offline notification; it resets at validation/reconnect. Stale private actions cannot commit. |
| S04 | In operator test, replay a captured old A JWT after B login. | Private REST and gateway operations reject it even if the provider token has not expired. Never put the JWT in a ticket. |
| S05 | Race two successful logins and a private action. | One current lease; authorization is checked transactionally. An action already committed before replacement is not retroactively undone. |
| S06 | Delay A's logout response/request until after B activation. | A's old-session logout cannot revoke B's newer lease. |
| S07 | Restart active app; background/foreground; allow provider access token refresh. | Valid current account remains usable; refresh does not create another account/history claim or reactivate an old lease. |
| S08 | Return after daily, weekly, 14-day and 30-day inactivity intervals. | Behavior matches recorded Supabase Auth configuration. No invented Pulse 30/90-day expiration policy; expired/revoked sessions prompt safe reauthentication. |
| S09 | Revoke the Pulse lease using approved operator tooling; separately revoke a Supabase refresh session and observe existing-token expiry. | Revoked Pulse lease denies private actions. Provider-only refresh revocation can leave an issued JWT valid until expiry; record the actual enforcement window rather than claiming instant provider revocation. |

## L. Manual/automatic logout and isolation — P0

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| L01 | Tap logout, inspect message, then cancel. | “Log out of Pulse? Your account history stays saved. Pulse will reset on this device.” Cancel keeps account and local data. |
| L02 | Confirm logout; inspect Account, My Pulse, drafts, nickname, preferences and yesterday dismissal. | Local account data is cleared/reset. Saved account history/preferences remain on the server. No other person's history is visible. |
| L03 | Repeat using automatic session replacement. | Same local isolation/reset behavior as manual logout. |
| L04 | Log out, then log back into the same account that day. | No blanket next-day ban. Eligibility comes from the separate question/device/account and UTC-day quotas. |
| L05 | After logout make a new guest vote on a later unused question/day. | Raw vote is unowned (`account_id` null), not silently credited to the last account. |
| L06 | Log out while old history/preferences/draft requests or writes are delayed. | Late responses cannot repopulate the reset guest state or overwrite the next account. |
| L07 | Log out offline or with a server error. | No misleading claim that the server lease was revoked. Error/retry preserves a recoverable flow; no cross-account data exposure. |

## V. Daily YES/NO voting and duplicate prevention — P0

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| V01 | Fresh eligible guest chooses YES, completes CAPTCHA and submits; repeat NO with another eligible fixture/device. | One accepted row/receipt per operation; selected answer and result-availability time are correct. |
| V02 | Repeat as a signed-in eligible account. | One raw accepted vote with correct account ownership; one account-history entry. |
| V03 | Double-tap submit; retry after a timeout/dropped successful response. | Server reconciles original acceptance; no second row, count or history item. |
| V04 | After acceptance submit a new request with the opposite answer. | No changed answer or second vote. Idempotent retry and conflicting request are distinguished. |
| V05 | Vote as EXISTING on A, then log into EXISTING on previously unused B and attempt same question. | Account duplicate check rejects, independently of device allowance. |
| V06 | Vote as guest/OTHER on A, then sign into an unused account on A and attempt same question. | Recognized-device duplicate check rejects independently of account history. |
| V07 | Vote, clear Android app storage/cache, force-stop and reopen; press submit repeatedly. | Device evidence may still recognize the phone: no extra row. Reconciled “already counted” is not a new vote. Confirm by database/receipt, not success color. |
| V08 | Repeat after logout, reinstall, timezone change and phone-clock change. | Clearing local state/time does not intentionally refund server allowance. Record identifier changes/platform limitations; do not claim a permanent hardware identity. |
| V09 | After another account's vote, inspect duplicate receipt in reset/guest state. | Device-used message may appear; previous account's answer is redacted, never copied into new guest/account history. |
| V10 | Cancel/fail/expire CAPTCHA or simulate provider outage. | No new vote row before required verification; browsing remains usable; no bypass or fake success. |
| V11 | Attempt vote offline or after the question closes. | No offline queue or late acceptance; refresh/retry explanation shows correct current state. |
| V12 | On a genuinely unused device/account, log in and vote on the same UTC day. | Allowed after OTP/CAPTCHA when otherwise eligible; no blanket login-day waiting period. |
| V13 | Shared device used by two people; one person uses multiple accounts/devices. | Shared-device exclusion is explained. Device/account guards do not establish uniqueness of a human across unrelated devices. |

## T. UTC daily lifecycle and selection — P0

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| T01 | Vote during the day's [00:00 UTC, next 00:00 UTC) window; watch receipt/countdown. | Correct UTC date, hours/minutes and next boundary; no noon transition. |
| T02 | Leave Home open through real midnight. | Old question closes, finalized result becomes available, new community winner appears without restarting; no live totals shown early. |
| T03 | Leave Brewing or Past Results open without visiting Home, then cross midnight. | Relevant lists and quotas refresh independently of Home. |
| T04 | Background/offline at midnight, reopen/reconnect afterward. | Refresh to actual server day; no late vote on stale question. |
| T05 | Observe with different device timezone and deliberately inaccurate phone clock. | Server-authoritative windows and eligibility hold; device time cannot open future questions. |
| T06 | Prepare highest-supported eligible published candidate and lower-ranked alternatives. | Highest cumulative support wins, leaves Brewing, becomes one live daily question. Other eligible candidates remain available. |
| T07 | Tie support counts with different submission timestamps. | Later submission wins; no Moderator/Admin schedule can override the ranking. |
| T08 | Publish a pending question after a boundary; include hidden/removed candidates. | Late publication cannot enter the already-passed selection; hidden/pending candidates cannot win. |
| T09 | Isolated operator test: miss finalizer, then read Today/Past/Brewing. | Existing catch-up repairs the missed rollover; never opens a future date early or creates two live questions/date. |
| T10 | No eligible candidates; zero votes; tied daily answers. | Honest no-live/zero/tie states. No fabricated fallback winner or percentages suggesting 100% NO for zero votes. |
| T11 | Observe 12:00 UTC without a day boundary. | No finalization, quota reset or new question triggered merely by noon. |

## Q. Brewing browsing and question intake — P1; quota/privacy failures are P0

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| Q01 | Guest browses, sorts, filters and shares; taps + and upvote. | All public cards accessible; protected actions explain sign-in; no guest submission/upvote. |
| Q02 | Change most-supported/newest/oldest and all/today/mine/others as applicable; paginate. | Correct account-specific filter availability, UTC interpretation and stable order; no stale cursor mixed with another filter. |
| Q03 | Switch list/grid using one toggle, restart, then inspect narrow/large-text views. | Choice persists; full question/time/count/share available; temporary list fallback does not erase grid preference. |
| Q04 | Member opens top-right +, types draft, follows a suggestion, returns with Back. | Separate Ask screen, tips and 180-grapheme counter; draft retained; correct prior destination/list state restored. |
| Q05 | Empty/whitespace, short valid non-Latin, 180/181 graphemes, combining marks, emoji and RTL. | Consistent client/server normalization/counting; 180 accepted if otherwise valid, 181 rejected; independent byte bound respected. |
| Q06 | Submit once then attempt another question on the same UTC day; test next day. | One accepted submission/account/day. Failure/cancel before acceptance costs no slot; next UTC day permits another. |
| Q07 | Search original text; type quickly so older reply arrives later; select live/Brewing/past suggestions. | At most six public suggestions for current text; correct exact destination; no pending/hidden leak. Similar wording alone is not rejection. |
| Q08 | Two accounts race exact active duplicate text; submit similar text with different meaning. | Exact duplicate rule enforced server-side; semantic similarity remains advisory, not an arbitrary block. |
| Q09 | Double-submit or lose response after accepted intake. | One submission and slot; pending state reconciles. |
| Q10 | Inspect pending as author, another member, guest and website visitor. | Pending remains private; author can access own Pending questions; not publicly upvotable/shareable. |
| Q11 | Edit own pending question using an allowed retry. | Limits/security still apply, revision changes safely; no additional daily submission slot. |
| Q12 | Empty feed, stale ten-minute cursor, error and reconnect. | Honest empty/error states, clear Refresh action; no silent loss/duplication of cards. |

## U. Brewing upvote journey — P0

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| U01 | Signed-in user selects another person's question. | Confirmation displays full question and one-upvote-per-UTC-day information. |
| U02 | Cancel confirmation or CAPTCHA, then choose another question. | No allowance consumed until accepted. |
| U03 | Confirm and complete CAPTCHA. | Chosen support recorded once; count/selected feedback reconciles; other upvotes unavailable with correct reset explanation. Read/share still work. |
| U04 | Tap repeatedly or drop response after commit. | Reconcile existing upvote, not a second event; allowance resolves uncertain state. |
| U05 | Try own question in UI and with a modified client/operator request. | UI unavailable with reason; server independently rejects self-upvote. |
| U06 | Switch accounts on A after using device's daily upvote. | Recognized-device/day allowance blocks a second upvote. |
| U07 | Move same account to B after using account's daily upvote. | Account/day allowance independently blocks another. |
| U08 | Clear storage/reinstall or delete/hide the supported candidate in isolated test. | Existing account/device daily quota is not refunded by local reset or candidate removal. |
| U09 | Next UTC day support the same still-open non-owned question. | Allowed once on the new day; history records distinct dates, not unique people. |
| U10 | Attempt while logged out, with old session, removed target or selected/live question. | Rejected; no event/count/allowance created for invalid request. |
| U11 | Commit at midnight; race different targets/accounts on a recognized device. | One account/device/day acceptance with server-aligned timestamp/day. No quota bypass by waiting on locks. Operator integration test required. |

## M. Human/optional AI moderation — P0 authorization, P1 review UX

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| M01 | Moderator/Admin opens pending list and publishes/holds with a reason. | Authorized revision checked; decision and actor audited; publication gives no scheduling priority. |
| M02 | Moderator removes a public candidate: cancel, short/blank reason, valid confirm. | Cancel changes nothing; invalid reason rejected; valid removal hides question and stores private actor/reason/time audit. |
| M03 | Regular member forges role metadata or tries review/removal directly. | Server denies; client labels never grant role. |
| M04 | Revoke test Moderator role while screen is open, then submit review/removal. | Current server authorization rejects obsolete privileges. |
| M05 | Two moderators act on the same revision; removal races upvote/finalization. | Consistent committed outcome, auditable conflict; no hidden candidate selected after removal commits first. |
| M06 | Guest/other member tries to read reason, author identity, pending text or private role tables. | No private moderation/account data in public interfaces. |
| M07 | With AI disabled/unavailable, submit and inspect pending. | Private pending survives; human review works. Do not expect automatic publication. |
| M08 | If AI enabled, test safe/unsafe/uncertain examples across supported languages and provider timeout. | Only accepted low-risk classification publishes; flagged/uncertain/error stays for review. Record false-positive/negative findings; AI is not perfect fact-checking. |

## H. Past results, yesterday and My Pulse — P1; private-history isolation is P0

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| H01 | Browse 25+ finalized questions and paginate; inspect YES/NO/tie/zero examples. | Exact counts, total and outcome agree with snapshots; no duplicates/missing pages. |
| H02 | View yesterday teaser, dismiss, restart, then reach next day. | Viewing does not auto-hide; dismissal affects that teaser only; Past Results still contains it. |
| H03 | With no current live question, inspect latest result/date. | Honest latest-result fallback, not misleadingly labelled today/yesterday. |
| H04 | Guest My Pulse before and after an accepted guest vote and response-loss reconciliation. | Device-local confirmed history only, each once; no borrowed account history. |
| H05 | Member My Pulse: Answered, Upvoted, Asked, selected status and pagination. | Activity matches account records; repeated supports on distinct days remain distinct; selected is original submission's status. |
| H06 | Inspect majority comparison at 0, 9 and 10 finalized non-tied answers; include ties/live questions. | Correct denominator and threshold, no divide-by-zero; excludes ties/unfinalized. Clearly refers to participants, not the whole world. |
| H07 | Open an activity whose question is pending/selected/hidden/unavailable. | Correct destination or safe unavailable state; no private content leak through public resolver. |
| H08 | Read guest/account/history prompts after first import and later login. | Copy reflects the current signup-only import feature and no blanket waiting period; flag stale “sync launches later” or review-only policy text as a UX defect. |

## P. Preferences, languages and accessibility — P1

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| P01 | Guest changes language/theme/view/accessibility and restarts. | Persist locally; a genuinely new device does not inherit them. |
| P02 | Member changes preferences on A, signs in on B. | Account preferences restored from DB, including independent Brewing/Past views. |
| P03 | Rapid field changes plus delayed saves while logging out/switching accounts. | Field patches do not erase other choices or write old account preferences into new/guest state. |
| P04 | Exercise all ten languages, including Arabic/Urdu RTL and language switching on each screen. | Usable labels/errors/OTP copy; published question translation or honest original fallback, not invented translations. |
| P05 | OS font scaling/200% text, Larger text, High contrast, Reduce motion. | Complete wording, counter, keyboard and buttons remain usable; large text can force list without erasing saved grid choice. |
| P06 | VoiceOver/TalkBack across OTP, CAPTCHA, vote, upvote confirmation, dialogs and filters. | Labels/states announced, sensible focus and return, no color-only feedback or inaccessible disabled explanation. |
| P07 | Tablet, landscape, keyboard open, small phone, dark/system appearance. | No hidden confirm/cancel action, clipping or unusable navigation. Tablets remain supported. |
| P08 | Settings → Supabase connection: successful check, failed check, Retry. | Correct current project/connection state and recoverable error; no secret credentials or private data displayed. |

## D. App sharing and independent link service — P1, conditional on deployed link setup

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| D01 | Share/copy public Brewing and finalized result to Messages/WhatsApp plus another messenger. | Correct stable public occurrence link; no email, device ID, private answer or automatic nickname attribution. |
| D02 | Cancel share sheet or use a destination that drops captions. | No false “posted” assertion; copy-link fallback available. |
| D03 | Open installed-app link from OS browser and two embedded browsers. | Exact destination/highlight, not merely generic Home; embedded-browser fallback usable. |
| D04 | Reuse same submission link after selection and later finalization. | Resolver follows Brewing → Today → Past Results. |
| D05 | Pending, hidden, unknown ID and malformed link. | Private-safe unavailable state; no crash or unrelated automatic vote. |
| D06 | Uninstalled phone and desktop open independent link domain. | Public landing and real configured store options; after install original link must be tapped again. No claimed automatic deferred restoration. |
| D07 | Marketing website unavailable while app/link service remains up. | App authentication/voting and verified app links remain functional independently. |
| D08 | Test Android preview versus Play certificate; physical iPhone when signed. | Domain association matches installed binary. Expo Go/simulator is not proof; mark missing Apple setup BLOCKED. |

## R. Reliability and compatibility — P1/P2

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| R01 | Cold start, upgrade installed preview, kill/restart on each key screen. | No missing-native-module startup, stale screen ownership or lost accepted transaction; new native dependency needs a new binary. |
| R02 | Slow network, airplane mode, Wi-Fi/mobile handoff and backend unavailable. | Honest pending/error/cached state; no offline accepted write or success from an unverified response. |
| R03 | HTTP 401/403/429/5xx, malformed payload, request timeout. | Recoverable safe error; no secret/raw stack leak or infinite request loop. |
| R04 | Return after a longer inactivity with expired/revoked Auth state. | Safe refresh or reauthentication; UI does not grant authorization from a cached profile. |
| R05 | Old Moto G4/Android 7 + old WebView/Chrome versus current supported devices. | Record installation, TLS and widget support separately. Untrusted certificate must fail safely; never disable SSL verification. Decide advertised support before release, rather than mark an unsupported challenge as passed. |
| R06 | Navigate repeatedly, paginate long feeds, generate many local state changes. | Bounded request behavior, usable memory/scrolling, no repeated submissions or accumulating listeners. |

## O. Operator security and concurrency — P0, isolated authorization required

| ID | Steps | Expected result / evidence |
| --- | --- | --- |
| O01 | Read-only before/after vote/claim/upvote checks in test DB. | Compare raw votes, canonical history and daily quota rows; no duplicates/private attribution. Query examples below. |
| O02 | Replay CAPTCHA or change target, answer, request ID, session, purpose or consent after obtaining proof. | Server rejects substituted binding/reuse/expiry; no protected write. |
| O03 | Call retired/public write RPCs, direct tables or private history as guest/other/stale account. | Database grants/RLS/session guard prevent unauthorized operations independently of UI. |
| O04 | Race same-device upvotes, same-question daily votes, signup imports, lease replacements and midnight writes. | Existing integration/concurrency suites enforce one acceptance/owner/current lease per defined scope. Run destructive fixtures only in disposable validation DB. |
| O05 | Review logs and public response payloads. | No OTPs/tokens/peppers/secrets/email/history/choice leak; request IDs and safe operational errors sufficient for diagnosis. |
| O06 | Review email-begin throttling separately from post-OTP CAPTCHA. | Limits protect sending as configured; post-OTP CAPTCHA is not falsely credited with preventing pre-email spam. Do not enable Supabase pre-email CAPTCHA without the needed client/gateway integration. |

Read-only operator checks, replacing the UUID with your fixture question (do not publish returned private rows):

```sql
select count(*) as raw_votes
from public.votes
where question_id = 'YOUR_QUESTION_UUID'::uuid;

select question_id, account_id, count(*)
from public.votes
where question_id = 'YOUR_QUESTION_UUID'::uuid and account_id is not null
group by question_id, account_id
having count(*) > 1;

select account_id, question_id, count(*)
from private.account_vote_history
where question_id = 'YOUR_QUESTION_UUID'::uuid
group by account_id, question_id
having count(*) > 1;
```

The last two should return no rows. Also inspect device-level duplicates via existing operator suites; raw account checks alone do not prove device protection. Import may add a canonical history association while the original raw guest vote stays unowned; do not mistake that for failed import or a missing new raw row.

## Existing automation and limits

From repository root: `npm run typecheck`, `npm run lint`, `npm run test:security`, `npm run verify:dependencies`, `npm run verify:typecheck-scope`. SQL suites live in `supabase/tests/database/`; concurrency harness in `tests/stress/account-journeys.py`; sample Maestro journey in `e2e/guest-journey.yaml`. Read their setup before running; a script existing is not proof of hosted/manual acceptance. Do not run a remote reset to prepare these tests.

Not implemented and therefore **not passable acceptance claims**: Play Integrity/App Attest enforcement, proof of a unique human, permanent hardware identity, Announcements delivery/Admin role-management UI, full account-deletion UX, arbitrary new session-expiry policy, automatic deferred app-link restoration. Track these separately; test current Moderator/Admin authorization using operator-assigned roles. A forgeable recognized-device signal remains a limitation even when all current duplicate checks pass.

Release exit: all P0 cases pass on supported platforms; P1 failures are fixed or explicitly accepted with an owner/reason; missing iOS/platform setup is visibly BLOCKED; hosted midnight observed; no unexplained DB/UI mismatch; final new/existing login → vote/ask/upvote → logout/reset smoke passes. This plan does not guarantee all conceivable scenarios; add a regression case for every new defect.
