import {
  useInfiniteQuery,
  onlineManager,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';

import { localGeneration } from './localReset';
import { fetchFinalizedResults, fetchTodayQuestion, fetchVoteReceipt, PulseApiError, submitVote } from './pulseApi';
import type { VoteAttempt } from './captcha';
import { getStoredVoteReceipt } from './voteReceipts';

export const pulseKeys = {
  all: ['pulse'] as const,
  results: (languageCode: string) => ['pulse', 'results', languageCode] as const,
  today: (languageCode: string) => ['pulse', 'today', languageCode] as const,
  voteReceipt: (questionId: string) => ['pulse', 'vote-receipt', questionId] as const
};

export function useTodayQuestion(languageCode = 'en') {
  return useQuery({
    queryKey: pulseKeys.today(languageCode),
    queryFn: () => fetchTodayQuestion(languageCode),
    refetchInterval: 30_000,
    meta: { persist: true }
  });
}

export function useFinalizedResults(languageCode = 'en') {
  return useInfiniteQuery({
    queryKey: pulseKeys.results(languageCode),
    queryFn: ({ pageParam }) =>
      fetchFinalizedResults({ cursor: pageParam, languageCode, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    meta: { persist: true }
  });
}

export function useVoteReceipt(questionId: string | undefined) {
  return useQuery({
    queryKey: pulseKeys.voteReceipt(questionId ?? 'none'),
    queryFn: async () => {
      const local = await getStoredVoteReceipt(questionId!);
      if (local) return local;
      if (!onlineManager.isOnline()) {
        throw new PulseApiError('Connect to verify whether this device already voted.', 'VOTE_STATUS_UNAVAILABLE', true);
      }
      return fetchVoteReceipt(questionId!);
    },
    enabled: Boolean(questionId),
    staleTime: 60_000,
    networkMode: 'always',
    gcTime: Number.POSITIVE_INFINITY,
    meta: { persist: false }
  });
}

export function useSubmitVote(questionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attempt: VoteAttempt) => {
      if (!questionId) throw new Error('There is no open question.');
      return submitVote(attempt);
    },
    onMutate: () => localGeneration(),
    onSuccess: (receipt, _attempt, generation) => {
      if (generation !== localGeneration()) return;
      queryClient.setQueryData(pulseKeys.voteReceipt(receipt.questionId), receipt);
      void queryClient.invalidateQueries({ queryKey: ['pulse', 'guest-history'] });
      void queryClient.invalidateQueries({ queryKey: ['pulse', 'my-activity'] });
    },
    networkMode: 'always',
    retry: false
  });
}
