import { useInfiniteQuery, useQuery, type InfiniteData } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AccountPrompt } from '../components/AccountPrompt';
import { useAuth } from '../lib/auth';
import { AppText as Text, useI18n } from '../lib/i18n';
import { guestAnswers } from '../lib/localHistory';
import { supabase } from '../lib/supabase';
import type { VoteReceipt } from '../lib/pulseTypes';
import { openQuestion, publicQuestionSummaries, type PublicQuestion } from '../lib/publicQuestions';
import { useAppTheme } from '../lib/theme';

type GuestPage = { items: { receipt: VoteReceipt; question: PublicQuestion | null }[]; next: number | null };
type Kind = 'answers' | 'upvotes' | 'questions';
type Item = { id: string; question_id: string; question_text: string; happened_at: string; choice: string | null;
  link_kind: 'question' | 'submission'; status: string | null };
type Page = { items: Item[]; next: { time: string; id: string } | null;
  stats: { answers: number; upvotes: number; questions: number; selected: number; aligned: number; eligible: number } };
export default function MyPulseScreen() {
  const { session } = useAuth();
  return <Activity key={session?.user.id ?? 'guest'} userId={session?.user.id} />;
}
function Activity({ userId }: { userId?: string }) {
  const { t, locale } = useI18n(); const { colors } = useAppTheme(); const router = useRouter();
  const [kind, setKind] = useState<Kind>('answers');
  const account = useInfiniteQuery<Page, Error, InfiniteData<Page>, readonly unknown[], Page['next']>({ queryKey: ['pulse', 'my-activity', userId, kind], enabled: Boolean(userId),
    initialPageParam: null as Page['next'], getNextPageParam: page => page.next ?? undefined,
    queryFn: async ({ pageParam, signal }): Promise<Page> => {
      const { data, error } = await supabase!.rpc('my_pulse_activity', { p_kind: kind, p_before: pageParam?.time ?? null, p_before_id: pageParam?.id ?? null, p_limit: 20 }).abortSignal(signal);
      if (error) throw new Error('Could not load your history.'); return data;
    }, meta: { persist: false } });
  const guest = useQuery({ queryKey: ['pulse', 'guest-history'], queryFn: guestAnswers, enabled: !userId, meta: { persist: false } });
  const guestDetail = useInfiniteQuery<GuestPage, Error, InfiniteData<GuestPage>, readonly unknown[], number>({ queryKey: ['pulse', 'guest-history-detail', guest.data?.map(item => item.receiptId)], enabled: !userId && Boolean(guest.data),
    initialPageParam: 0, getNextPageParam: page => page.next ?? undefined,
    queryFn: async ({ signal, pageParam }) => {
      const receipts = (guest.data ?? []).slice(pageParam, pageParam + 20);
      const questions = await publicQuestionSummaries(receipts.map(receipt => receipt.questionId), signal);
      const byId = new Map(questions.map(question => [question.id, question]));
      return { items: receipts.map(receipt => ({ receipt, question: byId.get(receipt.questionId) ?? null })),
        next: pageParam + 20 < (guest.data?.length ?? 0) ? pageParam + 20 : null };
    }, meta: { persist: false } });
  const stats = account.data?.pages[0]?.stats;
  const items = account.data?.pages.flatMap(page => page.items) ?? [];
  const button = { minHeight: 48, padding: 12, borderRadius: 12, borderColor: colors.border, borderWidth: 1 };
  const date = (value: string) => `${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))} UTC`;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['bottom']}><ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
    <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 30 }}>{t('My Pulse')}</Text>
    <Text style={{ color: colors.body }}>{t(userId ? 'Your answers, questions and community support.' : 'On this device. Guest history stays here until you create an account and choose to add it.')}</Text>
    {userId ? <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{(['answers', 'upvotes', 'questions'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: kind === value }} onPress={() => setKind(value)} style={button}>
        <Text style={{ color: kind === value ? colors.accent : colors.ink }}>{t(value === 'answers' ? 'Answered' : value === 'upvotes' ? 'Upvoted' : 'Asked')} · {stats?.[value] ?? '—'}</Text>
      </Pressable>)}</View>
      {stats ? <>
        <Text style={{ color: colors.accent }}>{t('Selected for a daily question: {count}', { count: stats.selected })}</Text>
        <Text style={{ color: colors.body }}>{t('Your answers matched the majority on {aligned} of {eligible} finalized, non-tied questions you answered.', { aligned: stats.aligned, eligible: stats.eligible })}</Text>
        {stats.eligible >= 10 ? <View accessible accessibilityLabel={t('{percent}% of your eligible answers matched the majority of PULSE participants.', { percent: Math.round(stats.aligned * 100 / stats.eligible) })}>
          <View style={{ height: 14, backgroundColor: colors.border, borderRadius: 7 }}><View style={{ height: 14, borderRadius: 7, backgroundColor: colors.accent, width: `${stats.aligned * 100 / stats.eligible}%` }} /></View>
        </View> : <Text style={{ color: colors.muted }}>{t('A comparison appears after 10 finalized, non-tied answers. PULSE participants are not a representative sample of the world.')}</Text>}
      </> : null}
      {items.map(item => <Pressable key={item.id} accessibilityRole="button" style={{ ...button, backgroundColor: colors.surface }}
        onPress={() => item.status === 'pending' ? router.push('/moderation') : openQuestion(router, item.link_kind, item.question_id)}>
        <Text style={{ color: colors.ink, fontSize: 18 }}>{item.question_text}</Text>
        <Text style={{ color: colors.muted }}>{date(item.happened_at)}</Text>
        {item.choice ? <Text style={{ color: colors.accent }}>{t('You voted {choice}', { choice: t(item.choice) })}</Text> : null}
        {item.status ? <Text style={{ color: colors.accent }}>{t(item.status === 'selected' ? 'Selected for the daily question' : item.status === 'pending' ? 'Pending safety review' : item.status === 'hidden' ? 'Removed from Brewing' : 'In Brewing')}</Text> : null}
      </Pressable>)}
      {account.isPending ? <ActivityIndicator /> : !items.length && !account.isError ? <Text style={{ color: colors.muted }}>{t('Your activity will appear here.')}</Text> : null}
      {account.error ? <Text style={{ color: colors.error }}>{t(account.error.message)}</Text> : null}
      <Pressable accessibilityRole="button" style={button} onPress={() => void account.refetch()}><Text style={{ color: colors.accent }}>{t('Refresh')}</Text></Pressable>
      {account.hasNextPage ? <Pressable accessibilityRole="button" disabled={account.isFetchingNextPage} onPress={() => void account.fetchNextPage()} style={button}><Text style={{ color: colors.accent }}>{t('Load more')}</Text></Pressable> : null}
    </> : <>
      <Text style={{ color: colors.accent }}>{t('Answered on this device: {count}', { count: guest.data?.length ?? 0 })}</Text>
      {guestDetail.data?.pages.flatMap(page => page.items).map(({ receipt, question }) => <Pressable key={receipt.receiptId} accessibilityRole="button" style={button} onPress={() => openQuestion(router, 'question', receipt.questionId)}>
        <Text style={{ color: colors.ink }}>{question?.text ?? t('Question no longer available')}</Text>
        <Text style={{ color: colors.accent }}>{t('You voted {choice}', { choice: t(receipt.choice ?? '—') })}</Text><Text style={{ color: colors.muted }}>{date(receipt.acceptedAt)}</Text>
      </Pressable>)}
      {guestDetail.hasNextPage ? <Pressable accessibilityRole="button" disabled={guestDetail.isFetchingNextPage} style={button} onPress={() => void guestDetail.fetchNextPage()}><Text style={{ color: colors.accent }}>{t('Load more')}</Text></Pressable> : null}
      {!guest.data?.length ? <Text style={{ color: colors.muted }}>{t('Cast the daily YES/NO vote to start your history. Sign-in is needed only to ask or upvote Brewing questions.')}</Text> : null}
      {guestDetail.error ? <Pressable accessibilityRole="button" style={button} onPress={() => void guestDetail.refetch()}><Text style={{ color: colors.accent }}>{t('Retry history')}</Text></Pressable> : null}
      <AccountPrompt action={t('Keep my history')} body={t('Create an account here to add earlier guest votes, or sign in to restore your existing account history.')} source="my-pulse" title={t('Keep your Pulse')} />
    </>}
  </ScrollView></SafeAreaView>;
}
