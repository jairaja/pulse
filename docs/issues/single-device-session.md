# One active signed-in device: complete login/logout journey

Specification only; do not implement or enable enforcement in the language/preferences change. Extend the existing authentication/session-lifecycle issue (T13) instead of duplicating it.

Requirement: a successful sign-in on device B replaces account access on device A. Public browsing remains available after A is signed out. Daily/community limits, existing votes and saved preferences remain attached to the account.

Implementation plan:

1. Represent the active authenticated session with a server-owned account session generation/lease, bound to the verified Supabase session ID and device session. Atomically claim it only after successful email-code verification, including simultaneous logins. Failed/abandoned login attempts must not eject the existing device. Never accept a client-supplied user ID as authorization.
2. Revoke replaced refresh sessions using supported Supabase administration APIs. JWT expiry/refresh-token revocation alone does not invalidate an already issued access token immediately: check the active generation at every authenticated data/action boundary (RPC/Edge/admin). Keep credentials server-side. Evaluate Supabase plan/session controls rather than assuming an unavailable feature is enabled.
3. A private per-account Realtime invalidation channel/sign-out event makes an online foreground device react promptly. Validate on startup, foreground, reconnect and before private writes; use bounded polling as a recovery path. Server enforcement takes effect with the session replacement transaction. An offline/suspended device cannot receive an immediate UI logout: discard its session and private UI at its first reachable validation. State this limitation clearly.
4. Clear old auth tokens, private queries, nickname/account caches and subscriptions on logout/replacement. Preserve chosen local appearance, public content and already accepted vote protections. A late response from old account A must not reappear in account B's UI.
5. Show “You signed in on another device. Sign in again to use your account here.” Give a clear guest continuation. Explicit logout applies only to the current session; a stale device cannot revoke a newer session. Lost-device recovery/account deletion must revoke the authoritative active lease too.

User journey and acceptance tests on Android and iOS:

- New/existing users: same email → code flow, no account enumeration, invalid/expired/delayed/resend/rate-limit errors, retry after lost network. Only verified successful login claims the lease.
- A signed in → B signs in → A's private operations fail immediately, online A becomes guest promptly, B restores theme/language. Public browsing remains usable.
- A offline or background → B signs in → A resumes/reconnects and clears private data before any private request succeeds; no promise of push delivery to a disconnected app.
- Simultaneous A/B login, stolen/replayed refresh token, stale JWT, reconnect after long sleep, device clock tampering, notification loss, repeated account switching, logout during in-flight request, app reinstall/storage clear and server outage.
- One successful generation wins races; old session cannot mutate profile/preferences/read status/community votes/moderation or remove the new session. Existing database vote uniqueness still applies.

Owner setup: confirm Supabase plan/auth settings and production email provider, supply Android and signed iOS devices for cross-device testing, agree offline/recovery copy. No Apple signing change is needed to design the server policy; physical iOS acceptance follows signing readiness.
