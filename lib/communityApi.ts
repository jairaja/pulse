import { PulseApiError } from './pulseApi';
import { supabase, supabaseConfigurationError } from './supabase';

export type CommunityQuestion = {
  id: string; text: string; createdAt: string; upvoteCount: number; isOwn: boolean; upvotedToday: boolean;
};
export type BrewingAllowance = {
  serverTime: string; resetsAt: string; submittedQuestionId: string | null; upvotedQuestionId: string | null;
};
function client() {
  if (!supabase) throw new PulseApiError(supabaseConfigurationError ?? 'PULSE is not configured.', 'NOT_CONFIGURED');
  return supabase;
}
function row(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PulseApiError('Invalid community response.', 'INVALID_RESPONSE');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new PulseApiError('Invalid community response.', 'INVALID_RESPONSE');
  return value;
}
export type BrewingSort = 'most_upvoted' | 'newest' | 'oldest';
export type BrewingFilter = 'all' | 'mine' | 'others' | 'today';
export type CommunityRole = 'member' | 'admin' | 'superuser';
export type BrewingCursor = Record<string, unknown>;
export type CommunityPage = { items: CommunityQuestion[]; nextCursor: BrewingCursor | null };
export async function fetchCommunityQuestions({ sort = 'most_upvoted', filter = 'all', cursor = null }: {
  sort?: BrewingSort; filter?: BrewingFilter; cursor?: BrewingCursor | null;
} = {}): Promise<CommunityPage> {
  const { data, error } = await client().rpc('browse_brewing_questions', { p_limit: 20, p_sort: sort, p_filter: filter, p_cursor: cursor });
  if (error) throw new PulseApiError(error.message === 'Refresh the question list to continue.'
    ? error.message : 'Could not load community questions.', error.code, error.code !== '22023');
  const response = row(data);
  if (!Array.isArray(response.items) || !(response.next_cursor === null ||
    (typeof response.next_cursor === 'object' && response.next_cursor && !Array.isArray(response.next_cursor)))) {
    throw new PulseApiError('Invalid community response.', 'INVALID_RESPONSE');
  }
  const items: CommunityQuestion[] = response.items.map(value => {
    const r = row(value); const count = Number(r.upvote_count);
    if ((typeof r.upvote_count !== 'number' && typeof r.upvote_count !== 'string') ||
      !Number.isSafeInteger(count) || count < 0 || typeof r.is_own !== 'boolean' || typeof r.upvoted_today !== 'boolean' ||
      !Number.isFinite(Date.parse(text(r.created_at)))) {
      throw new PulseApiError('Invalid community response.', 'INVALID_RESPONSE');
    }
    return { id: text(r.id), text: text(r.question_text), createdAt: text(r.created_at),
      upvoteCount: count, isOwn: r.is_own, upvotedToday: r.upvoted_today };
  });
  return { items, nextCursor: response.next_cursor as BrewingCursor | null };
}
export async function fetchCommunityRole(): Promise<CommunityRole> {
  const { data, error } = await client().rpc('get_my_community_role');
  if (error || !['member','admin','superuser'].includes(data)) {
    throw new PulseApiError('Could not verify moderator access.', 'ROLE_UNAVAILABLE', true);
  }
  return data as CommunityRole;
}
export async function removeCommunityQuestion(attempt: { userId: string; id: string; reason: string; requestId: string }) {
  const { data, error } = await client().rpc('remove_brewing_question', { p_expected_user: attempt.userId,
    p_submission_id: attempt.id, p_reason: attempt.reason, p_request_id: attempt.requestId });
  if (error) {
    const safe = ['Moderator account mismatch.','Moderator access is required.','Enter a removal reason of 5 to 1000 characters.',
      'This question is no longer available in Brewing.','This removal request conflicts with an earlier request.','Refresh the question list to continue.'];
    throw new PulseApiError(safe.includes(error.message) ? error.message : 'Could not remove this question.', error.code);
  }
  const result = row(data);
  if (text(result.id) !== attempt.id || !Number.isFinite(Date.parse(text(result.removed_at)))) {
    throw new PulseApiError('Invalid community response.', 'INVALID_RESPONSE');
  }
  return attempt.id;
}
export async function fetchBrewingAllowance(): Promise<BrewingAllowance> {
  const { data, error } = await client().rpc('get_brewing_allowance');
  if (error) throw new PulseApiError('Could not check your daily allowance.', error.code, true);
  const r = row(data);
  if (!Number.isFinite(Date.parse(text(r.server_time))) || !Number.isFinite(Date.parse(text(r.resets_at)))) {
    throw new PulseApiError('Invalid community response.', 'INVALID_RESPONSE');
  }
  return { serverTime: text(r.server_time), resetsAt: text(r.resets_at),
    submittedQuestionId: r.submitted_question_id === null ? null : text(r.submitted_question_id),
    upvotedQuestionId: r.upvoted_question_id === null ? null : text(r.upvoted_question_id) };
}
const safeMessages = new Set([
  'Sign in to submit a question.', 'Sign in to upvote a question.', 'Questions must contain 5 to 280 characters.',
  'Verify your email before submitting or upvoting.',
  'You already submitted a question today. Try again at 00:00 UTC.',
  'You already used your upvote today. Try again at 00:00 UTC.',
  'You cannot upvote your own question.', 'This question is not available for upvotes.', 'Refresh the question list to continue.'
]);
export async function submitCommunityQuestion(question: string): Promise<string> {
  const { data, error } = await client().rpc('submit_brewing_question', { p_question_text: question });
  if (error) throw new PulseApiError(safeMessages.has(error.message) ? error.message : 'Could not submit your question.', error.code);
  return text(data);
}
export async function upvoteCommunityQuestion(id: string): Promise<void> {
  const { error } = await client().rpc('upvote_brewing_question', { p_submission_id: id });
  if (error) throw new PulseApiError(safeMessages.has(error.message) ? error.message : 'Could not upvote this question.', error.code);
}
