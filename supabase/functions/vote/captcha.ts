// Stateless signed challenge; single-use enforcement comes from Turnstile Siteverify.
// This is not a replacement for a consumed attestation nonce or platform attestation.
const encoder = new TextEncoder();
export type VoteBinding = {
  credential: string; questionId: string; choice: string; idempotencyKey: string;
  deviceFingerprintHash: string; accountId: string | null; sessionHash: string;
};
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
async function key(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function bindingHash(binding: VoteBinding) {
  // Fixed array order avoids ambiguous concatenation and object key ordering.
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify([
    binding.credential, binding.questionId, binding.choice, binding.idempotencyKey,
    binding.deviceFingerprintHash, binding.accountId, binding.sessionHash
  ]))));
}
export async function issueChallenge(binding: VoteBinding, secret: string, now = Date.now()) {
  const hash = await bindingHash(binding);
  const expiresAt = now + 120_000;
  const message = `${hash}.${expiresAt}.${crypto.randomUUID()}`;
  const signature = hex(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(message)));
  const challenge = `${message}.${signature}`;
  return { challenge, cdata: await challengeData(challenge), expiresAt };
}
export async function challengeData(challenge: string) {
  // Include the server nonce and expiry, so a token solved for another issuance cannot be substituted.
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(challenge.split('.').slice(0, 3).join('.'))));
}
export async function verifyChallenge(challenge: unknown, binding: VoteBinding, secret: string, now = Date.now()) {
  if (typeof challenge !== 'string' || challenge.length > 300) return false;
  const [hash, expiry, nonce, signature, extra] = challenge.split('.');
  if (extra !== undefined || !/^[a-f0-9]{64}$/.test(signature ?? '') ||
      !/^[a-f0-9-]{36}$/.test(nonce ?? '') || !/^\d{13}$/.test(expiry ?? '')) return false;
  const expiresAt = Number(expiry);
  if (expiresAt <= now || expiresAt > now + 120_000 || hash !== await bindingHash(binding)) return false;
  return crypto.subtle.verify('HMAC', await key(secret),
    Uint8Array.from(signature.match(/../g)!, b => parseInt(b, 16)),
    encoder.encode(`${hash}.${expiry}.${nonce}`));
}
export async function verifyTurnstile(
  token: unknown, cdata: string, secret: string, hostnames: string[],
  fetcher: typeof fetch = fetch, now = Date.now()
) {
  if (typeof token !== 'string' || token.length < 10 || token.length > 2048) return false;
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  // Do not trust client-supplied IP forwarding headers outside a verified proxy boundary.
  const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: form, signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error('CAPTCHA_PROVIDER_UNAVAILABLE');
  const result = await response.json() as Record<string, unknown>;
  const timestamp = typeof result.challenge_ts === 'string' ? Date.parse(result.challenge_ts) : NaN;
  return result.success === true && result.action === 'pulse-vote' && result.cdata === cdata &&
    typeof result.hostname === 'string' && hostnames.includes(result.hostname) &&
    Number.isFinite(timestamp) && timestamp <= now + 30_000 && now - timestamp <= 300_000;
}
