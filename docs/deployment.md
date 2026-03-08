# Deployment instructions

1. Create Supabase project, run migration and seed.
2. Configure RLS policies for anonymous users + rate limits by device_id and hashed IP.
3. Deploy Edge Functions:

```bash
supabase functions deploy moderate-submission
supabase functions deploy translate-question
supabase functions deploy daily-question-picker
supabase functions deploy send-daily-notification
```

4. Create Firebase project and Cloud Messaging credentials.
5. Add Expo push setup + Android `google-services.json` / iOS APNs key.
6. Build with EAS:

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

7. Publish OTA updates:

```bash
eas update --branch production --message "MVP rollout"
```
