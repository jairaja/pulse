# [Feature] Moderator removal and Admin role/Announcements management

Rename product roles in a two-way compatible mapping: old Admin → Moderator; old Superuser → Admin. Existing stored values admin/superuser remain unchanged until an approved forward migration/client/API plan. Never collapse privilege levels, alter PostgreSQL superuser terminology or rewrite immutable audit-role evidence. Moderators remove inappropriate open candidates with a reason; Admins additionally manage Moderators and publish Announcements. Neither may nominate/schedule the daily winner.

Keep server-owned authorization, last-Admin/recovery protection, revocation checks, private append-only actor/reason/target audits and safe read roles. No code renaming or role-management implementation is authorized by this review. See points 19–20 and the role journey matrix.

Review source: docs/requirements/product-review-2026-10-24.md. Guest daily YES/NO voting is confirmed; verified sign-in is required for Brewing submissions/upvotes. These are review requirements, not authorization to implement code. See docs/reviews/2026-10-24/journeys-and-manual-tests.md for acceptance paths.
