import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

serve(async () => {
  // TODO: fetch devices that allow notifications and today's question.
  // TODO: call Expo push service / FCM provider and send:
  // "The world is voting now. Today's question is live."
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' }
  });
});
