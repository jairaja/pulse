# Product journeys validation — 24 October 2026

Branch: `feat/approved-product-journeys`. No hosted migrations, Edge deployments, signing changes, store listings or Figma edits were made. GitHub Git transport works; its API returns `Forbidden`, so remote issue updates/PR creation are not claimed. The local issue manifest contains updated implementation notes.

## Passed

- TypeScript checks cover the complete Expo Router surface, including Ask, Pending questions and dynamic question-link routes. ESLint passes with zero findings; no rules were disabled.
- **37 Node tests** pass: existing security/gateway/UTC/monitor tests plus real account/community handler tests with provider mocks, purpose/session/consent binding, OTP-before-activation binding, provider outage/replay checks, preferences across devices, public landing/domain associations, in-flight reset writes, and late vote-response cache isolation. All ten static catalogs have matching keys/interpolation parameters. Native-speaker review is separate from these checks.
- **259 SQL assertions in 12 suites** pass against a fresh full migration chain in disposable PostgreSQL 17 with pg_cron/pgTAP. The local fixture supplies minimal Supabase `auth` functions/users; it does not run the real GoTrue/Realtime/PostgREST services. Suites cover baseline permissions, midnight transitions, selection/filter pagination, moderation/audit vocabulary, first-account import/decline/resend, active sessions/old JWT denial, device/account duplicates, preference patches, pending publication, exact duplicates, batch public lookup and durable upvote limits after content/voter deletion.
- Real concurrent connections: 32 accounts / one device / two upvote targets produce exactly one upvote and 31 quota failures; 24 guest submissions with distinct request IDs produce one immutable vote and 23 duplicate responses; two competing signup imports give one canonical owner; four simultaneous logins leave one authorized lease. No deadlocks occurred in these runs. These small correctness races are not hosted capacity measurements.
- Deno checks pass for `vote`, `account`, `community-action`, and `moderate-submissions`, including their actual npm imports. Provider traffic is mocked in Node tests; no live OTP/CAPTCHA/AI calls were made for validation.
- `expo install --check` passes with SDK 57. Expo/Router were aligned to current SDK 57 patches; `expo-font` stays aligned. **Expo Doctor: 21/21 checks pass.** Doctor's initial direct-fetch errors were resolved using Node's normal inherited environment proxy (`--use-env-proxy`), preserving TLS verification and the network policy. No checks were disabled.
- Android and iOS production JavaScript/Hermes exports pass. These are bundling checks, not signed APK/IPA builds, physical device UI tests or App Store acceptance.
- Migration allowlist, full TypeScript scope, client credential/configuration guard and Git whitespace checks pass. Development seeds run successfully, including repeating the root seed; partial unique-index conflict handling and publication timestamps were updated for the current schema.

## Reproduce

```sh
npm ci
npm run typecheck
npm run lint
npm run test:security
npm run verify:typecheck-scope
npm run verify:database
npm run verify:client-config
npm run verify:dependencies
npx expo-doctor
npx supabase test db
```

`supabase test db` requires the local Supabase stack with migrations applied. Test-only temporary session/gateway helpers are in `supabase/tests/helpers`; they are not production functions and do not bypass production CAPTCHA. Production quota suites use fixture publication explicitly; new pending/review behavior has its own suite.

`tests/stress/account-journeys.py` runs actual concurrent psql processes against a **disposable** local Docker container named `pulse-*-validation` (default `pulse-vote-reset-validation`), with all migrations applied. It inserts committed test fixtures and never targets a hosted URL; discard that validation database afterwards. The managed environment's PostgreSQL validation container was stopped after use.

`maestro test e2e/guest-journey.yaml` is the native guest navigation/view-persistence smoke flow to run on a test install. It has not been executed in this environment because no native device/emulator is attached. Do not automate solving production CAPTCHA. Physical UI/accessibility, OS browser/messenger links, genuine OTP delivery, Realtime reconnects and live provider behavior still require the manual checks in [the rollout guide](product-journeys-rollout.md).

## Material boundaries

- Device evidence remains best effort and forgeable by a modified client until platform attestation is deployed. The handler suite explicitly tests this limitation. CAPTCHA and one active account session do not establish unique-human identity.
- Login policy adds no blanket UTC-day wait and no hardcoded 30/90-day expiration. Session lifetime remains Supabase Auth project policy; the Pulse lease enforces replacement independently.
- Online UI logout delivery depends on Realtime/polling; an offline device cannot receive an immediate event. Server authorization changes atomically. The real hosted pre-request guard/publication configuration must be verified during rollout.
- AI triage defaults to private pending if unconfigured/uncertain/unavailable. Moderators can review. Actual multilingual moderation quality and lexical-search relevance need representative content review; no semantic-search quality claim is made.
- Domain associations, real store URLs, preview/Play signing fingerprints, Apple team/signing and optional AI secrets remain owner configuration. Missing values fail explicitly. Expo Go is not a verified-link acceptance environment. Protected account/action gateways currently expect eligible physical phone/tablet evidence; simulator validation here covers exports and guest/UI flows.
- No engagement telemetry was enabled. Proposed measurements, privacy choices, session settings and CAPTCHA refinements are explained in [the follow-up analysis](session-captcha-engagement.md).
