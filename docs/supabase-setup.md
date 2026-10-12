# Supabase baseline setup

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

## 1. Initialize the local Supabase project

Prerequisites: Docker Desktop (or another Docker-compatible runtime) and Supabase CLI.

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

## 3. Create a fresh remote project

Create separate Supabase projects for development/staging and production. Begin with development.
Then:

```bash
npx supabase login
npx supabase link --project-ref <development-project-ref>
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

Do not use `--include-seed` for production. For a disposable development project only, seed data may
be applied explicitly after confirming the linked project.

## 4. Generate database types

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

## 5. Remote safety rules

- Never use `supabase db reset --linked` against production.
- Never modify production tables from Dashboard Table Editor or ad-hoc SQL.
- Preview every deployment with `supabase db push --dry-run`.
- Coordinate one migration deployment at a time.
- Back up before any destructive forward migration.
- Store service-role, database, FCM, and translation secrets only in server-side secret storage.
- The mobile app will eventually receive only the Supabase URL and publishable key.

## Exit criteria

- `npx supabase db reset` succeeds from an empty local database.
- `npx supabase test db` passes.
- `npx supabase db lint --local` has no blocking findings.
- Remote dry-run lists only `202610120001_baseline.sql`.
- The development remote applies the baseline without seed or schema drift.
