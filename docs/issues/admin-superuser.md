# Server-enforced admin and superuser roles

Implemented foundation: server-owned private admin/superuser roles, own-role RPC, open-candidate removal modal/RPC, required reason and append-only private audit. Role-management UI, announcement publishing, restoration, last-superuser recovery and single-session enforcement remain specifications only. See `docs/brewing-community-rules.md` for trusted SQL role bootstrap and tests.

Roles (neither privileged role may nominate, schedule or override the next daily winner):

- Regular signed-in user: existing verified-account submission/upvote privileges only.
- Admin: regular-user functions plus removal of inappropriate community questions from public view.
- Superuser: admin functions plus assigning/removing admins and drafting/publishing/withdrawing announcements for everyone. Announcements are translated server-side using AI into the supported languages and stored before publication; users fetch them on open/foreground or refresh. No real-time delivery requirement.

Server/security requirements:

- Keep roles in a protected server-owned table. Every privileged operation verifies current authenticated identity, active session and current role in the database/service. Never trust client flags or editable user metadata; hiding a button is not authorization.
- Bootstrap the first superuser through a documented trusted SQL/admin operation using the verified auth UUID. Never ship a shared superuser password or a service key in the app. Recommend step-up/MFA for privileged users, with recovery defined before enforcement.
- Superuser may manage admins; promotion to superuser requires a separately controlled bootstrap/recovery operation. Prevent removal/deletion of the last superuser, concurrent role-change races and self-escalation. Role removals take effect at the next server operation, irrespective of stale UI/JWT metadata.
- “Remove question” means audited hide/moderation, with actor, reason, timestamp and question snapshot. A restoration/review UI and moderation rate limits remain follow-up work. Hidden submissions cannot receive votes or win selection. Preserve accepted votes and published immutable results; moderation of an already-live/historical question needs an explicit disclosure/redaction policy, not silent vote deletion.
- Announcement lifecycle: draft → translate → review → scheduled/live → expired/withdrawn, locale completeness/version checks, deterministic published revisions, safe plain text or sanitized markup, no arbitrary script/URL execution, audit log, retry-safe jobs and provider-cost limits. Role revocation cannot leave an unauthorized queued publication able to bypass current policy.

Acceptance: direct anonymous/regular/admin requests cannot assign roles or publish announcements; concurrent last-superuser protections hold; revoked admins fail even with cached UI. Test hide-vs-upvote/selection races, restoration, invalid translations, failed publication, scheduled expiry, account deletion and audit access on Android/iOS. Link the language, announcement-center and single-device-session issues.
