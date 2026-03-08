# Firebase Cloud Messaging setup

1. Create Firebase project.
2. Add Android app `com.pulse.worldtoday` and iOS bundle id.
3. Download `google-services.json` and `GoogleService-Info.plist`.
4. Configure Expo/EAS credentials for FCM.
5. Store secrets in Supabase:
   - `FCM_PROJECT_ID`
   - `FCM_CLIENT_EMAIL`
   - `FCM_PRIVATE_KEY`
6. Schedule Supabase Edge Function `daily-notification` at `0 12 * * *` (GMT).
7. Message body:
   - `The world is voting now. Today's question is live.`
