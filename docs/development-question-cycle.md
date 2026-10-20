# Hosted development question cycle

## Exact daily UTC boundary

Today's voting window is [today 00:00 UTC, tomorrow 00:00 UTC). At the closing boundary, the prior
question is finalized and today's scheduled question activates in the same locked transaction. The
job is scheduled at `0 0 * * *`, never noon. Public Today/Past Results reads catch up a delayed or
missed rollover before returning data, so results do not wait for a periodic minute/noon publication.
App requests still need network time; an offline device cannot promise a live update.

The UI counts down using server timing and names the absolute UTC date. Countdown wording is display
only; the server closes voting using its own clock. A shared/exclusive advisory lock prevents a
finalization snapshot from overtaking a vote insert that was legitimately accepted before closure.
No new insert is valid after the boundary.

The published preview is an explicit administrator announcement of tomorrow's scheduled question.
It does not expose private drafts. Community suggestions are separate: each verified account may
submit one question and upvote one other user's suggestion per UTC day. All open submissions stay
eligible across days. At midnight, when no question is already scheduled for the new day, the one
with most accumulated pre-boundary upvotes goes live. Ties prefer the later submission, then UUID.
This selection is not announced early as a published preview.

## Install and add fixtures

After merging/pulling the changes, from the checkout linked to hosted development:

```bash
npx supabase link --project-ref <DEV_PROJECT_REF>
npx supabase db push --dry-run
npx supabase db push
```

Inspect all pending migrations before pushing. Do not reset the database. Then open the DEVELOPMENT
project's Dashboard > SQL Editor, paste the entire `supabase/seed/development-cycle.sql`, and run it.
It creates missing questions for two past UTC dates, today and tomorrow, and finalizes actual past
totals. New historical examples have zero votes; no artificial vote rows or totals are inserted.
Existing questions/text/accepted votes/results are retained. Tomorrow's existing scheduled question,
if any, is explicitly marked as a public preview; otherwise a new one is generated.

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
- Brewing Questions: tomorrow's scheduled question only if `preview_published = true`. The screen has
  a refresh button and polls while active. Sign in with a verified email account for one daily submission and one daily upvote on another user’s question.
- After 00:00 UTC tomorrow: the midnight job or first public read makes the preview Today and today's
  question gains a finalized result. No votes are accepted on a scheduled preview.

Draft questions remain hidden by RLS. The public get_brewing_question RPC exposes only the opted-in
scheduled question dated tomorrow and its selected translation; it never exposes vote counts or
later/unpublished drafts. Its definer permission is intentionally limited to that explicit read.

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
