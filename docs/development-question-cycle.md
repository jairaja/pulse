# Hosted development question cycle

## Exact daily UTC boundary

Today's voting window is [today 00:00 UTC, tomorrow 00:00 UTC). At the closing boundary, the prior
question is finalized and the most-upvoted eligible community question becomes live in the same locked transaction. The
job is scheduled at `0 0 * * *`, never noon. Public Today/Past Results reads catch up a delayed or
missed rollover before returning data, so results do not wait for a periodic minute/noon publication.
App requests still need network time; an offline device cannot promise a live update.

The UI counts down using server timing and names the absolute UTC date. Countdown wording is display
only; the server closes voting using its own clock. A shared/exclusive advisory lock prevents a
finalization snapshot from overtaking a vote insert that was legitimately accepted before closure.
No new insert is valid after the boundary.

There is no scheduled-question override or published preview. Every open community submission remains
eligible across days. At midnight, accumulated pre-boundary upvotes decide the next daily question;
equal totals prefer the later submission, then UUID. The winner leaves Brewing. See
`docs/brewing-community-rules.md` for filters, moderation and exact rollout rules.

## Install and add fixtures

After merging/pulling the changes, from the checkout linked to hosted development:

```bash
npx supabase link --project-ref <DEV_PROJECT_REF>
npx supabase db push --dry-run
npx supabase db push
```

Inspect all pending migrations before pushing. Do not reset the database. In the DEVELOPMENT SQL
Editor first set `pulse.seed_author` to an existing verified auth user UUID, as the comments in
`supabase/seed/development-cycle.sql` explain, then run that script in the same editor session. It
adds two historical samples, an eligible community candidate for today and a new open submission;
actual past totals are finalized. No artificial votes or future administrator schedule are inserted.
Existing live questions, accepted votes and finalized results remain intact.

Unlike the original fixed-UUID seed, this script is repeatable across days. Run it twice to verify
identities/counts remain stable. It is DEVELOPMENT ONLY; never apply sample questions to production.

Rebuild/install preview to get the Brewing screen implementation:

```bash
npx eas-cli@latest build --platform android --profile preview
```

Expo Go/development clients can instead reload Metro's updated JavaScript. No Edge Function changes
or new secret values are needed by this feature.

## Expected screens

- Today: the current live UTC question; existing receipts remain valid.
- Past Results: actual finalized past questions, including yesterday after catch-up. Pull to refresh.
- Brewing Questions: all open community cards, with timestamps, upvote controls, server-side sorting
  and filters. Guests browse; verified accounts submit/upvote once per UTC day. Admin/superuser
  removal requires a reason and creates a private audit entry.
- At 00:00 UTC: the prior daily result is finalized and the highest-ranked candidate becomes live.
  It leaves Brewing; no administrator can preselect/reserve a future daily question through the app.

The legacy get_brewing_question RPC now returns no rows for older app compatibility. Scheduled draft
rows remain private and cannot block the community winner. See `docs/brewing-community-rules.md`.

## Diagnose the hosted scheduler (SQL Editor)

```sql
select jobid, jobname, schedule, active
from cron.job where jobname = 'pulse-daily-finalization';

select status, return_message, start_time, end_time
from cron.job_run_details
where jobid in (select jobid from cron.job where jobname = 'pulse-daily-finalization')
order by start_time desc limit 10;

select id, asked_on, status, results_finalized_at, preview_published
from public.questions order by asked_on desc limit 10;
```

Do not manually overwrite result totals to make Past Results appear. Investigate failed cron entries
and apply the reviewed migrations. A manual catch-up in the development SQL Editor is:

```sql
select * from private.finalize_daily_pulse(now());
```

## App version warning and Android floor

EAS cli.appVersionSource is explicitly local, preserving the existing repository-managed version
behavior. app.json contains the marketing version; manage android.versionCode / ios.buildNumber there
when preparing store releases. This setting does not automatically bump either value.

The installed React Native/Expo Android defaults use minSdk 24 (Android 7.0). An actual artifact can be
checked with Android SDK tools: `apkanalyzer manifest min-sdk path/to/pulse.apk`. This repository has
no minSdk override; confirm build logs/artifact if local native configuration differs.
