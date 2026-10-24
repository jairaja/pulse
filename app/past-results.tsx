import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { resolvePublicQuestion } from '../lib/publicQuestions';
import { ShareQuestion } from '../components/ShareQuestion';
import { ViewToggle, useCardView } from '../components/ViewToggle';
import { useI18n, AppText as Text } from '../lib/i18n';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountPrompt } from '../components/AccountPrompt';
import { PulseApiError } from '../lib/pulseApi';
import { useFinalizedResults } from '../lib/pulseQueries';
import type { FinalizedResult } from '../lib/pulseTypes';
import { useConnectivity } from '../lib/query';
import { useAppTheme, type ThemeColors } from '../lib/theme';

export default function PastResultsScreen() {
  const { t, language } = useI18n();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const connectivity = useConnectivity();
  const results = useFinalizedResults(language);
  const view = useCardView('results');
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const highlighted = useQuery({ queryKey: ['pulse', 'highlighted-result', highlight], enabled: Boolean(highlight),
    queryFn: () => resolvePublicQuestion('question', highlight!), meta: { persist: false } });
  const pages = results.data?.pages.flatMap((page) => page.items) ?? [];
  const h = highlighted.data;
  const pinned: FinalizedResult | null = h?.destination === 'past-results' && h.result ? { id: h.id, questionText: h.text,
    askedOn: h.asked_on!, sponsored: false, sourceLanguage: 'und', finalResult: h.result,
    totalVotes: Number(h.total_votes), yesCount: Number(h.yes_count), noCount: Number(h.no_count), finalizedAt: h.finalized_at! } : null;
  const items = pinned ? [pinned, ...pages.filter(item => item.id !== pinned.id)] : pages;

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <FlatList key={view.mode} numColumns={view.mode === 'grid' ? 2 : 1} columnWrapperStyle={view.mode === 'grid' ? { gap: 12 } : undefined}
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ResultCard item={item} styles={styles} highlighted={item.id === highlight} />}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>{t("PAST RESULTS")}</Text>
            <ViewToggle view={view} />
            <Text style={styles.title}>{t("What PULSE voters said.")}</Text>
            <Text style={styles.body}>{t("Every finalized question is visible, whether you voted or not.")}</Text>
            <Text style={styles.body}>{t("New results are published at 00:00 UTC, when the next daily question opens.")}</Text>
            {!connectivity.online && connectivity.determined ? (
              <Text style={styles.offline}>{t("Offline · showing downloaded results")}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          connectivity.determined && !connectivity.online ? (
            <Text style={styles.empty}>{t("You’re offline and no downloaded results are available.")}</Text>
          ) : results.isPending ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : results.isError ? (
            <ErrorState error={results.error} onRetry={() => void results.refetch()} styles={styles} />
          ) : (
            <Text style={styles.empty}>{t("No finalized results have been published yet.")}</Text>
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {results.hasNextPage ? (
              <Pressable
                accessibilityRole="button"
                disabled={results.isFetchingNextPage || !connectivity.online}
                onPress={() => void results.fetchNextPage()}
                style={[styles.moreButton, (results.isFetchingNextPage || !connectivity.online) && styles.disabled]}
              >
                {results.isFetchingNextPage ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.moreText}>{t("Load more")}</Text>}
              </Pressable>
            ) : null}
            <AccountPrompt
              action={t("Protect my history")}
              body={t("Keep server-confirmed answers available when you change phones.")}
              source="past-results"
              title={t("Changing phones someday?")}
            />
          </View>
        }
        onRefresh={() => void results.refetch()}
        refreshing={results.isRefetching && !results.isFetchingNextPage}
      />
    </SafeAreaView>
  );
}

function ResultCard({ item, styles, highlighted }: { item: FinalizedResult; styles: ReturnType<typeof createStyles>; highlighted: boolean }) {
  const { t, locale } = useI18n();
  const { colors } = useAppTheme();
  const yesPercent = item.totalVotes === 0 ? 0 : Math.round((item.yesCount / item.totalVotes) * 100);
  const noPercent = item.totalVotes === 0 ? 0 : 100 - yesPercent;
  return (
    <View style={[styles.resultCard, { flex: 1 }, highlighted && { borderColor: colors.accent }]}>
      <Text style={styles.date}>{formatDate(item.askedOn, locale)}</Text>
      <Text style={styles.question}>{item.questionText}</Text>
      <View style={styles.resultRow}>
        <Text style={styles.result}>{t(item.finalResult)}</Text>
        <Text style={styles.percentage}>{t('{yes}% YES · {no}% NO', { yes: yesPercent, no: noPercent })}</Text>
      </View>
      <Text style={styles.voteCount}>{t('{count} votes', { count: new Intl.NumberFormat(locale).format(item.totalVotes) })}</Text>
      <ShareQuestion kind="question" id={item.id} text={item.questionText} />
    </View>
  );
}

function ErrorState({ error, onRetry, styles }: { error: unknown; onRetry: () => void; styles: ReturnType<typeof createStyles> }) {
  const { t } = useI18n();
  const message = error instanceof PulseApiError || error instanceof Error ? error.message : 'Could not load results.';
  return <View style={styles.errorCard}><Text style={styles.error}>{t(message)}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={styles.moreButton}><Text style={styles.moreText}>{t("Try again")}</Text></Pressable></View>;
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)).toUpperCase();
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.canvas, flex: 1 },
    content: { gap: 12, padding: 24, paddingBottom: 48 },
    intro: { gap: 12, marginBottom: 16 },
    eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
    title: { color: colors.ink, fontSize: 32, fontWeight: '700', letterSpacing: -0.7, lineHeight: 39 },
    body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
    offline: { color: colors.accent, fontSize: 13, fontWeight: '700' },
    resultCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: 11, padding: 18 },
    date: { color: colors.disabledText, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    question: { color: colors.ink, fontSize: 18, fontWeight: '700', lineHeight: 25 },
    resultRow: { alignItems: 'baseline', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
    result: { color: colors.accent, fontSize: 26, fontWeight: '800' },
    percentage: { color: colors.ink, flexShrink: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },
    voteCount: { color: colors.muted, fontSize: 13 },
    yourVote: { color: colors.accent, fontSize: 13, fontWeight: '700' },
    footer: { gap: 20, paddingTop: 16 },
    moreButton: { alignItems: 'center', borderColor: colors.accent, borderRadius: 15, borderWidth: 1, justifyContent: 'center', minHeight: 50 },
    moreText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
    disabled: { opacity: 0.45 },
    loader: { marginVertical: 40 },
    empty: { color: colors.muted, fontSize: 15, lineHeight: 22, paddingVertical: 32, textAlign: 'center' },
    errorCard: { gap: 14, paddingVertical: 24 },
    error: { color: colors.error, fontSize: 14, lineHeight: 20, textAlign: 'center' }
  });
}
