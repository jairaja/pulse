# Deployment Instructions

## Mobile app (Expo/EAS)

1. Configure EAS project:
   ```bash
   npx eas login
   npx eas init
   ```
2. Add secrets:
   ```bash
   npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value <url>
   npx eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key>
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
2. Push database changes:
   ```bash
   supabase db push
   psql "$SUPABASE_DB_URL" -f supabase/seed/seed.sql
   ```
3. Deploy edge function:
   ```bash
   supabase functions deploy daily-notification
   ```
4. Configure scheduler for 12:00 GMT invocation.

## FCM

1. Create service account credentials.
2. Store credentials in Supabase function secrets.
3. Send daily topic notification (`pulse_daily`) from `daily-notification`.
