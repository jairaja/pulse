import type { useRouter } from 'expo-router';
type Router = ReturnType<typeof useRouter>;
import { supabase } from './supabase';
export type PublicQuestion = { id: string; text: string; destination: 'today' | 'brewing' | 'past-results'; created_at?: string;
  upvote_count?: number; is_own?: boolean; asked_on?: string; result?: 'YES' | 'NO' | 'TIE'; yes_count?: number; no_count?: number; total_votes?: number; finalized_at?: string };
export async function resolvePublicQuestion(kind: string, id: string, signal?: AbortSignal): Promise<PublicQuestion | null> {
  if (!supabase) throw new Error('PULSE is not configured.');
  let query = supabase.rpc('resolve_public_question', { p_id: id, p_kind: kind });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw new Error('This question could not be loaded.');
  return data;
}
export function openQuestion(router: Router, kind: 'question' | 'submission', id: string) {
  router.push({ pathname: '/q/[kind]/[id]', params: { kind, id } });
}
export async function publicQuestionSummaries(ids: string[], signal: AbortSignal): Promise<PublicQuestion[]> {
  if (!ids.length) return [];
  if (!supabase) throw new Error('PULSE is not configured.');
  const { data, error } = await supabase.rpc('public_question_summaries', { p_ids: ids }).abortSignal(signal);
  if (error || !Array.isArray(data)) throw new Error('Your history could not be loaded.');
  return data;
}
