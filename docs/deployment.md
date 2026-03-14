# Deployment Instructions (Latest / Recommended)

## Mobile app (Expo/EAS)

1. Configure EAS project:
   ```bash
   npx eas login
   npx eas init
   ```
2. Add public app runtime vars:
   ```bash
   npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value <project-url>
   npx eas secret:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <sb_publishable_key>
   ```
3. Build preview:
   ```bash
   npx eas build --platform all --profile preview
   ```
4. Submit production:
   ```bash
   npx eas submit --platform all
   ```

## Supabase

1. Link project:
   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   ```
2. Push DB changes + seed:
   ```bash
   supabase db push
   psql "$SUPABASE_DB_URL" -f supabase/seed/seed.sql
   ```
3. Deploy edge function:
   ```bash
   supabase functions deploy daily-notification
   ```
4. Configure scheduler for 12:00 GMT invocation.

## Secrets policy (critical)

- Safe in mobile app runtime: **Project URL + Publishable key**.
- Never in mobile app runtime: `service_role` / `secret key`.
- Keep server-only secrets in Supabase Edge Function secrets.

## FCM

1. Create Firebase service account credentials.
2. Store credentials as Supabase function secrets.
3. Send daily topic notification (`pulse_daily`) from `daily-notification`.
