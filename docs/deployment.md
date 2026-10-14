# Deployment status

No mobile-store deployment is part of the current step. The Supabase baseline must already be
deployed before the in-app connection check can pass.

Configure only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the client.
Never expose a Supabase secret/service-role key. FCM, scheduled functions, translations, and voting
writes remain deferred.

## Step 1 run command

```bash
npm install
npx expo install --fix
npx expo-doctor
npx expo start --clear
```

Only when this flow works should a future step introduce deployment configuration.
