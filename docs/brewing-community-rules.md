# Brewing: community-only selection and audited moderation

This supersedes the previous administrator schedule/preview policy. There is no administrator nomination, reserved date or published preview in the new app.

- Guests browse all open questions. Verified signed-in accounts (including admins/superusers) may submit one question and upvote one other person's question per UTC day. Clearing app storage/logout does not reset server quotas. Removal does not refund a submission or an upvote. Self-upvotes are rejected by both UI and server.
- All open submissions remain in Brewing across days. Daily upvotes accumulate until the question is selected or removed. At 00:00 UTC, the highest accumulated total from before that boundary wins; ties favor the later created_at, then UUID. A zero-vote tie also favors the newer eligible question. Questions submitted after the boundary join the next selection.
- At the boundary the old daily question's result is finalized and the community winner becomes live for the new UTC date. The selected card leaves Brewing. No candidate means no live question; do not invent a question or copy a scheduled draft. A missed job is repaired before Today/Past Results/new Brewing reads return. Already opened daily questions/results are preserved by this migration.
- Previous scheduled/disabled draft rows cannot reserve a date or block a community winner. The old preview RPC returns no rows for installed older apps. One live/finalized question per date remains enforced by a partial unique index; legacy drafts are preserved privately rather than deleting their data.
- “YES/NO voting” answers the live daily question. “Upvote” supports a candidate in Brewing. The old “voting remains closed” wording referred to future YES/NO voting, not Brewing upvotes; that preview feature is removed.

## List UX and pagination

One column of variable-height cards is used instead of a grid: translated 280-character questions and large text remain readable without squeezing controls. Each card has question, absolute UTC submission timestamp, upvote count/button, own/upvoted markers and a privileged delete action.

Top controls: Most upvoted (default; same tiebreak as selection), Newest, Oldest. Filters: All questions, Submitted today (UTC), My questions and Other people's questions (last two signed-in only). Filtering/sorting happens across the full server dataset, never just the currently downloaded page. Pull-to-refresh and the refresh icon update the list; Load more uses bounded pages and FlatList virtualizes the rendered cards. The compose form expands on demand to avoid filling the screen before the list.

A new list pins a server timestamp after a commit fence using the same advisory lock as community writes. Counts/creation cutoff for subsequent pages use that timestamp and explicit cursor sort/filter/account scope. New votes/submissions appear on refresh; moderation/selection hides a card immediately on the next read. The cursor contains the original ranking anchor, so removing that anchor doesn't break paging. After ten minutes, midnight, or a changed scope/sort/filter, refresh starts a new ranking. Client deduplication prevents duplicate cards on refetch. Cursor fields are read-only paging inputs, not authorization or client-supplied quota dates. Direct database writes/account deletion outside the app are not a supported way to mutate an active pagination snapshot; refresh after such operations.

## Admin/superuser moderation

`private.community_roles` stores only server-assigned admin/superuser membership. Auth user metadata and client flags cannot grant it. Normal users receive `member`. A stale role badge never authorizes removal: `remove_brewing_question` checks verified auth identity and current role again and locks the role record for the transaction.

Delete opens a modal containing the target question, a required 5–1000 character reason, Confirm delete and Cancel. Cancel makes no request. Confirm closes only after server success; failed requests retain reason/request ID for retry. The expected actor ID prevents an in-flight old-account request running under a newly signed-in account.

Removal changes the submission to hidden, with an append-only private audit recording question ID/text/time, moderator UUID/role, submitter UUID, reason, request ID and removal timestamp. UUIDs identify users through trusted auth records; emails/nicknames are not exposed or unnecessarily duplicated in a public log. The audit snapshot survives later content/account deletion. No user-facing audit UI is included.

The moderator transaction takes a shared daily-cycle lock and the target row lock. Finalization takes the exclusive daily-cycle lock. A committed removal cannot win selection, while an already selected/live question cannot be removed through this Brewing action. These roles have no schedule/pick-winner RPC or direct question-writing grants. Removing inappropriate candidates necessarily affects the eligible pool; it is an audited moderation power, not a way to nominate a winner.

## Rollout and role bootstrap (owner only)

1. Merge/pull the review branch. In the checkout linked to hosted development, inspect `npx supabase db push --dry-run`, then apply `npx supabase db push`. The new forward migration is `202610210001_community_only_brewing.sql`. Do not edit or replay applied migrations and do not reset hosted data. It can immediately fill today's empty live slot from eligible community questions, ignoring old scheduled drafts.
2. In Supabase Authentication identify a real, verified development account's UUID. Through the trusted SQL Editor only, assign the intended role:
   ```sql
   insert into private.community_roles(user_id,role)
   select id,'superuser' from auth.users
   where id='<VERIFIED_AUTH_USER_UUID>'::uuid and email_confirmed_at is not null
   on conflict(user_id) do update set role=excluded.role;
   ```
   Use `admin` for moderators. The statement changes nothing if that verified UUID is absent. Do not add a shared password/service key to the app. Assigning/revoking roles through an in-app superuser UI remains a separate milestone; trusted owners may use this table now.
3. If `OPS_DATABASE_URL` uses a separate least-privilege monitor login, grant it EXECUTE on `private.get_open_community_count()` (and existing private-schema USAGE) through SQL before deploying the updated monitor. The monitor now warns when the community candidate queue is empty, not when tomorrow lacks an administrator schedule. Do not grant public access to roles/audits.
4. Rebuild Android preview and reload/install it. For iOS repeat when physical-device signing is available. Test guest browsing; member limits/self-upvotes; each filter/sort across multiple pages; UTC timestamps; moderator confirm/cancel/invalid reason; revoked-role denial; removal retry; and midnight selection on an already-open non-Home screen.
5. Optional development fixtures use `supabase/seed/development-cycle.sql`. Set `pulse.seed_author` to an existing verified development UUID in the same SQL Editor run first; the file explains the command. It adds historical samples and community submissions without fake upvotes or future scheduled daily questions. Never run the pgTAP test fixtures on hosted data.

## Midnight refresh wording

“Today hasn't been opened” meant the user may start at a deep link to Past Results or remain on Brewing/Settings without visiting Home. The refresh observer is mounted at the app root, not inside the Today screen. It reads server timing, invalidates Today/results/community at the boundary and repairs a delayed question change. An online active app updates after request latency; suspended/offline apps catch up on foreground/reconnection. It does not require opening Home first or promise code execution while the OS suspends the app.
