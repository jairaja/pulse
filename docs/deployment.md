# Deployment instructions

## Mobile app
1. `eas build --platform ios`
2. `eas build --platform android`
3. Submit via `eas submit`.

## Backend
1. Create Supabase project.
2. Apply migrations in `supabase/migrations`.
3. Deploy edge functions:
   - `supabase functions deploy daily-notification`
   - `supabase functions deploy question-selector`
4. Set up cron triggers for daily notification and nightly question selection.

## Website deep link
Landing URL configured via `EXPO_PUBLIC_WEBSITE_URL` in share card flow.
