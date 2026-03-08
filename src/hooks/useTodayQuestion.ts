import { useQuery } from '@tanstack/react-query';
import { fetchTodayQuestion } from '@/api/pulseApi';
import { useIdentityStore } from '@/store/useIdentityStore';

export function useTodayQuestion() {
  const language = useIdentityStore((s) => s.language);
  return useQuery({
    queryKey: ['today-question', language],
    queryFn: () => fetchTodayQuestion(language),
    staleTime: 30_000,
  });
}
