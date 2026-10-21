export function evaluateHealth(health, gateway) {
  const alerts = [];
  const add = (code, severity, message) => alerts.push({ code, severity, message });
  // Midnight UTC is the only daily boundary. This is an alert grace, not an extended voting window.
  const pastGrace = health.utc_hour > 0 || health.utc_minute >= 15;
  if (pastGrace && health.current_live_questions !== 1) add('LIVE_QUESTION', 'critical', 'Expected exactly one current live question.');
  if (pastGrace && health.overdue_questions > 0) add('FINALIZATION_LAG', 'critical', 'Prior questions remain live after finalization grace.');
  if (!Number.isFinite(health.open_community_questions) || health.open_community_questions < 1) add('QUESTION_QUEUE', 'warning', 'No open community question is available for the next midnight selection.');
  if (health.voting_enabled !== true) add('VOTING_DISABLED', 'critical', 'Voting kill switch is disabled or missing.');
  if (health.finalizer_jobs !== 1) add('SCHEDULER_CONFIG', 'critical', 'Finalization schedule is missing, disabled or incorrect.');
  if (health.finalizer_status === 'failed') add('SCHEDULER_FAILED', 'critical', 'The latest finalization run failed.');
  if (health.finalizer_age_seconds === null || health.finalizer_age_seconds > 87300) add('SCHEDULER_STALE', 'critical', 'No successful finalization within 24 hours 15 minutes.');
  if (gateway) {
    const n = Number(gateway.requests);
    if (!Number.isFinite(n) || n < 0 || !Number.isFinite(Number(gateway.p95_ms))) throw new Error('Invalid telemetry');
    if (n === 0) add('TELEMETRY_EMPTY', 'warning', 'No gateway events in the observation window; validate ingestion and traffic.');
    if (Number(gateway.server_errors) >= 5 && Number(gateway.server_errors) / n >= 0.05) add('GATEWAY_ERRORS', 'critical', 'Gateway server error ratio exceeds 5% with at least five errors.');
    if (n >= 20 && Number(gateway.p95_ms) > 3000) add('GATEWAY_LATENCY', 'warning', 'Gateway p95 exceeds three seconds.');
    if (Number(gateway.captcha_outages) >= 3) add('CAPTCHA_OUTAGE', 'critical', 'Verification provider/configuration failures detected.');
    if (n >= 50 && Number(gateway.captcha_rejections) / n > 0.5) add('CAPTCHA_REJECTIONS', 'warning', 'CAPTCHA rejection ratio exceeds 50%.');
    if (Number(gateway.rate_limited) >= 20) add('ABUSE_BURST', 'warning', 'Installation rate limiting detected at least 20 attempts.');
  }
  return alerts;
}
