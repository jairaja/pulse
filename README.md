# PULSE — The world today

Production-quality MVP foundation for a global daily yes/no app.

## Supabase connection (LATEST + RECOMMENDED)

For client/mobile apps, use:
- **Project URL**
- **Publishable key** (`sb_publishable_...`)

In this project:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

`createClient(url, publishableKey)` is still the correct SDK usage in `supabase-js`.

### Important security rules

- Never put **service role** or **secret key** in Expo/mobile env vars.
- Keep server-only secrets in Supabase Edge Function secrets or your server runtime.
- Enforce RLS + policies for all client-accessible tables.

## Why FCM if Supabase has push support?

Supabase does not directly replace APNs/FCM delivery rails for native mobile push.
Recommended pattern:
- Supabase = orchestration (data, scheduling, targeting, function execution)
- FCM/APNs = push transport


## SDK 54 upgrade playbook (required for iOS Expo Go)

If Expo Go on iOS is SDK 54, your project must also be SDK 54.
You cannot install an older Expo Go on iOS.

1. Upgrade core versions in `package.json` (Expo 54 / React 19.1 / RN 0.81 / Expo Router 6).
2. Reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
3. Force Expo-managed compatibility pinning:
   ```bash
   npx expo install --fix
   ```
4. Align reanimated/worklets native+JS versions:
   ```bash
   npx expo install react-native-reanimated react-native-worklets react-native-gesture-handler
   ```
5. Clear Metro cache and restart:
   ```bash
   npx expo start -c
   ```
6. Validate project health:
   ```bash
   npx expo-doctor
   ```

## Install commands

```bash
npm install
npx expo start
```

## Supabase end-to-end setup (LATEST workflow)

1. Create a Supabase project.
2. In **Project Settings → API**, copy:
   - Project URL
   - Publishable key
3. Copy `.env.example` to `.env`.
4. Set:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
5. Install and login CLI:
   ```bash
   supabase login
   ```
6. Link local repo:
   ```bash
   supabase link --project-ref <project-ref>
   ```
7. Push schema:
   ```bash
   supabase db push
   ```
8. Seed demo data (choose one):
   - If `psql` is installed:
     ```bash
     psql "$SUPABASE_DB_URL" -f supabase/seed/seed.sql
     ```
   - If `psql` is not installed, use Supabase Dashboard SQL Editor:
     1. Open SQL Editor in your Supabase project.
     2. Paste `supabase/seed/seed.sql`.
     3. Run it.
9. Deploy function:
   ```bash
   supabase functions deploy daily-notification
   ```
10. Configure function secrets:
   ```bash
   supabase secrets set FCM_SERVER_KEY="<fcm-server-key>" --project-ref <project-ref>
   supabase secrets set GOOGLE_TRANSLATE_API_KEY="<google-key>" --project-ref <project-ref>
   supabase secrets set OPENAI_API_KEY="<openai-key>" --project-ref <project-ref>
   ```
11. Set scheduler (daily 12:00 GMT):
   - Supabase Dashboard → Edge Functions → `daily-notification` → Schedules → New schedule
   - Cron: `0 12 * * *`
   - Timezone: `Etc/UTC`
12. Run app and verify: today question, prediction insert, vote insert, results RPC, heatmap RPC.

## Expo Go troubleshooting (exact fixes)

### A) Route warnings: files in `app/components` and `app/providers`
Fix: keep only routes/layouts under `app/`. Move shared components/providers to `src/components` and `src/providers`.

### B) Worklets mismatch (`0.7.4 vs 0.5.1`)
Fix sequence:
1. Ensure Expo Go app version matches SDK 52.
2. Reinstall with Expo-managed versions:
   ```bash
   npx expo install react-native-reanimated react-native-gesture-handler
   ```
3. Clear metro cache:
   ```bash
   npx expo start -c
   ```

### C) MMKV TurboModules error in Expo Go
`react-native-mmkv` 3.x requires new architecture. For Expo Go compatibility use MMKV 2.x.

## `.env.example` purpose + your action

Purpose:
- Template listing required env variables.
- Safe to commit (no real secrets).

Your action:
1. Copy to `.env`.
2. Fill real values.
3. Never commit `.env`.
