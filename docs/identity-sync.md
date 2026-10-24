# First-signup history import and canonical account restoration

Review specification, not implemented policy. The authoritative detail is [the October 24 product review](requirements/product-review-2026-10-24.md), points 4–5 and 26. The owner confirmed guest daily voting remains available.

- A new verified account may import server-accepted unowned device history once, with explicit consent (opt-in recommended). Bind the entitlement to the originating signup/device and a frozen cutoff; seal decline and make same-operation retries safe.
- Existing-account logins restore canonical account history/preferences. They must not import a different device's answers, overwrite authoritative votes, expose a previous account's choices, or create a fresh import entitlement.
- Device security associations are many-to-many and separate from vote ownership. Guest votes after logout must not inherit the last signed-in account. Quotas remain authoritative even when history import is declined.
- Current code automatically attempts history claiming on session availability and binds an installation to an account. That behavior must be replaced/guarded server-side before promising the new consent/once-only journey. No app/RPC change is made by this review.

Use [the manual journey matrix](reviews/2026-10-24/journeys-and-manual-tests.md) and [T08/T16 drafts](reviews/2026-10-24/issue-plan.json) for acceptance and implementation sequencing.
