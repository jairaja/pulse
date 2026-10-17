import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { challengeData, issueChallenge, verifyChallenge, verifyTurnstile } from './captcha.ts';

const jsonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

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

async function handle(request: Request) {
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const fingerprintPepper = Deno.env.get('DEVICE_FINGERPRINT_PEPPER');
  const captchaSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
  const challengeSecret = Deno.env.get('CAPTCHA_CHALLENGE_SECRET');
  const hostnames = (Deno.env.get('TURNSTILE_HOSTNAMES') ?? '').split(',').map(h => h.trim()).filter(Boolean);
  // Required by default. Disabling is an explicit local/staging policy, never inferred from missing secrets.
  const captchaMode = Deno.env.get('CAPTCHA_MODE') ?? 'required';
  if (!['required', 'disabled'].includes(captchaMode) ||
      (captchaMode === 'required' && (!captchaSecret || !challengeSecret || challengeSecret.length < 32 || !hostnames.length))) {
    return respond({ error: 'Verification is temporarily unavailable.', code: 'CAPTCHA_UNAVAILABLE' }, 503);
  }
  if (!url || !publishableKey || !secretKey || !fingerprintPepper || fingerprintPepper.length < 32) {
    return respond({ error: 'Server unavailable.' }, 503);
  }

  let payload: {
    credential?: unknown;
    captchaToken?: unknown;
    captchaChallenge?: unknown;
    operation?: unknown;
    deviceEvidence?: DeviceEvidence;
    questionId?: unknown;
    choice?: unknown;
    idempotencyKey?: unknown;
  };
  try {
    // Bound streamed input too; Content-Length alone is client-controlled.
    const reader = request.body?.getReader();
    if (!reader) return respond({ error: 'Invalid JSON.' }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) { await reader.cancel(); return respond({ error: 'Request too large.' }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    payload = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid JSON');
  } catch { return respond({ error: 'Invalid JSON.' }, 400); }
  if (
    typeof payload.credential !== 'string' ||
    payload.credential.length < 32 || payload.credential.length > 200 ||
    typeof payload.questionId !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(payload.questionId) ||
    typeof payload.idempotencyKey !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(payload.idempotencyKey) ||
    (payload.operation !== undefined && payload.operation !== 'challenge') ||
    (payload.choice !== 'YES' && payload.choice !== 'NO')
  ) return respond({ error: 'Invalid vote request.' }, 400);

  const deviceFingerprintHash = await fingerprintDevice(payload.deviceEvidence ?? {}, fingerprintPepper);
  if (!deviceFingerprintHash) return respond({ error: 'Physical device check failed.' }, 403);

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

  const binding = { credential: payload.credential, questionId: payload.questionId,
    choice: payload.choice, idempotencyKey: payload.idempotencyKey, deviceFingerprintHash, accountId,
    sessionHash: accountId ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
      new TextEncoder().encode(bearer!))), b => b.toString(16).padStart(2, '0')).join('') : 'anonymous' };
  if (payload.operation === 'challenge') {
    if (captchaMode === 'disabled') return respond({ required: false });
    return respond({ required: true, ...await issueChallenge(binding, challengeSecret!) });
  }
  if (captchaMode === 'required') {
    if (!await verifyChallenge(payload.captchaChallenge, binding, challengeSecret!)) {
      return respond({ error: 'Verification expired. Please try again.', code: 'CAPTCHA_REQUIRED' }, 403);
    }
    try {
      if (!await verifyTurnstile(payload.captchaToken, await challengeData(payload.captchaChallenge as string), captchaSecret!, hostnames)) {
        return respond({ error: 'Human verification failed. Please try again.', code: 'CAPTCHA_REQUIRED' }, 403);
      }
    } catch {
      return respond({ error: 'Verification is temporarily unavailable. Please try again later.', code: 'CAPTCHA_UNAVAILABLE' }, 503);
    }
  }

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const registration = await admin.rpc('register_installation', {
    p_credential: payload.credential,
    p_account_id: accountId,
    p_device_fingerprint_hash: deviceFingerprintHash
  });
  if (registration.error) return respond({ error: 'Installation rejected.' }, 403);

  const { data, error } = await admin.rpc('submit_vote', {
    p_credential: payload.credential,
    p_account_id: accountId,
    p_question_id: payload.questionId,
    p_choice: payload.choice,
    p_idempotency_key: payload.idempotencyKey
  });
  if (error) return respond({ error: 'Vote could not be processed.', code: 'DATABASE_UNAVAILABLE' }, 503);
  return respond(Array.isArray(data) ? data[0] : data);
}

Deno.serve(async (request) => {
  const started = performance.now();
  let response: Response;
  try { response = await handle(request); }
  catch { response = respond({ error: 'Server unavailable.', code: 'INTERNAL_ERROR' }, 503); }
  const body = await response.clone().json();
  // Explicit allowlist: never serialize requests, exceptions, IPs, identities, choices or tokens.
  console.log(JSON.stringify({ event: 'pulse_gateway', version: 1,
    request_id: crypto.randomUUID(), status: response.status,
    outcome: body.code ?? body.status ?? (body.required !== undefined ? 'CHALLENGE' : 'REJECTED'),
    duration_ms: Math.round(performance.now() - started), timestamp: new Date().toISOString() }));
  return response;
});
