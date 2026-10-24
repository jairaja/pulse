# Account implementation boundary

> Implementation update (24 October 2026): [approved journeys and rollout](product-journeys-rollout.md) supersedes older implementation boundaries below. Guest daily voting remains supported; Brewing writes require sign-in and a protected gateway. Runtime roles are now Moderator (`moderator`) and Admin (`admin`). Product messages use Announcements; platform push APIs retain their technical names.


The current account surface proves email-code authentication and session lifecycle only.

## Implemented

- one non-enumerating email flow for sign-in and account creation;
- six-digit email-code verification and resend cooldown;
- persisted Supabase session with foreground token refresh;
- optional nickname stored only on the current device;
- explicit, per-share nickname preview with no internal identifier;
- logout confirmation and local nickname cleanup;
- contextual entry points, with Settings as the canonical account-management location.

## Deliberately not implemented

- account-history or question-history merge;
- cross-device restoration;
- cross-device restoration of account-linked vote receipts;
- question submission ownership or selected-question Announcements;
- public nickname attribution on real share images;
- account deletion/export;
- single-device enforcement or anonymous-device transfer.

Those features require server contracts, RLS policies, idempotency, moderation, privacy review, and
tests. Client UI cannot safely manufacture them. In particular, an authenticated session is not a
proof of one human, and a device identifier is neither durable nor a safe public attribution.
