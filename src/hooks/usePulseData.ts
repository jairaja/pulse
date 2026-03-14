import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchHeatMap, fetchResults, fetchTodayQuestion, submitPrediction, submitVote } from '@/api/pulseApi';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';

export function useTodayQuestion() {
  const country = useSettingsStore((state) => state.country);
  return useQuery({
    queryKey: ['question', 'today', country],
    queryFn: () => fetchTodayQuestion(country)
  });
}

export function useSubmitPrediction(questionId: string) {
  const deviceId = useSessionStore((state) => state.deviceId);
  const setPrediction = useSessionStore((state) => state.setPrediction);
  return useMutation({
    mutationFn: (prediction: 'YES' | 'NO') => submitPrediction(questionId, prediction, deviceId),
    onSuccess: (_, prediction) => setPrediction(prediction)
  });
}

export function useSubmitVote(questionId: string) {
  const deviceId = useSessionStore((state) => state.deviceId);
  const country = useSettingsStore((state) => state.country);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vote: 'YES' | 'NO') => submitVote(questionId, vote, deviceId, country),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['results', questionId] });
      void queryClient.invalidateQueries({ queryKey: ['heatmap', questionId] });
    }
  });
}

export function useResults(questionId: string) {
  const country = useSettingsStore((state) => state.country);
  const deviceId = useSessionStore((state) => state.deviceId);
  return useQuery({
    queryKey: ['results', questionId, country, deviceId],
    queryFn: () => fetchResults(questionId, country, deviceId),
    enabled: Boolean(questionId && deviceId),
    refetchInterval: 5000
  });
}

export function useHeatMap(questionId: string) {
  return useQuery({
    queryKey: ['heatmap', questionId],
    queryFn: () => fetchHeatMap(questionId),
    enabled: Boolean(questionId),
    refetchInterval: 10000
  });
}
