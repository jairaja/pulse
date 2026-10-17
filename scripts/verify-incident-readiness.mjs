import { readFile } from 'node:fs/promises';

const [gateway, monitor, runbook, config] = await Promise.all([
  readFile('supabase/functions/vote/index.ts', 'utf8'),
  readFile('supabase/functions/operational-health/index.ts', 'utf8'),
  readFile('docs/incident-response.md', 'utf8'),
  readFile('supabase/config.toml', 'utf8')
]);
for (const required of ['vote_rejected', 'vote_processed', 'TURNSTILE_EXPECTED_HOSTNAME', 'captchaBinding']) {
  if (!gateway.includes(required)) throw new Error(`Vote gateway readiness missing: ${required}`);
}
for (const required of ['PULSE_MONITOR_TOKEN', 'SECURITY_ALERT_WEBHOOK_URL', 'get_operational_health']) {
  if (!monitor.includes(required)) throw new Error(`Operational monitor missing: ${required}`);
}
for (const required of ['Kill switch', 'Secret compromise', 'CAPTCHA outage', 'Alert delivery', 'Finalizer replay', 'Rollback']) {
  if (!runbook.includes(required)) throw new Error(`Incident drill runbook missing: ${required}`);
}
if (!config.includes('[functions.operational-health]') || !config.includes('[functions.turnstile-challenge]')) {
  throw new Error('Required Edge Functions are missing from Supabase config.');
}
console.log('Operational readiness guard passed: telemetry, health alerting, and drill runbook are present.');
