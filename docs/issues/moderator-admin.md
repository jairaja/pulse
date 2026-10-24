# [Feature] Moderator removal and Admin role/Announcements management

Current approved implementation and deployment: [product journeys rollout](../product-journeys-rollout.md). The owner chose a checked signup-import checkbox, no blanket waiting period, and one upvote per account/device/UTC day. Earlier comparison proposals below are superseded for that scope.


Rename product roles in a two-way compatible mapping: old Admin → Moderator; old Superuser → Admin. The forward migration now maps stored admin → moderator and superuser → admin atomically. Historical audit snapshots retain their original meaning. Never collapse privilege levels, alter PostgreSQL superuser terminology or rewrite immutable audit-role evidence. Moderators remove inappropriate open candidates with a reason; Admins additionally manage Moderators and publish Announcements. Neither may nominate/schedule the daily winner.

Keep server-owned authorization, last-Admin/recovery protection, revocation checks, private append-only actor/reason/target audits and safe read roles. No code renaming or role-management implementation is authorized by this review. See points 19–20 and the role journey matrix.

Review source: docs/requirements/product-review-2026-10-24.md. Guest daily YES/NO voting is confirmed; verified sign-in is required for Brewing submissions/upvotes. These are review requirements, not authorization to implement code. See docs/reviews/2026-10-24/journeys-and-manual-tests.md for acceptance paths.
