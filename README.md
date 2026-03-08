# PULSE — "The world today"

Production-grade Expo + Supabase MVP for one global daily yes/no question.

## 1) Install & run

```bash
npm install
cp .env.example .env
npm run start
```

## 2) Stack

- React Native (Expo, TypeScript, Expo Router)
- Zustand (device/session/settings state)
- TanStack React Query (server state)
- Victory Native (result charts)
- react-native-maps (live world heatmap)
- Supabase PostgreSQL + RLS + Edge Functions
- Firebase Cloud Messaging via Expo notifications

## 3) Core flow (Home)

1. User predicts world YES/NO
2. User votes YES/NO (locked until prediction done)
3. Real-time results screen (world, country, user vote + heatmap)

## 4) Architecture

```text
app/
  (drawer)/
    index.tsx                # Home: prediction -> vote -> results
    history/index.tsx        # Answered-only history
    my-pulse/index.tsx       # Agreement/disagreement metrics
    submit-question/index.tsx
    settings/index.tsx
    about/index.tsx
  features/
    vote/VoteFlowCard.tsx
    results/ResultsChart.tsx
    heatmap/WorldHeatMap.tsx
  lib/
    api.ts
    supabase.ts
    queryClient.ts
    useConnectivityMonitor.ts
  store/useAppStore.ts
supabase/
  migrations/001_init.sql
  functions/daily-push/index.ts
  seed/seed.sql
docs/
  github-issues.md
  deployment.md
```

## 5) Environment variables

See `.env.example`.

## 6) Firebase Cloud Messaging setup

1. Create Firebase project + Android/iOS apps.
2. Download service credentials.
3. Configure Expo push + FCM sender ID.
4. Store credentials in EAS secrets.
5. Schedule Supabase Edge Function `daily-push` at `0 12 * * *` UTC.

## 7) Identity model (no login)

- Anonymous UUID stored on device
- Device ID signal (expo-device)
- Server-side IP rate limiting in Edge Functions
- DB uniqueness on votes: `unique(device_id, question_id)`

## 8) Translation model

Question submissions can be any language.
Translation pipeline compares:
- Google Translate output
- OpenAI output

Then picks best score and stores winner in `question_translations`.

## 9) Share card payload

- Today's question
- World result
- User country result
- User vote
- Link message:  
  `Get the NO LOGIN required app. Check out the world's pulse and get yours heard.`

## 10) GitHub repository structure

- `.github/ISSUE_TEMPLATE/feature.md`
- `docs/github-issues.md` for pre-written issues
- `supabase/migrations` SQL source-of-truth
- `app/` mobile code

