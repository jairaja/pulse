# PULSE — The world today

Production-ready MVP blueprint for a daily global yes/no pulse app.

## 1) Expo install and run commands

```bash
npm install
npx expo start
npx expo run:android
npx expo run:ios
```

## 2) Stack

- React Native + Expo + TypeScript + Expo Router
- Zustand (state)
- TanStack React Query (server state)
- Victory Native (result chart)
- react-native-maps (global heat map)
- Supabase (Postgres + RPC + Edge Functions)
- Firebase Cloud Messaging (daily push)

## 3) Project architecture

```text
app/
  (drawer)/
    index.tsx              # Home: prediction -> vote -> result
    history.tsx            # Answered-only history
    my-pulse.tsx           # Agreement/disagreement + prediction accuracy
    submit-question.tsx    # Weekly submission flow
    settings.tsx
    about.tsx
src/
  api/pulseApi.ts
  components/
    BinaryChoiceButtons.tsx
    WorldHeatMap.tsx
  constants/defaults.ts
  hooks/useConnectivity.ts
  services/
    firebase.ts
    supabase.ts
  stores/
    sessionStore.ts
    votingStore.ts
  theme/colors.ts
  types/domain.ts
supabase/
  migrations/202611070001_init.sql
  seed.sql
docs/
  deployment.md
  edge-functions.md
  github-issues.md
  env.md
```

## 4) MVP behavior mapping

- Home enforces **prediction first**, then vote.
- Vote disabled until prediction exists.
- After vote, live results + heatmap appear.
- History only returns voted questions from backend policy/query.
- My Pulse metrics shown after enough answers (threshold in app + API).
- Anonymous identity built with UUID + device ID + IP hash rate limiting.

## 5) World heat map implementation

`WorldHeatMap` uses `react-native-maps` circles with yes/no glow color per country centroid.
In production, fetch centroid + ratio for each country via RPC and animate updates every 10s.

## 6) Share card

Planned payload:
- today question
- world result
- user country result
- user vote
- website link and message:
  “Get the NO LOGIN required app. Check out the world's pulse and get yours heard.”

## 7) GitHub repository structure

- `.github/ISSUE_TEMPLATE/feature.md` feature template
- `docs/github-issues.md` issue backlog with epics and acceptance criteria

## 8) Supabase migration + seeds

Apply:

```bash
supabase db reset
```

or:

```bash
supabase migration up
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

## 9) Deployment quick path

See `docs/deployment.md` for Expo EAS + Supabase + Edge Functions + FCM rollout.
