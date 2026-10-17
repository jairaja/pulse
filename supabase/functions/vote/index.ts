import { createClient } from 'npm:@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publishableKey || !secretKey) return respond({ error: 'Server unavailable.' }, 503);

  let payload: { credential?: unknown; questionId?: unknown; choice?: unknown; idempotencyKey?: unknown };
  try { payload = await request.json(); } catch { return respond({ error: 'Invalid JSON.' }, 400); }
  if (
    typeof payload.credential !== 'string' ||
    typeof payload.questionId !== 'string' ||
    typeof payload.idempotencyKey !== 'string' ||
    (payload.choice !== 'YES' && payload.choice !== 'NO')
  ) return respond({ error: 'Invalid vote request.' }, 400);

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
    p_account_id: accountId
  });
  if (registration.error) return respond({ error: 'Installation rejected.' }, 403);

  const { data, error } = await admin.rpc('submit_vote', {
    p_credential: payload.credential,
    p_account_id: accountId,
    p_question_id: payload.questionId,
    p_choice: payload.choice,
    p_idempotency_key: payload.idempotencyKey
  });
  if (error) return respond({ error: 'Vote could not be processed.' }, 400);
  return respond(Array.isArray(data) ? data[0] : data);
});
