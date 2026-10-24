import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { fetchBrewingAllowance, fetchCommunityQuestions, fetchCommunityRole, removeCommunityQuestion, submitCommunityQuestion, upvoteCommunityQuestion, type BrewingCursor, type BrewingSort, type BrewingFilter, type CommunityPage } from './communityApi';

export function useCommunityBrewing(userId?: string, sort: BrewingSort = 'most_upvoted', filter: BrewingFilter = 'all') {
  const queryClient = useQueryClient();
  const key = ['pulse', 'community', userId ?? 'guest'];
  const feed = useInfiniteQuery({
    queryKey: [...key, 'feed', sort, filter], queryFn: ({ pageParam }) => fetchCommunityQuestions({ sort, filter, cursor: pageParam }),
    initialPageParam: null as BrewingCursor | null, getNextPageParam: page => page.nextCursor ?? undefined,
    refetchInterval: 30_000, meta: { persist: false }
  });
  const role = useQuery({ queryKey: [...key, 'role'], queryFn: fetchCommunityRole, enabled: Boolean(userId), refetchInterval: 30_000, meta: { persist: false } });
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
  const refresh = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['pulse', 'community'] }), queryClient.invalidateQueries({ queryKey: ['pulse', 'my-activity'] })]);
  };
  const submit = useMutation({ mutationFn: submitCommunityQuestion, onSuccess: refresh, retry: false, networkMode: 'always' });
  const upvote = useMutation({ mutationFn: upvoteCommunityQuestion, onSuccess: refresh, onError: refresh, retry: false, networkMode: 'always' });
  const remove = useMutation({ mutationFn: removeCommunityQuestion, retry: false, networkMode: 'always',
    onSuccess: async id => {
      queryClient.setQueriesData<InfiniteData<CommunityPage>>({ queryKey: ['pulse', 'community'], predicate: query => query.queryKey[3] === 'feed' }, old => {
        if (!old || typeof old !== 'object' || !('pages' in old)) return old;
        return { ...old, pages: old.pages.map(page => ({ ...page, items: page.items.filter(item => item.id !== id) })) };
      });
      await refresh();
    }, onError: () => { void refresh(); void queryClient.invalidateQueries({ queryKey: [...key, 'role'] }); }
  });
  return { feed, allowance, role, submit, upvote, remove, refresh };

}
