# Why the community migration can be absent from a dry run

Verified on 22 October 2026: GitHub main contains `supabase/migrations/202610210001_community_only_brewing.sql`, merged through PR #89 (main commit `997a803`). Earlier local checkouts will not have it until Git is updated. `supabase db push --dry-run` does not download code from GitHub; it compares files in the current local project with the linked database's migration history and lists pending changes only.

From the local Pulse repository root:

```sh
git branch --show-current
git log -1 --oneline
git switch main
git pull --ff-only origin main
git ls-files -- supabase/migrations/202610210001_community_only_brewing.sql
npx supabase migration list
npx supabase db push --dry-run
```

The `git ls-files` command should print the migration path. A fast-forward-only pull will stop if the branch has diverged; resolve that Git state rather than resetting local work.

Interpret migration version `202610210001` in the Local/Remote columns:

| Local | Remote | Meaning |
| --- | --- | --- |
| Missing | Missing | This checkout does not contain the file, or the CLI is running in a different project directory. Update Git and check the working directory. |
| Present | Missing | It is pending on that linked database and should appear in the dry-run plan. If it does not, capture the full dry-run and migration-list output from the same directory/project. |
| Present | Present | Supabase records it as applied; omitting it from the pending dry-run plan is expected. |
| Missing | Present | The database knows the migration but this local checkout is behind or lacks the file. Restore the reviewed Git version. |

Confirm the CLI's linked project matches the intended DEVELOPMENT project in the Supabase Dashboard. The app's `.env` URL does not set the Supabase CLI link; `supabase status` describes local services, not proof of hosted migration status. If the link is wrong, use `npx supabase link --project-ref <YOUR_DEV_PROJECT_REF>` and repeat the read-only list/dry run.

If the file is pending, review the dry-run plan before applying `npx supabase db push`. If it is already recorded as applied, a new filename/version or a migration-history repair is not the right way to make it appear again. Recorded history with missing database objects needs a separate schema inspection, not blind replay.

For a concrete diagnosis, share the current branch, latest commit, `migration list` and dry-run output. No key, password or access token is required.
