# T10 — One daily Brewing submission and one daily upvote per verified account

This updates the previous weekly-submission proposal: the approved limit is now **one submission per UTC day** and **one upvote total per UTC day**, on another user's question.

## Requirement and implementation

- Everyone can browse; a signed-in, email-verified account is required to submit/upvote.
- Limits reset at 00:00 UTC, independent of device timezone, cache, reinstall or local clock.
- Enforce unique account/day records in PostgreSQL under concurrent requests. Reject self-upvotes server-side; exact retries do not consume a second action.
- Only dedicated RPCs may write. Do not accept author/voter IDs or quota dates from clients. Do not expose author IDs/emails in the public feed.
- Provide input validation, paginated question list, counts, own/upvoted indicators, server allowance loading/error states, and explicit midnight reset copy.
- All open submissions remain browsable and eligible across days. At 00:00 UTC, accumulated pre-boundary upvotes select the live question without administrator schedule overrides. Equal totals prefer the later submission, then UUID. Hidden/selected questions are excluded. Moderation now hides open candidates with a required reason and immutable private audit; notification delivery remains separate work.

## Owner rollout

1. Merge/pull the implementation PR and inspect pending migrations with `npx supabase db push --dry-run` in the checkout linked to hosted DEVELOPMENT.
2. Apply migrations with `npx supabase db push`. Do not reset existing votes/results.
3. Ensure Supabase email OTP authentication is enabled with the project's email provider and correct app deep-link/redirect settings. Verify real account sign-in on both platforms; no phone/name is required by this feature.
4. Rebuild/install Android preview and, when available, the signed iOS build. For Expo Go/development clients, restart Metro/reload JavaScript.
5. Test with two verified accounts: first submission succeeds, second distinct submission is rejected, one upvote succeeds, another different upvote is rejected, self-upvote is rejected. Restart/clear app data and sign back in: allowances must remain used.
6. Test 00:00 UTC reset, different device timezones, retries/concurrency, offline attempts, unverified accounts and anonymous browsing. Offline writes must not be queued.
7. Review open submissions and the automatic selection result. Only the community ranking decides the winner; old scheduled dates cannot reserve or override it. Test ties and multi-day upvote totals. Test audited moderator confirmation/cancel and rejected stale/revoked access.

## Done criteria

Automated database/client tests and physical-device evidence cover limits, self-vote rejection, unverified/guest rejection, idempotence, concurrency, privacy, and UTC reset. Role-management UI and announcements remain separate milestones. See docs/brewing-community-rules.md for the current implementation and role bootstrap.
