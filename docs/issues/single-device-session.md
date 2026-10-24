# [Technical] One active session and explicit login/logout/expiry journeys

Current approved implementation and deployment: [product journeys rollout](../product-journeys-rollout.md). The owner chose a checked signup-import checkbox, no blanket waiting period, and one upvote per account/device/UTC day. Earlier comparison proposals below are superseded for that scope.


Claim the active server generation only after successful OTP verification, never on a code request. Revoke/check replaced sessions at every private action; realtime foreground sign-out is best-effort and offline UI clears at next validation. A stale logout must not revoke a newer lease. Proposed duration: 30 days authenticated inactivity and 90-day absolute re-verification, subject to owner approval/provider support. Restore settings/history without a new device-history import.

Recommend no blanket login-day/logout voting ban. If retained experimentally, specify server UTC eligibility separately from already-used quotas, cover refresh/recovery/replacement, and use exact unlock-date copy while allowing browse/share/ask. Existing votes survive logout. Test simultaneous successful verification, invalid OTP denial-of-service, stale JWT/refresh replay, delayed events, 14/30/90-day return and old-account cache isolation. See points 6–12.

Review source: docs/requirements/product-review-2026-10-24.md. Guest daily YES/NO voting is confirmed; verified sign-in is required for Brewing submissions/upvotes. These are review requirements, not authorization to implement code. See docs/reviews/2026-10-24/journeys-and-manual-tests.md for acceptance paths.
