# PULSE — The world today

Production-ready MVP blueprint for an anonymous daily global voting app.

## 1) Expo project bootstrap commands

```bash
npx create-expo-app@latest pulse --template tabs@50 --typescript
cd pulse
npx expo install expo-router react-native-gesture-handler react-native-reanimated react-native-screens react-native-safe-area-context
npx expo install @react-native-async-storage/async-storage expo-network expo-notifications expo-sharing expo-device expo-constants
npm i zustand @tanstack/react-query @supabase/supabase-js victory-native react-native-svg react-native-maps i18next react-i18next nanoid
npm i -D typescript eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-config-universe
```

## 2) Folder architecture

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
  question/[id].tsx
src/
  api/               # Supabase API calls
  components/        # shared UI and feature shells
  components/screens # route screens
  hooks/             # react-query + connectivity hooks
  lib/               # clients (supabase)
  services/          # notification/translation/moderation services
  store/             # Zustand stores
  theme/             # dark neon design system
  types/
supabase/
  migrations/
  functions/
  seed/
docs/
  firebase.md
  deployment.md
  github-issues.md
```

## 3) MVP highlights
- Home flow enforces `prediction -> vote -> results`.
- Results screen includes world result, country result, user vote, live polling, Victory chart, and world heat map.
- History only returns questions user voted on.
- Offline banner and periodic connectivity monitoring.
- Anonymous identity model using UUID + device id.

## 4) Environment
Copy `.env.example` to `.env` and fill values.

## 5) Supabase migration + seed

```bash
supabase db reset
supabase db push
psql "$SUPABASE_DB_URL" -f supabase/seed/seed.sql
```

## 6) Push notifications (FCM)
See `docs/firebase.md`.

## 7) Deployment
See `docs/deployment.md`.
