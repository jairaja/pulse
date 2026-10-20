# Production operations boundary

The repository now supplies enforceable application primitives: gateway-only privileged voting, a
kill switch, immutable/idempotent database writes, atomic daily finalization, and transactional
account-history claims. These are necessary but not sufficient for a global launch.

## Required deployment configuration

1. Deploy the `vote` Edge Function and keep `SUPABASE_SERVICE_ROLE_KEY` only in Supabase-managed
   function secrets. Never place it in Expo environment variables.
2. Apply migrations in timestamp order. Confirm `pulse-daily-finalization` exists in `cron.job`, uses
   `0 0 * * *`, and has successful staging runs across UTC rollover.
3. Monitor Edge Function latency/error/status distribution, rejected vote status distribution,
   finalization lag, live-question cardinality, and scheduler failures. Do not log credentials,
   bearer tokens, email, auth UUIDs, or raw IP addresses.
4. Drill the voting kill switch, secret rotation, scheduler replay, rollback, and incident escalation.
5. Complete T14's platform attestation, abuse controls, independent review, load test, and privacy
   sign-off before a public global launch.

## Turnstile deployment

1. Create separate managed Turnstile widgets for development, staging, and production.
2. Allow only the deployed `turnstile-challenge` function hostname; never allow arbitrary hostnames in production.
3. Set `TURNSTILE_SITE_KEY` on `turnstile-challenge`. Set `TURNSTILE_SECRET_KEY` and
   `TURNSTILE_EXPECTED_HOSTNAME` on `vote`. The site key is public; the secret is server-only.
4. Deploy both functions, set `EXPO_PUBLIC_TURNSTILE_CHALLENGE_URL` to the HTTPS challenge endpoint,
   rebuild the native app, and test success, cancellation, expiry, replay, wrong action, wrong cData,
   wrong hostname, provider timeout, and accessibility on physical iOS and Android devices.
5. The gateway fails closed when Turnstile is unconfigured or unavailable. Never add a client-side bypass.

## Monitoring and alerts

Deploy `operational-health`, set independent random `PULSE_MONITOR_TOKEN` and an allowlisted HTTPS
`SECURITY_ALERT_WEBHOOK_URL`, and have an external uptime service call it with
`Authorization: Bearer <token>` at least once per minute. Alert on non-2xx, absence of checks, function
errors, elevated `vote_rejected`/`vote_failed`, latency, and finalization lag. Structured function logs
contain request IDs and aggregate reason/status only; they must never gain raw credentials, tokens,
email, auth IDs, fingerprints, or IP addresses. Configure a Supabase log drain to the approved monitoring
provider and define retention and access controls there. An in-project cron alone is not sufficient: it
cannot reliably report a whole-project outage.

Run `npm run verify:operations` in CI. Follow [`incident-response.md`](./incident-response.md) and retain
evidence for every quarterly drill; repository checks prove that controls exist, not that alerts reach a
human or that a drill passed.

The intended launch rule is one **eligible physical device** per question, not one human. The current
installation credential alone does not meet that rule across reinstall. Follow
[`device-integrity-policy.md`](./device-integrity-policy.md), and fail closed for voting when a required
platform verdict is missing or invalid.

## Remaining deployment-work issue coverage

- **T14:** platform attestation, gateway/network controls, monitoring, alerts, incident response,
  rollback, load/penetration tests, independent review, and privacy sign-off.
- **T15:** staging soak tests and operational validation of the 00:00 UTC finalizer.
- **T16:** account-history sync UX, conflict recovery, export, deletion, and retention.
- **R03:** global youth-safety and country-by-country legal review.
- **T17:** physical-device attestation, reinstall resistance, and CAPTCHA step-up rollout.
- **T18:** native Turnstile challenge UX, token binding, accessibility, and staged enforcement.

These issues are launch gates. Repository code cannot complete store enrollment, beta access,
provider dashboards, independent review, or staging soak evidence.

## Emergency controls

Disable voting with a privileged SQL change:

```sql
update private.runtime_controls
set voting_enabled = false, updated_at = now()
where singleton;
```

Re-enable only after the incident owner documents cause, containment, data impact, and validation.
The finalizer may be replayed by an authorized operator because it is transaction-locked and
idempotent; never edit result snapshots directly.
