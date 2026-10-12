import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async () => {
  // TODO: pull today question text then trigger FCM topic: pulse_daily.
  return new Response(
    JSON.stringify({
      message: "The world is voting now. Today's question is live."
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
