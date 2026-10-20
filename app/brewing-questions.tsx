import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../lib/auth';
import { useCommunityBrewing } from '../lib/communityQueries';
import { useBrewingQuestion } from '../lib/pulseQueries';
import { useConnectivity } from '../lib/query';
import { useAppTheme, type ThemeColors } from '../lib/theme';

export default function BrewingQuestionsScreen() {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const brewing = useBrewingQuestion();
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>BREWING QUESTIONS</Text>
        <View style={styles.card}>
          <Text style={styles.title}>Next daily question</Text>
          {brewing.isPending ? <ActivityIndicator color={colors.accent} /> : brewing.isError ? (
            <Text style={styles.body}>The scheduled preview could not be loaded. Please retry.</Text>
          ) : brewing.data ? (
            <>
              <Text style={styles.date}>OPENS AT 00:00 UTC · {formatDate(brewing.data.askedOn)}</Text>
              <Text style={styles.question}>{brewing.data.questionText}</Text>
              <Text style={styles.body}>Today’s voting closes and its results become available at that same time.</Text>
            </>
          ) : <Text style={styles.body}>Tomorrow’s question has not been announced yet. Each daily question opens at 00:00 UTC.</Text>}
          <Pressable accessibilityRole="button" disabled={brewing.isFetching} onPress={() => void brewing.refetch()} style={styles.button}>
            <Text style={styles.buttonText}>Refresh scheduled preview</Text>
          </Pressable>
        </View>
        <CommunityPanel key={session?.user.id ?? 'guest'} userId={session?.user.id} styles={styles} />
      </ScrollView>
    </SafeAreaView>
  );
}

function CommunityPanel({ userId, styles }: { userId?: string; styles: ReturnType<typeof createStyles> }) {
  const router = useRouter();
  const { feed, allowance, submit, upvote, refresh } = useCommunityBrewing(userId);
  const connectivity = useConnectivity();
  const [draft, setDraft] = useState('');
  const items = feed.data?.pages.flatMap(page => page.items) ?? [];
  const available = Boolean(userId && allowance.data && !allowance.isError && !allowance.isFetching &&
    connectivity.determined && connectivity.online && !submit.isPending && !upvote.isPending);
  async function sendQuestion() {
    if (!available || allowance.data?.submittedQuestionId) return;
    try { await submit.mutateAsync(draft); setDraft(''); } catch { /* Mutation error is displayed below. */ }
  }
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Community questions</Text>
      <Text style={styles.body}>Submit one question and upvote one other person’s question per day. Both allowances reset at 00:00 UTC. You cannot upvote your own question.</Text>
      <Text style={styles.body}>These are suggestions for future daily questions. Upvotes do not automatically schedule a question.</Text>
      {!userId ? (
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.push({ pathname: '/account', params: { source: 'brewing-questions' } })}>
          <Text style={styles.buttonText}>Sign in to submit or upvote</Text>
        </Pressable>
      ) : (
        <View style={styles.card}>
          {allowance.isPending ? <Text style={styles.body}>Checking your daily allowance…</Text> : allowance.isError ? (
            <Text style={styles.error}>Your daily allowance could not be verified. Refresh before submitting or upvoting.</Text>
          ) : allowance.data ? (
            <>
              <Text style={styles.body}>{allowance.data.submittedQuestionId ? 'Your question has been submitted today.' : 'You can submit one question today.'}</Text>
              <Text style={styles.body}>{allowance.data.upvotedQuestionId ? 'You have used today’s upvote.' : 'You have one upvote available today.'}</Text>
              <Text style={styles.date}>RESETS AT 00:00 UTC · {formatDate(allowance.data.resetsAt.slice(0, 10))}</Text>
            </>
          ) : null}
          {!allowance.data?.submittedQuestionId ? (
            <>
              <TextInput accessibilityLabel="Your question" multiline maxLength={280} value={draft} onChangeText={setDraft}
                placeholder="Ask a question that can be answered YES or NO" placeholderTextColor={styles.placeholder.color}
                editable={available} style={styles.input} />
              <Text style={styles.body}>{draft.length}/280 characters · minimum 5</Text>
              <Pressable accessibilityRole="button" disabled={!available || draft.trim().length < 5} onPress={() => void sendQuestion()}
                style={[styles.button, (!available || draft.trim().length < 5) && styles.disabled]}>
                <Text style={styles.buttonText}>{submit.isPending ? 'Submitting…' : 'Submit today’s question'}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      )}
      {!connectivity.online && connectivity.determined ? <Text style={styles.body}>Connect to submit or upvote. Offline actions are not queued.</Text> : null}
      {submit.error || upvote.error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{(submit.error ?? upvote.error)?.message}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.button}><Text style={styles.buttonText}>Refresh community questions</Text></Pressable>
      {feed.isPending ? <ActivityIndicator /> : feed.isError ? <Text style={styles.error}>Community questions could not be loaded. Please refresh.</Text> : items.length === 0 ? <Text style={styles.body}>No community questions yet. Be the first to submit one.</Text> : null}
      {items.map(item => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.question}>{item.text}</Text>
          <Text style={styles.body}>{item.upvoteCount} {item.upvoteCount === 1 ? 'upvote' : 'upvotes'}{item.isOwn ? ' · Your question' : ''}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={item.isOwn ? 'Your question cannot be upvoted by you' : `Upvote: ${item.text}`}
            disabled={!available || item.isOwn || Boolean(allowance.data?.upvotedQuestionId)}
            onPress={() => upvote.mutate(item.id)}
            style={[styles.button, (!available || item.isOwn || Boolean(allowance.data?.upvotedQuestionId)) && styles.disabled]}>
            <Text style={styles.buttonText}>{item.isOwn ? 'Your question' : item.upvotedToday ? 'Upvoted today' : 'Upvote'}</Text>
          </Pressable>
        </View>
      ))}
      {feed.hasNextPage ? <Pressable accessibilityRole="button" disabled={feed.isFetchingNextPage} onPress={() => void feed.fetchNextPage()} style={styles.button}>
        <Text style={styles.buttonText}>{feed.isFetchingNextPage ? 'Loading…' : 'Load more questions'}</Text>
      </Pressable> : null}
    </View>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.canvas, flex: 1 }, content: { padding: 24, gap: 24, paddingBottom: 48 },
    section: { gap: 16 }, card: { gap: 12, backgroundColor: colors.surface, padding: 18, borderRadius: 18 },
    eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
    title: { color: colors.ink, fontSize: 27, fontWeight: '700' }, body: { color: colors.muted, fontSize: 15, lineHeight: 23 },
    date: { color: colors.accent, fontSize: 12, fontWeight: '700' }, question: { color: colors.ink, fontSize: 21, fontWeight: '700', lineHeight: 28 },
    button: { borderColor: colors.accent, borderWidth: 1, borderRadius: 14, padding: 15, minHeight: 48, alignItems: 'center' },
    buttonText: { color: colors.accent, fontWeight: '700' }, input: { color: colors.ink, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 110, textAlignVertical: 'top' },
    placeholder: { color: colors.muted }, disabled: { opacity: 0.45 }, error: { color: '#C95B55', fontSize: 15, lineHeight: 22 }
  });
}
