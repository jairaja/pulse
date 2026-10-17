import { createClient } from 'npm:@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });
const audit = (event: string, requestId: string, details: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ event, requestId, timestamp: new Date().toISOString(), ...details }));

type DeviceEvidence = {
  platform?: unknown;
  deviceIdentifier?: unknown;
  deviceType?: unknown;
  isPhysicalDevice?: unknown;
  isRooted?: unknown;
};

async function fingerprintDevice(evidence: DeviceEvidence, pepper: string) {
  if (
    (evidence.platform !== 'android' && evidence.platform !== 'ios') ||
    typeof evidence.deviceIdentifier !== 'string' ||
    evidence.deviceIdentifier.length < 8 ||
    evidence.deviceIdentifier.length > 200 ||
    (evidence.deviceType !== 'phone' && evidence.deviceType !== 'tablet') ||
    evidence.isPhysicalDevice !== true ||
    evidence.isRooted !== false
  ) return null;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC', key, encoder.encode(`${evidence.platform}:${evidence.deviceIdentifier}`)
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyTurnstile(request: Request, token: unknown, expectedCdata: unknown) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  const expectedHostname = Deno.env.get('TURNSTILE_EXPECTED_HOSTNAME');
  if (!secret || !expectedHostname) return false;
  if (typeof token !== 'string' || token.length < 10 || token.length > 2048) return false;
  if (typeof expectedCdata !== 'string' || !/^[a-f0-9]{64}$/.test(expectedCdata)) return false;

  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  const remoteIp = request.headers.get('cf-connecting-ip');
  if (remoteIp) form.set('remoteip', remoteIp);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: form, signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean; action?: string; cdata?: string; hostname?: string };
  return result.success === true && result.action === 'pulse-vote' &&
    result.hostname === expectedHostname && result.cdata === expectedCdata;
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const fingerprintPepper = Deno.env.get('DEVICE_FINGERPRINT_PEPPER');
  if (!url || !publishableKey || !secretKey || !fingerprintPepper || fingerprintPepper.length < 32) {
    audit('vote_gateway_unavailable', requestId);
    return respond({ error: 'Server unavailable.' }, 503);
  }

  let payload: {
    credential?: unknown;
    captchaToken?: unknown;
    captchaBinding?: unknown;
    deviceEvidence?: DeviceEvidence;
    questionId?: unknown;
    choice?: unknown;
    idempotencyKey?: unknown;
  };
  try { payload = await request.json(); } catch { return respond({ error: 'Invalid JSON.' }, 400); }
  if (
    typeof payload.credential !== 'string' ||
    typeof payload.questionId !== 'string' ||
    typeof payload.idempotencyKey !== 'string' ||
    (payload.choice !== 'YES' && payload.choice !== 'NO')
  ) return respond({ error: 'Invalid vote request.' }, 400);

  const deviceFingerprintHash = await fingerprintDevice(payload.deviceEvidence ?? {}, fingerprintPepper);
  if (!deviceFingerprintHash) {
    audit('vote_rejected', requestId, { reason: 'device_evidence' });
    return respond({ error: 'Physical device check failed.', requestId }, 403);
  }
  const expectedBindingBytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${payload.credential}:${payload.questionId}:${payload.choice}:${payload.idempotencyKey}`)
  );
  const expectedBinding = Array.from(new Uint8Array(expectedBindingBytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (payload.captchaBinding !== expectedBinding || !(await verifyTurnstile(request, payload.captchaToken, expectedBinding))) {
    audit('vote_rejected', requestId, { reason: 'captcha' });
    return respond({ error: 'Human verification failed.', code: 'CAPTCHA_REQUIRED', requestId }, 403);
  }

  // Derive account identity from a verified bearer token; never accept an account id from the body.
  let accountId: string | null = null;
  const authorization = request.headers.get('Authorization');
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (bearer?.split('.').length === 3) {
    const authClient = createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data, error } = await authClient.auth.getUser(bearer);
    if (error || !data.user) return respond({ error: 'Invalid session.' }, 401);
    accountId = data.user.id;
  }

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const registration = await admin.rpc('register_installation', {
    p_credential: payload.credential,
    p_account_id: accountId,
    p_device_fingerprint_hash: deviceFingerprintHash
  });
  if (registration.error) {
    audit('vote_rejected', requestId, { reason: 'installation', code: registration.error.code });
    return respond({ error: 'Installation rejected.', requestId }, 403);
  }

  const { data, error } = await admin.rpc('submit_vote', {
    p_credential: payload.credential,
    p_account_id: accountId,
    p_question_id: payload.questionId,
    p_choice: payload.choice,
    p_idempotency_key: payload.idempotencyKey
  });
  if (error) {
    audit('vote_failed', requestId, { code: error.code });
    return respond({ error: 'Vote could not be processed.', requestId }, 400);
  }
  const result = Array.isArray(data) ? data[0] : data;
  audit('vote_processed', requestId, { status: result?.status ?? 'UNKNOWN' });
  return respond(result);
});
