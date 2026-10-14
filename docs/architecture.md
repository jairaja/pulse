# PULSE delivery plan

## Delivery rule

Each step must start, be manually tested, and be understood before the next step changes the dependency graph or adds a remote service.

## Phase 1 — local product data

- Expo SDK 57 app shell
- Direct question → vote → local receipt interaction; the backend will reveal results the next day
- A read-only Supabase connection check exists; product data and votes remain local
- No database writes, push, identity, map, or chart dependency at runtime

**Exit criteria:** Expo Go opens the app without red-screen errors; all drawer destinations open; the
local vote completes; and the Settings screen reports an explicit Supabase connected/error state.

## Step 2 — navigation and local UX

- Expo Router provides a six-destination drawer: Today, Past Results, My Pulse, Brewing Questions,
  Settings, and About.
- In-progress vote results are not exposed.
- Results compare the user's vote with the finalized aggregate from PULSE voters; Phase 1 stores no country.
- Add SDK-aligned navigation dependencies using `npx expo install`.
- Keep vote state ephemeral until the secure backend write path is designed; a reload resets this prototype.
- Past Results lists every finalized question; participation controls only whether “Your vote” is shown.

## Step 3 — Supabase read-only connectivity (implemented)

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

Translation is a product-integrity concern, not merely presentation. The proposed approach and its
decision gates are documented in [`translation-strategy.md`](./translation-strategy.md); no runtime
translation should be introduced until that decision is approved.

Optional account UX, account-enumeration constraints, contextual sign-in entry points, notification
ownership, logout behavior, and safe share attribution are proposed in
[`account-auth-ux.md`](./account-auth-ux.md). Account UI must not precede server-confirmed vote and
canonical history-merge contracts.

The `supabase/` directory contains one pre-production baseline and database tests. The mobile runtime
now exercises only the read-only `get_today_question` RPC as a connection check; it does not yet use
the response as product content or write votes.
