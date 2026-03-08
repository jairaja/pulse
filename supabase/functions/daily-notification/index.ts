// Supabase Edge Function: trigger FCM push at 12:00 GMT via pg_cron + HTTP invoke.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async () => {
  // TODO: fetch today question and send via Firebase Admin API.
  return new Response(JSON.stringify({ ok: true, message: "The world is voting now. Today's question is live." }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
