# Account implementation boundary

> Product review update (24 October 2026): use **Moderator** (formerly product Admin), **Admin** (formerly Superuser), and **Announcements** in user-facing requirements. The owner confirmed guest daily YES/NO voting; Brewing writes require sign-in. See [the current review](requirements/product-review-2026-10-24.md). Runtime roles/APIs and existing SQL examples below remain current implementation details until an approved migration; this documentation change does not implement the proposal.


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
