import { countGraphemes } from 'npm:unicode-segmenter@0.17.3/grapheme';
export { countGraphemes };
import { createClient } from 'npm:@supabase/supabase-js@2';

export const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});
export const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
export function clients() {
  const url=Deno.env.get('SUPABASE_URL'), anon=Deno.env.get('SUPABASE_ANON_KEY'), service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) throw new Error('Server unavailable.');
  const options={ auth: { persistSession: false, autoRefreshToken: false } };
  return { admin:createClient(url,service,options), auth:createClient(url,anon,options) };
}
export async function identity(request: Request) {
  const token=request.headers.get('Authorization')?.replace(/^Bearer /,'') ?? '';
  const { data,error }=await clients().auth.auth.getUser(token);
  if (error || !data.user || !data.user.email_confirmed_at) throw new Error('Sign in with a verified email.');
  let session: string;
  try { session=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id; }
  catch { throw new Error('Invalid session.'); }
  if (!/^[a-f0-9-]{36}$/.test(session ?? '')) throw new Error('Invalid session.');
  return { account:data.user.id,session };
}
export async function device(body: Record<string, unknown>) {
  const e=body.deviceEvidence as Record<string,unknown> | undefined;
  const pepper=Deno.env.get('DEVICE_FINGERPRINT_PEPPER');
  if (!pepper || pepper.length<32) throw new Error('Server unavailable.');
  if (typeof body.credential!=='string' || body.credential.length<32 || body.credential.length>200 || !e ||
    !['android','ios'].includes(String(e.platform)) || !['phone','tablet'].includes(String(e.deviceType)) ||
    typeof e.deviceIdentifier!=='string' || e.deviceIdentifier.length<8 || e.deviceIdentifier.length>200 ||
    e.isPhysicalDevice!==true || e.isRooted!==false) throw new Error('Physical device check failed.');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${e.platform}:${e.deviceIdentifier}`));
  return { credential:body.credential,deviceHash:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('') };
}
export async function verifyAction(body: Record<string,unknown>,session: string,purpose: string,target: unknown) {
  const secret=Deno.env.get('TURNSTILE_SECRET_KEY'),host=Deno.env.get('TURNSTILE_EXPECTED_HOSTNAME');
  if (!secret || !host || typeof body.captchaToken!=='string' || body.captchaToken.length<10 || body.captchaToken.length>2048 ||
    typeof body.requestId!=='string' || !/^[a-f0-9-]{36}$/.test(body.requestId)) return false;
  const binding=await hash(JSON.stringify([body.credential,session,purpose,target,body.requestId]));
  if (body.captchaBinding!==binding) return false;
  const form=new FormData(); form.set('secret',secret); form.set('response',body.captchaToken);
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
    method:'POST',body:form,signal:AbortSignal.timeout(5000)
  });
  if (!response.ok) return false;
  const result=await response.json(); const timestamp=Date.parse(result.challenge_ts);
  return result.success===true && result.action==='pulse-vote' && result.hostname===host && result.cdata===binding &&
    Number.isFinite(timestamp) && timestamp<=Date.now()+30_000 && Date.now()-timestamp<=300_000;
}
export async function payload(request: Request) {
  if (request.method!=='POST') throw new Error('Method not allowed.');
  const value=await request.text(); if (value.length>16384) throw new Error('Invalid request.');
  const body=JSON.parse(value);
  if (!body || typeof body!=='object' || Array.isArray(body)) throw new Error('Invalid request.');
  return body as Record<string,unknown>;
}
