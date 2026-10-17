# Incident response and operational drills

The code supplies monitoring and a reversible database drill. A real incident response capability
requires named operators and demonstrated notification delivery. Track activation/evidence in GitHub;
do not close that work merely because this runbook exists.

## Ownership and severity

Before deployment, assign a primary incident commander and a backup in the private operations roster.
Set `OPS_ALERT_ASSIGNEE` to the primary's GitHub username and enable issue/failed-workflow notifications.
Critical incidents (vote integrity, secret exposure, gateway outage, lost finalization) require
acknowledgement within 15 minutes and backup escalation at 15 minutes. Warnings require review within
one working day. GitHub issues are a baseline alert channel; external paging and a dead-man check
are public-launch gates. Scheduled Actions can be delayed or disabled, so do not promise a five-minute SLO.

## First 15 minutes

1. Acknowledge the alert issue. Record UTC start, severity, commander, next update and affected service.
2. Determine whether votes could be wrong or merely unavailable. Preserve sanitized counters,
   deployment SHA, configuration versions, scheduler status and a timeline. Never paste credentials,
   tokens, phone/email data, raw network identifiers or individual ballot data into an issue.
3. For suspected integrity compromise, disable voting through an authorized SQL session:

   ```sql
   update private.runtime_controls
   set voting_enabled = false, updated_at = now() where singleton
   returning voting_enabled, updated_at;
   ```

4. Confirm the committed switch rejects an otherwise valid staging/synthetic gateway vote; confirm
   reading results still works. The database switch stops writes after CAPTCHA; during request floods
   also apply provider gateway/WAF blocking. Do not disable CAPTCHA to resolve its outage.
5. Escalate to backup and platform support if recovery is unclear. Publish only verified impact and
   the next update time. Follow the approved privacy/legal process if personal data may be affected.

## Recovery procedures

- **CAPTCHA outage or misconfiguration:** check hostname, action, sitekey environment, secret and
  challenge-signing secret. Test a fresh token on a production-signed device. Consumed tokens require
  a fresh challenge; never replay the same token or silently bypass enforcement.
- **Secret exposure:** disable voting if integrity is uncertain; rotate the compromised provider key,
  update managed secrets, redeploy and verify new credentials before revoking the old key where the
  provider supports overlap. Rotating the challenge secret expires outstanding challenges. Rotating
  `DEVICE_FINGERPRINT_PEPPER` changes device identity: requires a separate reviewed migration plan.
  For service-role/JWT exposure, follow Supabase's key/session revocation procedure; remove leaked
  credentials from access paths and investigate use. Record key version IDs only.
- **Scheduler failure:** inspect `cron.job` and `cron.job_run_details` privately. Check today's question
  exists. An authorized operator may run `select * from private.finalize_daily_pulse(now());` and replay
  once to check zero further changes. Never edit finalized snapshots to make monitoring green.
- **Bad release:** redeploy the last verified Edge Function/mobile build and compatible configuration.
  Do not blindly reverse migrations or restore an old database over accepted votes. A database restore
  needs an approved recovery point, reconciliation and a rehearsed restore into an isolated project.
- **Recovery:** validate correct challenge/accept/reject behavior, immutable receipts/results, scheduler,
  telemetry and notification delivery. Commander records evidence and explicitly authorizes re-enabling
  the switch using the same SQL with `true`. A green monitor alone does not authorize recovery.

## Exercises and evidence

Run `npm run ops:drill` on staging with `OPS_ENVIRONMENT=staging`, `OPS_STAGING_DATABASE_URL`, and
`OPS_STAGING_DB_HOST` from the independently approved roster. The runner checks the exact host,
uses short lock/query timeouts, tests kill-switch rejection and idempotent finalizer replay, and rolls
everything back. It emits `ops-drill-evidence.json`. It never proves a committed gateway shutdown.
The host guard prevents accidents; a staging label cannot cryptographically establish the environment.

Before public launch, then monthly and after material security changes, conduct an operator exercise:

| Exercise | Required evidence |
| --- | --- |
| Alert delivery and escalation | Inject a staging monitor failure; primary/backup acknowledgement timestamps; recovery signal |
| Committed kill switch | Staging gateway rejects votes while disabled; reads remain available; authorized recovery |
| Secret rotation | Version IDs, failed old credential, successful new verification, outstanding challenge expiry |
| Finalizer replay | Zero-vote/tie/delayed/concurrent cases, immutable snapshot comparison and UTC rollover soak |
| Release rollback and restore | Before/after SHA, compatibility checks, isolated restore time and accepted-vote reconciliation |
| Provider outage/accessibility | Failure remains closed; cancel/retry work; VoiceOver/TalkBack completion on real devices |

Create one drill issue per exercise with UTC times, participants, target recovery time, observed times,
sanitized evidence, shortcomings, owner and due date for each fix. Run staging exercises before any
production game day. After an incident, publish a blameless review within two working days and keep
corrective actions open until their verification passes. Store detailed security evidence privately;
the public issue should link only to authorized, sanitized material.
