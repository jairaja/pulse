// Supabase Edge Function: promotes top voted approved submission to tomorrow's question.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async () => {
  // TODO: SQL transaction selecting max(submission_votes) among approved entries.
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
