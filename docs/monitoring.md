# Monitoring and alerts

`Production monitoring` runs every five minutes (offset from the hour) on GitHub's default branch.
It reads aggregate database health and a 15-minute gateway-log window ending two minutes ago to allow
ingestion. Results form a JSON dashboard in each Actions job summary. Alerts create deduplicated GitHub
issues per condition/day and optionally assign the operator. Recovery requires operator review; issues
are never silently closed. A failed run also triggers GitHub's workflow-failure notifications.

## Activation

Configure the `production-monitoring` GitHub Environment with a SELECT-only `OPS_DATABASE_URL`,
optional `OPS_DB_CA` certificate, `SUPABASE_LOGS_READ_TOKEN`, and optional `OPS_HEARTBEAT_URL` secret.
Set variables `SUPABASE_PROJECT_REF` and `OPS_ALERT_ASSIGNEE`. The Supabase token must be scoped only
to this project with `analytics_logs_read`; it is not a service-role key. Restrict environment deployment
branches to main. Do not require human approval for scheduled reads, which would suspend monitoring.

Provision the dedicated DB login through your approved credential-management process. It needs CONNECT,
USAGE on `public`, `private`, `cron` and SELECT on only `public.questions`, `private.runtime_controls`,
`cron.job` and `cron.job_run_details`. It needs no ballot/installation/account tables or write privileges.
Ensure cron's owner-based RLS permits this login to observe the finalizer's schedule/runs; a generic
read grant may still hide those rows. Verify with the exact login. Use a reviewed restricted aggregate
accessor if needed; never give the monitor superuser/BYPASSRLS merely to make it green. Nonlocal DB
connections verify TLS; strip SSL query parameters and supply the approved CA when required.

Run `npm run ops:monitor` without `--publish` to validate read access and inspect sanitized output, then
dispatch the workflow. Validate that logs use the current unified ClickHouse schema. Missing/invalid
telemetry causes an alert, rather than a healthy result. Do not print API error bodies or raw logs in CI.
The query returns only aggregate metrics. Configure platform log capture/redaction separately: custom
logging is allowlisted, but provider-managed invocation logs may capture headers or network metadata.
Keep security logs to the approved retention period (initial target: 14 days); restrict operator access.

## Initial thresholds

| Signal | Condition | Severity |
| --- | --- | --- |
| Gateway availability | At least 5 server errors and at least 5% in 15 min | Critical |
| Gateway latency | p95 >3 s with at least 20 requests | Warning |
| Verification outage | At least 3 CAPTCHA_UNAVAILABLE events | Critical |
| CAPTCHA rejections | >50% with at least 50 requests | Warning |
| Abuse attempts | At least 20 RATE_LIMITED outcomes | Warning |
| Current question | Count differs from 1 after 00:15 UTC | Critical |
| Finalization lag | Prior question remains live after 00:15 UTC | Critical |
| Scheduler | Missing/disabled/wrong schedule, failed latest run, or no success in 24h15m | Critical |
| Tomorrow's queue | No scheduled question | Warning |
| Kill switch | Disabled/missing | Critical |
| Telemetry | No events | Warning |
| Monitor itself | Query/auth/telemetry failure | Critical |

These are starting thresholds, not validated SLOs. Tune against staging/production baselines while
retaining minimum sample sizes. Voting closes at 00:00 UTC, when the finalizer is scheduled. The alert grace period does not extend
voting. Public question/result reads catch up a missed boundary before returning data; monitor and
investigate scheduler failures rather than relying on reads as the only operational trigger.

## Independent delivery and live evidence

An independent GET probe checks that the deployed gateway returns its expected 405 response without
creating installations or votes. This detects DNS/platform/function reachability problems, but does
not establish that the entire CAPTCHA-to-database path works; real-device canaries remain required.
GitHub schedules may be delayed, disabled after inactivity, or unavailable; they are not a paging SLA.
Configure an independent dead-man service with a 20-minute absence threshold and a primary/backup
delivery route. The workflow pings `OPS_HEARTBEAT_URL` only after a fully healthy run, so stopped or
failing monitoring triggers that route. Validate heartbeat delivery and intentional silence before
launch. Configure external paging and longer-lived dashboards/log drains when traffic warrants it;
track provider activation and evidence in the operations issue. Do not consider code present to mean
notifications are received. Move probes to an independent two-minute uptime service before promising
a tighter detection target; custom function logs alone cannot observe pre-execution failures.

Current references checked on 2026-10-17:

- [Supabase log queries and schema](https://supabase.com/docs/guides/observability/advanced-log-filtering)
- [Management logs API and read permission](https://supabase.com/docs/reference/api/v1-get-project-logs)
- [GitHub schedule limitations](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
