# Supabase baseline setup

## What runs on a user's phone—and what does not

Files under `supabase/` are deployment and development inputs. Expo Router does not import them,
Metro does not bundle them, and installing or opening the mobile app does not execute migrations,
seed data, database tests, or Edge Function source. A developer or CI job applies a migration once
to a Supabase project; every installed app then talks to that already-running remote API.

The only Supabase values that will eventually ship in the mobile bundle are the project URL and a
publishable key. A publishable key is designed for public clients and is constrained by database
grants and RLS. Database passwords, secret keys, service-role credentials, and third-party API keys
must never be placed in an `EXPO_PUBLIC_*` variable or committed to this repository.

## Is local Supabase required?

It is not required for an end user's device and it is not required while the current app remains a
local-only prototype. It **is the recommended requirement for anyone changing or deploying this
schema**: it catches SQL, RLS, seed, and migration-order failures before the shared remote project is
touched. Skipping local validation turns the remote project into a test environment and makes
recovery harder.

## Decision: start with a fresh project

PULSE is not connected to a production database and has no production data to preserve. The safest
choice is therefore a new Supabase project plus one reviewed baseline migration. The four prototype
migrations were removed rather than carrying corrective history into production.

If any existing Supabase project contains real user data, **stop**. Do not reset it, delete it, or
apply this baseline over it. That situation needs a forward-only data migration and backup plan.

## What the baseline contains

- Daily questions and selected translation candidates.
- Opaque installations that may later link to an optional Supabase Auth account.
- Immutable accepted votes with installation and optional account uniqueness.
- Immutable finalized result snapshots, so public readers never aggregate live votes.
- RLS on every application table.
- No direct client access to installations or raw votes.
- Read-only, security-invoker RPCs for today's question and paginated finalized results.

Question submissions, moderation, vote-write RPCs, account merge, push tokens, and translation jobs
are deliberately absent. Each belongs in a reviewed forward migration when its feature is built.

## 1. Set up Supabase locally (recommended for this repository)

### Windows prerequisites

1. Install and start Docker Desktop using the WSL 2 backend.
2. Confirm Docker is running:

   ```powershell
   docker version
   ```

3. From the repository root, confirm the checkout contains only the baseline migration:

   ```powershell
   npm run verify:database
   ```

4. Initialize the Supabase CLI configuration. `npx` downloads/runs the current CLI without a global
   installation:

   ```powershell
   npx supabase init
   ```

5. Start the local stack, rebuild it from the baseline, run database tests, and lint the schema:

   ```powershell
   npx supabase start
   npx supabase db reset
   npx supabase test db
   npx supabase db lint --local
   ```

6. Record the local Studio URL printed by `supabase start` (normally
   `http://127.0.0.1:54323`) and inspect the database using the checklist in the next section.
7. Stop the containers when finished. Local data persists until `db reset`:

   ```powershell
   npx supabase stop
   ```

The equivalent shell commands are:

From the repository root:

```bash
npx supabase init
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase db lint --local
```

`supabase init` creates `supabase/config.toml`; commit it. `db reset` is intentionally destructive
to the **local** database and proves that the migration plus `supabase/seed.sql` are reproducible.

### If verification still finds the four prototype migrations

Those files are not a cache: the Supabase CLI will execute every SQL file in
`supabase/migrations`. This means the squash was not fully applied to that checkout. First preview
the repository's narrowly allowlisted cleanup, then apply it:

```bash
npm run db:baseline:clean
npm run db:baseline:clean -- --apply
npm run verify:database
git status --short
```

The cleanup command only recognizes the four superseded migration filenames; it will not delete an
unknown or future migration. Commit the displayed deletions if Git reports them as changes. Do not
make the verifier ignore extra migrations—doing so would hide SQL that Supabase will execute.

## 2. Inspect the local database

Open the Studio URL printed by `supabase start` and verify:

1. Exactly five application tables exist: `questions`, `question_translations`, `installations`,
   `votes`, and `question_results`.
2. RLS is enabled on all five.
3. The seed contains one live question and one finalized result.
4. There are no `users`, `predictions`, `countries`, or submission tables from the old drafts.
5. Anonymous clients cannot read `votes` or `installations`.

Do not edit the schema in Studio. All changes must be new timestamped migrations created with:

```bash
npx supabase migration new <short_description>
```

## 3. Set up remote project `pnbfhbobymtypmdtzfsq`

