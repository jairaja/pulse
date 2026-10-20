import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchBrewingAllowance, fetchCommunityQuestions, submitCommunityQuestion, upvoteCommunityQuestion } from './communityApi';

export function useCommunityBrewing(userId?: string) {
  const queryClient = useQueryClient();
  const key = ['pulse', 'community', userId ?? 'guest'];
  const feed = useInfiniteQuery({
    queryKey: [...key, 'feed'], queryFn: ({ pageParam }) => fetchCommunityQuestions(pageParam),
    initialPageParam: null as string | null, getNextPageParam: page => page.nextCursor,
    refetchInterval: 30_000, meta: { persist: false }
  });
  const allowance = useQuery({
    queryKey: [...key, 'allowance'], queryFn: fetchBrewingAllowance, enabled: Boolean(userId),
    refetchInterval: 30_000, meta: { persist: false }
  });
  useEffect(() => {
    if (!allowance.data) return;
    const elapsed = Math.max(0, Date.now() - allowance.dataUpdatedAt);
    const remaining = Date.parse(allowance.data.resetsAt) - Date.parse(allowance.data.serverTime) - elapsed;
    const timer = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ['pulse', 'community', userId ?? 'guest'] });
    }, Math.max(1000, remaining));
    return () => clearTimeout(timer);
  }, [allowance.data, allowance.dataUpdatedAt, queryClient, userId]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const submit = useMutation({ mutationFn: submitCommunityQuestion, onSuccess: refresh, retry: false, networkMode: 'always' });
  const upvote = useMutation({ mutationFn: upvoteCommunityQuestion, onSuccess: refresh, retry: false, networkMode: 'always' });
  return { feed, allowance, submit, upvote, refresh };
}
