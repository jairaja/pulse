import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { AppText as Text, useI18n } from '../../../lib/i18n';
import { resolvePublicQuestion } from '../../../lib/publicQuestions';
import { useAppTheme } from '../../../lib/theme';
export default function QuestionLink() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>(); const router = useRouter();
  const { t } = useI18n(); const { colors } = useAppTheme();
  const valid = ['submission', 'question'].includes(kind) && /^[a-f0-9-]{36}$/i.test(id ?? '');
  const question = useQuery({ queryKey: ['pulse', 'public-question', kind, id], enabled: valid,
    queryFn: ({ signal }) => resolvePublicQuestion(kind, id, signal), staleTime: 0, meta: { persist: false } });
  useEffect(() => {
    if (!question.data) return;
    const route = question.data.destination === 'today' ? '/' : question.data.destination === 'brewing' ? '/brewing-questions' : '/past-results';
    router.replace({ pathname: route, params: { highlight: question.data.id } });
  }, [question.data, router]);
  return <View style={{ flex: 1, backgroundColor: colors.canvas, justifyContent: 'center', padding: 24, gap: 20 }}>
    {valid && question.isPending ? <ActivityIndicator /> : <>
      <Text style={{ color: colors.ink }}>{t(question.isError ? 'This question could not be loaded.' : 'This question is no longer available.')}</Text>
      {question.isError ? <Pressable accessibilityRole="button" onPress={() => void question.refetch()}><Text style={{ color: colors.accent }}>{t('Retry')}</Text></Pressable> : null}
      <Pressable accessibilityRole="button" onPress={() => router.replace('/brewing-questions')}><Text style={{ color: colors.accent }}>{t('Browse Brewing Questions')}</Text></Pressable>
    </>}
  </View>;
}
