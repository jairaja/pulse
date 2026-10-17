# Deployment status

No mobile-store deployment is part of the current step. Both reviewed Supabase migrations must be
deployed before the connected Today, Past Results, and voting flows can pass.

Configure only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the client.
Never expose a Supabase secret/service-role key. FCM, scheduled finalization, translations, and
production anti-abuse controls remain deferred.

## Database rollout order

```bash
npm run verify:database
npx supabase db reset
npx supabase test db
npx supabase db lint --local
npx supabase db push --dry-run
npx supabase db push
```

The second migration adds only forward-compatible private idempotency/rate-limit records and the two
restricted voting RPCs. Do not edit an already-applied migration. Never point `db reset` at a remote
or production database.

## Step 1 run command

```bash
npm install
npx expo install --fix
npx expo-doctor
npx expo start --clear
```

Only when this flow works should a future step introduce deployment configuration.

## Vote-gateway security secrets

Generate and store the device-HMAC pepper server-side:

```bash
openssl rand -hex 32
supabase secrets set DEVICE_FINGERPRINT_PEPPER=<generated-value>
```

Never put this value in an `EXPO_PUBLIC_*` variable. Rotating it requires a planned migration because existing fingerprint HMACs were derived with the previous value.

Turnstile enforcement is opt-in only after T18's native challenge exists:

```bash
supabase secrets set TURNSTILE_SECRET_KEY=<cloudflare-secret>
```

When this secret is present, the vote gateway fails closed unless Siteverify accepts the supplied token.
