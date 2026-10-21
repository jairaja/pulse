# Midnight UTC and daily community actions rollout

## Meaning of the rules

- Each daily question accepts votes in [00:00 UTC on its date, 00:00 UTC on the next date).
- Finalization freezes accepted totals and publishes the old question's result; activation opens the
  already-scheduled question for the new UTC date. They happen in one locked transaction.
- The only daily cron trigger is midnight (`0 0 * * *`), with UTC/GMT cron timezone. Nothing runs at noon.
- If the job was delayed while the database was down, the first Today/Past Results RPC catches up
  before returning data. This repairs past due work; it never moves a future deadline forward.
- A published preview is a deliberate admin announcement of tomorrow's question. It does not open
  voting early. Other scheduled drafts remain private. All open community submissions remain eligible
  across days; when the new day has no existing question, accumulated pre-midnight upvotes select
  the winner. Equal totals prefer the later submission, then UUID. Hidden/selected rows are excluded.

Countdowns use server timing, show the absolute UTC date and name 00:00 UTC. A network request still
has latency; an offline phone displays cached data and cannot promise an immediate live result.
The server, not the phone countdown, decides voting eligibility. Vote insert/finalization locks protect
accepted-before-deadline inserts from being omitted from the immutable snapshot.

## Apply in hosted development

1. Merge/pull the feature branch. Confirm the checkout targets the intended development project.
2. Run `npx supabase db push --dry-run`. Inspect all pending migrations before `npx supabase db push`.
   The latest migrations are 202610200004_account_preferences.sql and
   202610200005_community_selection.sql, following 202610200003_midnight_cycle_and_community.sql. Do not reset existing data.
3. In Supabase SQL Editor check `cron.job`: pulse-daily-finalization should be active with schedule
   `0 0 * * *`. Confirm `show cron.timezone;` returns a UTC/GMT timezone. Review job_run_details after
   the next boundary; do not create a separate noon job.
4. Ensure the existing email OTP sign-in works and users have confirmed email addresses. Community
   submit/upvote RPCs check auth.uid() and email_confirmed_at on the server. Reading and daily voting
   retain their existing account-optional behavior.
5. Rebuild Android preview (`npx eas-cli@latest build --platform android --profile preview`) and
   install it. For iOS use the signed physical-device build when the Apple setup is ready; simulator
   tests can cover community reads/forms but do not prove physical-device daily voting integrity.
   Expo Go/development-client users can reload the updated Metro JavaScript instead of rebuilding.
6. No new Edge Function or secret is required for these features. The existing vote function and
   device-fingerprint pepper must remain configured. Attestation is a separate future integration.

## Test with two verified accounts

- Browse signed out, then sign in: submission/upvote controls unlock only after allowance fetch succeeds.
- Submit 5–280 characters. Repeat the same request: it returns the same submission. A different second
  question on that UTC day is rejected, even after clearing storage/signing in again.
- Account B can upvote Account A's question once. Another different question that day is rejected;
  repeating the identical request is idempotent. Neither account can upvote its own question.
- Both allowances reset at 00:00 UTC. Changing device timezone or client-supplied dates cannot reset
  them; write RPCs do not accept author/voter/date parameters and direct table writes are revoked.
- Verify a scheduled tomorrow question and today's result at midnight, countdown singular/plural and
  absolute date, background/resume, offline rendering, and missed-job read catch-up. Make sure a next
  question is scheduled or an eligible open community submission exists; an empty queue stays empty.
- Sign out/switch accounts: feed ownership flags and allowance caches must not leak across accounts.

## Tracked follow-up

T10 has the approved daily community rule and owner rollout in docs/issues/community-daily-actions.md.
T17 separates agent implementation and Android/iOS owner prerequisites in docs/issues/platform-attestation.md.
The API may block automatic issue updates; these files are ready for copying into existing issues.
Moderation states exist (open/hidden/selected), but full reporting/admin tooling,
notification delivery, and server platform attestation are not represented as completed here.
