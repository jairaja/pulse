# PULSE delivery plan

## Delivery rule

Each step must start, be manually tested, and be understood before the next step changes the dependency graph or adds a remote service.

## Step 1 — local foundation (current)

- Expo SDK 54 app shell
- One local prediction-before-vote flow
- No database, push, identity, map, chart, or API dependency at runtime

**Exit criteria:** Expo Go opens the app without red-screen errors; the prediction unlocks the local vote; the local confirmation appears.

## Step 2 — navigation and local state

- Add Expo Router navigation only after Step 1 passes.
- Add SDK-aligned navigation dependencies using `npx expo install`.
- Persist non-sensitive UI state with an Expo-compatible storage option.

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
