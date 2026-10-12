# PULSE delivery plan

## Delivery rule

Each step must start, be manually tested, and be understood before the next step changes the dependency graph or adds a remote service.

## Phase 1 — local UX (current)

- Expo SDK 57 app shell
- Direct question → vote → local receipt interaction; the backend will reveal results the next day
- No database, push, identity, map, chart, or API dependency at runtime

**Exit criteria:** Expo Go opens the app without red-screen errors; all drawer destinations open; the local vote completes; no network request is made.

## Step 2 — navigation and local UX

- Expo Router provides a five-destination drawer: Today, Past Results, My Pulse, Brewing Questions,
  and About.
- In-progress vote results are not exposed.
- Results compare the user's vote with the finalized aggregate from PULSE voters; Phase 1 stores no country.
- Add SDK-aligned navigation dependencies using `npx expo install`.
- Keep vote state ephemeral until the secure backend write path is designed; a reload resets this prototype.
- Past Results lists every finalized question; participation controls only whether “Your vote” is shown.

## Step 3 — Supabase read-only connectivity

- Configure the project URL and publishable key.
- Enable RLS and add safe read-only policies.
- Add one health/read query. Do not send votes yet.
- Start from the single reviewed baseline migration described in `docs/supabase-setup.md`.

## Country comparisons — deferred decision

Do not infer residence from a phone calling code, SIM, device locale, or IP address. These signals
describe an account or network location, not necessarily the country a person identifies with or
lives in. A future country comparison requires an optional self-declared country, clear labeling as
an unweighted sample of PULSE participants, minimum sample thresholds, and a way to prevent users
from repeatedly changing country to inspect or manipulate small cohorts. Until that design is
approved, the database and result contract remain global-only.

## Later steps

- Auth/anonymous identity and voting integrity
- Submission and moderation workflows
- Results, charts, and maps
- Translation workflow
- Push notifications and FCM HTTP v1

The `supabase/` directory now contains one pre-production baseline and database tests. It remains
disconnected from the mobile runtime until the read-only connectivity step.
