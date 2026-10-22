# Midnight UTC and daily community actions rollout

The current rules and rollout are in [Brewing community rules](brewing-community-rules.md).

- Daily YES/NO voting is [00:00 UTC, next 00:00 UTC). No noon job.
- Old results and the community-selected new question are finalized/opened atomically at midnight;
  reads catch up a missed run. An already-open app refreshes through the root observer, with normal
  network latency and foreground/reconnect recovery.
- There is no published preview or administrator-scheduled priority. All open community questions
  remain eligible across days, ordered by accumulated votes, later timestamp, then UUID.
- Signed-in verified accounts get one submission and one upvote per UTC day; guests browse. Own
  upvotes are disabled in the app and rejected on the server. Clearing storage never resets quotas.
- Moderators can hide an inappropriate open candidate with a mandatory reason and private audit.
  They cannot select/schedule the next question or remove live/finalized polls through this action.

Apply the latest reviewed forward migration, `202610210001_community_only_brewing.sql`, after its
predecessors. Preserve data; do not reset hosted tables. Owner role bootstrap, monitoring grants,
preview build, seed instructions, filtering/pagination and test scenarios are documented in the
linked rule/rollout file. Platform attestation, single-session enforcement, announcements and admin
role-management UI remain separate milestones.
