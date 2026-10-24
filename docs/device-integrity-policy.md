# Device integrity and voting policy

> Product review update (24 October 2026): use **Moderator** (formerly product Admin), **Admin** (formerly Superuser), and **Announcements** in user-facing requirements. The owner confirmed guest daily YES/NO voting; Brewing writes require sign-in. See [the current review](requirements/product-review-2026-10-24.md). Runtime roles/APIs and existing SQL examples below remain current implementation details until an approved migration; this documentation change does not implement the proposal.


**Status:** approved product rule; enforcement integration remains a launch gate.

## Product claim

PULSE targets **one accepted vote per eligible physical device per question**. It does not claim one
human per vote: a person may own multiple eligible devices, and a shared device still has only one
vote. Published methodology must use this exact distinction.

## What can be enforced

The vote gateway must require a fresh, request-bound platform integrity verdict immediately before a
vote is accepted:

- **Android:** Play Integrity Standard requests. The server must verify the request hash, package,
  signing certificate, `PLAY_RECOGNIZED`, `LICENSED`, and `MEETS_DEVICE_INTEGRITY`. Google Play Games
  for PC and other non-approved form factors must be rejected if the launch policy is phone/tablet only.
- **iOS:** App Attest registration followed by a server challenge and assertion bound to the complete
  vote payload. The server must validate the certificate chain, app identity, challenge, signature,
  and monotonically increasing assertion counter.

Integrity is verified only on the server. A client-side emulator/root check is advisory and cannot
authorize a vote. Expo Go, simulators, emulators, sideloaded/unrecognized Android builds, unsupported
devices, and missing or unverifiable verdicts must fail closed for voting while read-only use remains
available.

## Reinstall boundary

The existing SecureStore credential is an installation credential. It is not a durable device ID.
App Attest keys explicitly do not survive reinstall. Android Play Integrity proves the current app and
device environment but its generally available verdict does not expose a stable device identifier.

Platform-supported reinstall signals can improve the rule:

- Apple DeviceCheck provides two server-managed bits associated with a device.
- Play Integrity device recall can retain limited device state across reinstall/reset, but is beta and
  must not be a hard production dependency until the project is admitted and the API is stable.

Neither service provides a general-purpose permanent device identifier or enough durable state to
record an unlimited per-question voting history. Consequently, **strict cross-platform reinstall
prevention cannot be guaranteed by public stable APIs today** without requiring a durable account or
collecting an invasive fingerprint. PULSE must not pretend otherwise. The implemented intermediate
control uses Android ID or iOS IDFV only: the gateway immediately HMACs the value with a server-only
pepper, PostgreSQL stores only that HMAC, and a unique index maps a returning signal to the existing
installation row. Hardware model/build values are risk telemetry, never unique keys, because shared
models collide and OS updates change them.

Ordinary app-data clearing now triggers server-side receipt recovery before vote controls are enabled.
A fresh duplicate submission returns `ALREADY_VOTED` with the original receipt; only an exact
idempotent retry returns `ACCEPTED`. See [storage-reset behavior and rollout](vote-storage-reset.md).
This keeps device-signal lookup and database uniqueness authoritative when local storage is empty;
it does not turn client-supplied Android ID/IDFV into attestation.

The launch decision is therefore explicit:

1. Require platform integrity for every vote.
2. Use DeviceCheck/device recall where available as an additional repeat-abuse signal.
3. Keep server-confirmed account and installation uniqueness.
4. Rate-limit and risk-score at the gateway without retaining raw network identifiers unnecessarily.
5. Measure false accepts and false rejects in a staged observe-only rollout before enforcing.
6. If strict reinstall prevention remains non-negotiable, require a durable verified account for
   voting; otherwise publish the narrower, honest guarantee: one vote per attested installation and
   question, with best-effort reinstall resistance.

## CAPTCHA

CAPTCHA is useful as a **step-up bot signal**, not proof of a physical device and not a durable identity.
A human can solve CAPTCHA repeatedly, solvers can outsource it, and automation can relay challenges.

- Protect Supabase email OTP with its supported Cloudflare Turnstile or hCaptcha integration.
- The native WebView obtains a Turnstile token for every vote submission. The gateway requires
  Siteverify success with the exact hostname, action and vote binding; missing configuration rejects
  submission. Read-only receipt recovery cannot create a vote and does not require another CAPTCHA.
- Never ship the CAPTCHA secret in the app. Cloudflare enforces token expiry and redemption; the
  gateway checks hostname/action/binding and PostgreSQL enforces vote uniqueness and submission limits.
- Do not make a WebView CAPTCHA the primary integrity control. Platform attestation remains mandatory.

## Rollout and acceptance gates

- Use development/test verdicts only outside production.
- Run observe-only telemetry before fail-closed enforcement and document accessibility/recovery paths.
- Test replay, payload substitution, stale challenges, rooted/jailbroken devices, emulator farms,
  attestation outages, quota exhaustion, clock skew, reinstall, backup restore, and device transfer.
- Store only the minimum derived verdict and audit metadata; never log attestation tokens, installation
  credentials, authentication tokens, CAPTCHA tokens, or raw IP addresses.
- Complete privacy, platform-policy, load, penetration, incident-response, and independent security
  review before global launch.
