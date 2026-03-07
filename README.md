# PULSE — The world today

Production-ready MVP blueprint for a daily global yes/no voting app.

## 1) Install commands

```bash
npm install
npx expo start
```

## 2) Stack

- React Native + Expo + TypeScript
- Expo Router (drawer architecture)
- Zustand (local app/session state)
- TanStack React Query (server state)
- Victory Native (results chart)
- react-native-maps (world heat map)
- Supabase PostgreSQL + Edge Functions
- Firebase Cloud Messaging (daily push)

## 3) Project structure

```text
app/
  (drawer)/
    _layout.tsx
    index.tsx
    history.tsx
    my-pulse.tsx
    submit-question.tsx
    settings.tsx
    about.tsx
  components/
  providers/
src/
  api/
  config/
  constants/
  hooks/
  stores/
  types/
supabase/
  migrations/
  functions/
  seed/
docs/
.github/ISSUE_TEMPLATE/
```

## 4) Environment variables

Create `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_WEBSITE_URL=https://pulse-world.example.com
FCM_SERVER_KEY=
GOOGLE_TRANSLATE_API_KEY=
OPENAI_API_KEY=
```

## 5) Identity and anti-abuse

- Anonymous UUID in `users`
- Device ID with unique vote constraint (`unique(device_id, question_id)`)
- IP hash for backend rate limiting in Edge Functions

## 6) Product flow implemented

1. Prediction required first (YES/NO)
2. Voting unlocked after prediction
3. Result view renders with world + country + user vote
4. Heatmap and chart poll in near real-time
5. Share card includes required link message

## 7) Firebase setup (FCM)

1. Create Firebase project
2. Add iOS and Android app IDs matching `app.json`
3. Download `google-services.json` and `GoogleService-Info.plist`
4. Configure Expo push + native credentials via EAS
5. Schedule Supabase Edge Function (`daily-notification`) at 12:00 GMT

## 8) Supabase deployment

```bash
supabase start
supabase db reset
supabase functions deploy daily-notification
```

Run migration and seed files from `supabase/migrations` and `supabase/seed`.

## 9) World heatmap implementation

- `WorldHeatMap.tsx` uses `react-native-maps` circles per country coordinate.
- Color logic: neon cyan for YES-majority, pink for NO-majority.
- Data source: `get_country_heatmap(question_id)` RPC.

## 10) Translation quality strategy

- Store Google + OpenAI outputs in `question_translations`.
- Persist quality score from evaluation function.
- Mark best translation with provider=`selected`.
- UI can toggle translated/original text.

## 11) Developer control panel (server-side spec)

Expose admin-only endpoints for:
- Manual question insert
- Override tomorrow selection
- Veto/disable submissions
- Mark duplicates and abuse

## 12) History rule

History endpoint only returns questions where `votes.device_id = current_device_id`.

## 13) Offline behavior

- NetInfo listener on launch and during runtime
- Show `No internet connection.` banner
- Keep previously answered history available via local cache

## 14) GitHub repository layout

- App code in `app/` and `src/`
- Backend schema/functions in `supabase/`
- Planning docs and issue breakdown in `docs/`
- Reusable issue templates in `.github/ISSUE_TEMPLATE/`
