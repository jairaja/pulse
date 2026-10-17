import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
const response = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers });

async function alert(message: string, details: Record<string, unknown>) {
  const webhook = Deno.env.get('SECURITY_ALERT_WEBHOOK_URL');
  if (!webhook) return;
  const parsed = new URL(webhook);
  if (parsed.protocol !== 'https:') throw new Error('Alert webhook must use HTTPS.');
  await fetch(webhook, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000),
    body: JSON.stringify({ source: 'pulse-operational-health', severity: 'critical', message, details })
  });
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  const expected = Deno.env.get('PULSE_MONITOR_TOKEN');
  if (!expected || request.headers.get('Authorization') !== `Bearer ${expected}`) return response({ error: 'Unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return response({ error: 'Unavailable', requestId }, 503);
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.rpc('get_operational_health');
  if (error || !Array.isArray(data) || !data[0]) {
    console.error(JSON.stringify({ event: 'health_check_failed', requestId, code: error?.code ?? 'INVALID_RESPONSE' }));
    await alert('PULSE health check failed', { requestId, code: error?.code ?? 'INVALID_RESPONSE' });
    return response({ ok: false, requestId }, 503);
  }
  const health = data[0] as Record<string, unknown>;
  const healthy = health.voting_enabled === true && Number(health.live_question_count) === 1 && Number(health.overdue_question_count) === 0;
  console.log(JSON.stringify({ event: 'operational_health', requestId, healthy, ...health }));
  if (!healthy) await alert('PULSE operational health is degraded', { requestId, ...health });
  return response({ ok: healthy, requestId, checkedAt: health.checked_at }, healthy ? 200 : 503);
});
