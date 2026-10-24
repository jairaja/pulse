import Storage from 'expo-sqlite/kv-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useI18n, AppText as Text } from '../lib/i18n';
import { useFinalizedResults, useTodayQuestion } from '../lib/pulseQueries';
import { useAppTheme } from '../lib/theme';
import { localGeneration, writeLocal } from '../lib/localReset';
import { useAuth } from '../lib/auth';
export function YesterdayResult() {
  const { language, t } = useI18n(); const { colors } = useAppTheme(); const router = useRouter(); const cache = useQueryClient();
  const { session } = useAuth(); const generation = localGeneration(); const results = useFinalizedResults(language); const today = useTodayQuestion(language);
  const expected = today.data?.askedOn ? new Date(Date.parse(`${today.data.askedOn}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) : null;
  const item = expected ? results.data?.pages[0]?.items.find(result => result.askedOn === expected) : results.data?.pages[0]?.items[0];
  const key = `pulse.dismissed-result.${session?.user.id ?? 'guest'}.${item?.id}`;
  const dismissed = useQuery({ queryKey: ['pulse', 'dismissed', key], queryFn: () => Storage.getItem(key), enabled: Boolean(item) });
  if (!item || dismissed.isPending || dismissed.data === 'yes') return null;
  return <View style={{ padding: 18, gap: 10, marginTop: 24, borderColor: colors.border, borderWidth: 1, borderRadius: 16 }}>
    <Text style={{ color: colors.muted }}>{t(expected ? 'Yesterday’s result' : 'Past Results')} · {item.askedOn} UTC</Text><Text style={{ color: colors.ink }}>{item.questionText}</Text>
    <Text style={{ color: colors.accent }}>{t(item.finalResult)} · {t('{count} votes', { count: item.totalVotes })}</Text>
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/past-results', params: { highlight: item.id } })} style={{ minHeight: 48 }}><Text style={{ color: colors.accent }}>{t('View result')}</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => { void writeLocal(key, 'yes', generation).then(() => cache.setQueryData(['pulse', 'dismissed', key], 'yes')); }} style={{ minHeight: 48 }}><Text style={{ color: colors.muted }}>{t('Dismiss')}</Text></Pressable>
  </View>;
}
