# Deployment status

No backend or mobile-store deployment is part of Step 1.

Do not configure Supabase secrets, FCM, scheduled functions, EAS credentials, translations, or production database policies until Step 1 has passed its local acceptance criteria.

## Step 1 run command

```bash
npm install
npx expo install --fix
npx expo-doctor
npx expo start --clear
```

Only when this flow works should a future step introduce deployment configuration.
