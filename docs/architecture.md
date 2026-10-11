# PULSE delivery plan

## Delivery rule

Each step must start, be manually tested, and be understood before the next step changes the dependency graph or adds a remote service.

## Phase 1 — local UX (current)

- Expo SDK 54 app shell
- Direct question → vote → local receipt interaction; the backend will reveal results the next day
- No database, push, identity, map, chart, or API dependency at runtime

**Exit criteria:** Expo Go opens the app without red-screen errors; all drawer destinations open; the local vote completes; no network request is made.

## Step 2 — navigation and local UX

- Expo Router provides a four-destination drawer: Today, Past Results, Brewing Questions, and About.
- Prediction and live trends are not part of the Phase 1 runtime.
- Add SDK-aligned navigation dependencies using `npx expo install`.
- Keep vote state ephemeral until the secure backend write path is designed; a reload resets this prototype.

## Step 3 — Supabase read-only connectivity

- Configure the project URL and publishable key.
- Enable RLS and add safe read-only policies.
- Add one health/read query. Do not send votes yet.

## Later steps

- Auth/anonymous identity and voting integrity
- Submission and moderation workflows
- Results, charts, and maps
- Translation workflow
- Push notifications and FCM HTTP v1

The existing `supabase/` schema/functions are retained as historical draft material. They are not connected to the Step 1 mobile runtime and must be reviewed before use.