The project reference was taken from the supplied Dashboard URL. These commands target:

- Dashboard: `https://supabase.com/dashboard/project/pnbfhbobymtypmdtzfsq`
- API URL: `https://pnbfhbobymtypmdtzfsq.supabase.co`

### 3.1 Decide whether this project is disposable

Before linking or pushing, open the Dashboard and inspect **Table Editor**. Use the CLI
`migration list` command in the next section to inspect migration history. If this project contains
real user data, is already serving an app, or has schema changes that must be retained, stop: do not
reset it and do not force the squashed baseline onto it. Create a separate development project or
write forward-only migrations.

If it is an empty/disposable development project, continue.

### 3.2 Log in and link the checkout

From the repository root:

```powershell
npx supabase login
npx supabase link --project-ref pnbfhbobymtypmdtzfsq
npx supabase projects list
npx supabase migration list
```

The browser login or CLI will request a Supabase personal access token, and linking may request the
database password created with the project. Do not save either value in `.env` or Git. Confirm that
the linked marker in `projects list` is beside `pnbfhbobymtypmdtzfsq`.

### 3.3 Handle the project's current state

Choose exactly one path:

**Path A — empty remote with no old PULSE migrations (preferred):**

```powershell
npx supabase db push --dry-run
npx supabase db push
```

The dry-run must list only `202610120001_baseline.sql`. If it lists anything else, stop and fix the
checkout before pushing.

**Path B — disposable development remote containing the discarded prototype schema:**

```powershell
npx supabase projects list
npx supabase db reset --linked --no-seed
```

This permanently deletes the linked remote database's application schema/data and rebuilds it from
the local baseline. Use it only after verifying the project reference and only when losing all data
is acceptable. Never run it against production. If there is any doubt, create a new project instead.

### 3.4 Verify the remote schema

Return to the project's Dashboard:

1. Confirm the five application tables listed in section 2 exist.
2. Confirm RLS is enabled on every table.
3. Confirm there are no legacy `predictions`, `countries`, `users`, or submission tables.
4. Do not apply `supabase/seed.sql` to production. It contains fake demonstration totals.

### 3.5 Obtain the future mobile connection values

Open the project's **Connect** dialog and copy its project URL and **publishable key**, or open
**Settings → API Keys** to select/create a publishable key. Do not use the legacy `anon` key for new
work, and never put a secret key in the mobile app.

The values will be introduced only when the read-only connectivity step is implemented:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://pnbfhbobymtypmdtzfsq.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
```

Do not add these variables to the current `.env.example` yet: the current runtime intentionally
makes no Supabase request, so adding configuration now would create false confidence without testing
the client integration.

## 4. Recommended environment strategy

Treat `pnbfhbobymtypmdtzfsq` as development unless it is explicitly designated otherwise. Before
launch, create a separate production project. For each non-local environment, deploy the same
committed migrations; do not recreate the schema manually in Dashboard.

The normal deployment sequence is:

```bash
npx supabase login
npx supabase link --project-ref <development-project-ref>
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

Do not use `--include-seed` for production. For a disposable development project only, seed data may
be applied explicitly after confirming the linked project.

## 5. Generate database types

After every schema migration:

```bash
mkdir -p supabase/types
npx supabase gen types --lang typescript --local > supabase/types/database.types.ts
```

PowerShell equivalent for the directory step:

```powershell
New-Item -ItemType Directory -Force supabase/types | Out-Null
```

This keeps generated backend types outside the deliberately minimal mobile TypeScript scope. Do not
import the generated type file into the app until the read-only Supabase client step.

## 6. Remote safety rules

- Never use `supabase db reset --linked` against production.
- Never modify production tables from Dashboard Table Editor or ad-hoc SQL.
- Preview every deployment with `supabase db push --dry-run`.
- Coordinate one migration deployment at a time.
- Back up before any destructive forward migration.
- Store service-role, database, FCM, and translation secrets only in server-side secret storage.
- The mobile app will eventually receive only the Supabase URL and publishable key.

## Official references

- [Local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Seed data](https://supabase.com/docs/guides/local-development/seeding-your-database)

## Exit criteria

- `npx supabase db reset` succeeds from an empty local database.
- `npx supabase test db` passes.
- `npx supabase db lint --local` has no blocking findings.
- Remote dry-run lists only `202610120001_baseline.sql`.
- The development remote applies the baseline without seed or schema drift.
