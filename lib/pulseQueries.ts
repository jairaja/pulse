import {
  useInfiniteQuery,
  onlineManager,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchBrewingQuestion, fetchFinalizedResults, fetchTodayQuestion, fetchVoteReceipt, PulseApiError, submitVote } from './pulseApi';
import type { VoteAttempt } from './captcha';
import { getStoredVoteReceipt } from './voteReceipts';

export const pulseKeys = {
  all: ['pulse'] as const,
  results: (languageCode: string) => ['pulse', 'results', languageCode] as const,
  today: (languageCode: string) => ['pulse', 'today', languageCode] as const,
  brewing: (languageCode: string) => ['pulse', 'brewing', languageCode] as const,
  voteReceipt: (questionId: string) => ['pulse', 'vote-receipt', questionId] as const
};

export function useBrewingQuestion(languageCode = 'en') {
  return useQuery({
    queryKey: pulseKeys.brewing(languageCode),
    queryFn: () => fetchBrewingQuestion(languageCode),
    refetchInterval: 60_000,
    meta: { persist: false }
  });
}

export function useTodayQuestion(languageCode = 'en') {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: pulseKeys.today(languageCode),
    queryFn: () => fetchTodayQuestion(languageCode),
    meta: { persist: true }
  });

  useEffect(() => {
    if (!query.data) return;
    const serverElapsed = Date.now() - query.dataUpdatedAt;
    const estimatedServerNow = Date.parse(query.data.serverTime) + Math.max(0, serverElapsed);
    const untilClose = Date.parse(query.data.votingClosesAt) - estimatedServerNow;
    const timeout = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: pulseKeys.today(languageCode) });
    }, Math.max(1000, untilClose + 1000));
    return () => clearTimeout(timeout);
  }, [languageCode, query.data, query.dataUpdatedAt, queryClient]);

  return query;
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
    onSuccess: (receipt) => {
      queryClient.setQueryData(pulseKeys.voteReceipt(receipt.questionId), receipt);
    },
    networkMode: 'always',
    retry: false
  });
}
