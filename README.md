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

## What was legacy in previous guidance?

Items updated to current recommendations:
1. **“Anon key” wording** → replaced with **publishable key** naming.
2. `EXPO_PUBLIC_SUPABASE_ANON_KEY` → replaced with `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Deployment docs now reference publishable key for mobile builds.

Still valid (not legacy):
- Using Supabase Edge Functions for scheduled jobs.
- Using `supabase db push` for migration deployment.
- Using SQL migration files in source control.

## Why FCM if Supabase has push support?

Supabase does not directly replace APNs/FCM delivery rails for native mobile push.
Recommended pattern:
- Supabase = orchestration (data, scheduling, targeting, function execution)
- FCM/APNs = push transport

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
10. Add function secrets (FCM + translation keys + server-only Supabase secret if needed).
11. Configure scheduler for daily 12:00 GMT invocation.
12. Run app and verify: today question, prediction insert, vote insert, results RPC, heatmap RPC.

## `.env.example` purpose + your action

Purpose:
- Template listing required env variables.
- Safe to commit (no real secrets).

Your action:
1. Copy to `.env`.
2. Fill real values.
3. Never commit `.env`.

## `202603070001_init.sql` purpose + your action

Purpose:
- Baseline migration for core schema and RPC functions.

Your action:
1. Apply with `supabase db push`.
2. Seed with `supabase/seed/seed.sql`.
3. Add future changes as new migration files.
