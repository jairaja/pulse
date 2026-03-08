# Deployment Instructions

## Mobile app (Expo + EAS)

1. `npm install`
2. `npx expo login`
3. `npx eas build:configure`
4. Configure secrets in EAS:
   - Supabase URL / anon key
   - FCM sender key
5. Build:
   - Android: `npx eas build --platform android --profile production`
   - iOS: `npx eas build --platform ios --profile production`

## Supabase

1. `supabase login`
2. `supabase link --project-ref <project-ref>`
3. `supabase db push`
4. `supabase functions deploy daily-push`
5. Configure cron for function at 12:00 GMT daily.

## Runtime checks

- Confirm question for today exists.
- Confirm prediction required before vote.
- Confirm real-time results subscription works.
- Confirm notification arrives at 12:00 GMT.
