import { useI18n, AppText as Text } from '../lib/i18n';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { YesterdayResult } from '../components/YesterdayResult';
import { AccountPrompt } from '../components/AccountPrompt';
import { TurnstileChallenge } from '../components/TurnstileChallenge';
import { getCaptchaChallengeUrl, prepareVoteAttempt, type PendingVoteAttempt } from '../lib/captcha';
import { PulseApiError } from '../lib/pulseApi';
import { useSubmitVote, useTodayQuestion, useVoteReceipt } from '../lib/pulseQueries';
import type { VoteChoice } from '../lib/pulseTypes';
import { useConnectivity } from '../lib/query';
import { useAppTheme, type ThemeColors } from '../lib/theme';
import { utcChangeoverText } from '../lib/utcCycle';

export default function TodayScreen() {
  const { language } = useI18n();
  const today = useTodayQuestion(language);
  return <TodayQuestionScreen key={today.data?.id ?? 'none'} today={today} />;
}

function TodayQuestionScreen({ today }: { today: ReturnType<typeof useTodayQuestion> }) {
  const { t, locale } = useI18n();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const connectivity = useConnectivity();
  const question = today.data;
  const storedReceipt = useVoteReceipt(question?.id);
  const vote = useSubmitVote(question?.id);
  const [selection, setSelection] = useState<VoteChoice | null>(null);
  const [pendingAttempt, setPendingAttempt] = useState<PendingVoteAttempt | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const estimatedServerNow = question
    ? Date.parse(question.serverTime) + Math.max(0, now - today.dataUpdatedAt)
    : Number.POSITIVE_INFINITY;
  const isCurrentQuestion = Boolean(
    question && estimatedServerNow < Date.parse(question.votingClosesAt)
  );

  useEffect(() => {
    const updateClock = () => setNow(Date.now());
    const timer = setInterval(updateClock, 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') updateClock();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  const receipt = vote.data ?? storedReceipt.data;
  const voteDisabled =
    !isCurrentQuestion ||
    today.isFetching ||
    !connectivity.determined ||
    !connectivity.online ||
    storedReceipt.isPending || storedReceipt.isError || storedReceipt.isFetching ||
    vote.isPending;

  async function beginVote() {
    if (!question || !selection || voteDisabled) return;
    try {
      const attempt = await prepareVoteAttempt(question.id, selection);
      getCaptchaChallengeUrl(attempt.captchaBinding);
      setVerificationError(null);
      setPendingAttempt(attempt);
    } catch (error) {
      setVerificationError(error instanceof Error ? error.message : 'Human verification could not start.');
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.identity}>
          <Text style={styles.eyebrow}>{t("THE WORLD TODAY")}</Text>
          <Text style={styles.wordmark}>PULSE</Text>
        </View>

        {!today.data && connectivity.determined && !connectivity.online ? (
          <StateCard styles={styles} title={t("You’re offline")}>
            <Text style={styles.stateBody}>{t("Connect once to download today’s question.")}</Text>
          </StateCard>
        ) : !today.data && today.isPending ? (
          <StateCard styles={styles} title={t("Loading today’s question")}>
            <ActivityIndicator color={colors.accent} />
          </StateCard>
        ) : !question && today.isError ? (
          <StateCard styles={styles} title={t("Today’s question could not be loaded")}>
            <Text style={styles.stateBody}>{t(errorMessage(today.error))}</Text>
            <RetryButton label={t("Try again")} onPress={() => void today.refetch()} styles={styles} />
          </StateCard>
        ) : !question ? (
          <StateCard styles={styles} title={t("No question is live")}>
            <Text style={styles.stateBody}>{t("Check again after the next global question is published.")}</Text>
            <RetryButton label={t("Check again")} onPress={() => void today.refetch()} styles={styles} />
          </StateCard>
        ) : (
          <>
            {today.isError || !isCurrentQuestion ? (
              <View accessibilityLiveRegion="polite" style={styles.warning}>
                <Text style={styles.warningText}>
                  {!isCurrentQuestion
                    ? t("Showing the last downloaded question. Voting is disabled until today’s question loads.")
                    : t("Showing downloaded data. Pulling a fresh copy failed.")}
                </Text>
              </View>
            ) : null}
            <View style={styles.questionArea}>
              <Text style={styles.date}>{`${t(isCurrentQuestion ? 'Today' : 'Last downloaded')} · ${formatQuestionDate(question.askedOn, locale)}`}</Text>
              <Text style={styles.question}>{question.questionText}</Text>
              {question.sponsored ? <Text style={styles.sponsored}>{t("SPONSORED QUESTION")}</Text> : null}
              <Text style={styles.stateBody}>{t("Daily voting: 00:00 UTC to the next 00:00 UTC.")}</Text>
            </View>

            {receipt ? (
              <View accessibilityLiveRegion="polite" style={styles.receipt}>
                <Text style={styles.receiptMark}>✓</Text>
                <Text style={styles.receiptTitle}>{receipt.alreadyCounted ? t("Your vote was already counted") : t("Vote counted")}</Text>
                <Text style={styles.receiptBody}>{receipt.choice ? t('Your {choice} vote is recorded.', { choice: t(receipt.choice) }) : t('This device has already voted. Logging out does not reset today’s vote.')}</Text>
                <Text style={styles.receiptBody}>{utcChangeoverText(question.votingClosesAt, estimatedServerNow, { t, locale })}</Text>
                <Text style={styles.receiptId}>{t('Receipt: {id}', { id: receipt.receiptId.slice(0, 8).toUpperCase() })}</Text>
                <AccountPrompt
                  action={t("Keep this vote")}
                  body={t("Sign in so server-confirmed votes can follow you after secure history sync launches.")}
                  source="vote-receipt"
                  title={t("Keep your Pulse")}
                />
              </View>
            ) : (
              <View style={styles.actionArea}>
                <Text style={styles.prompt}>{t("WHAT DO YOU THINK?")}</Text>
                {storedReceipt.isPending || storedReceipt.isFetching ? (
                  <Text accessibilityLiveRegion="polite" style={styles.offline}>{t("Checking whether this device already voted…")}</Text>
                ) : storedReceipt.isError ? (
                  <>
                    <Text accessibilityLiveRegion="polite" style={styles.error}>{t("We couldn’t verify your previous vote. Voting is paused until this check succeeds.")}</Text>
                    <RetryButton label={t("Check vote status")} onPress={() => void storedReceipt.refetch()} styles={styles} />
                  </>
                ) : null}
                {!connectivity.determined ? (
                  <Text style={styles.offline}>{t("Checking your connection…")}</Text>
                ) : !connectivity.online ? (
                  <Text accessibilityLiveRegion="polite" style={styles.offline}>{t("You’re offline. Previously downloaded content remains available, but voting requires a connection.")}</Text>
                ) : null}
                <View style={styles.buttonRow}>
                  <VoteButton
                    disabled={voteDisabled}
                    label="YES"
                    styles={styles}
                    selected={selection === 'YES'}
                    onPress={() => setSelection('YES')}
                  />
                  <VoteButton
                    disabled={voteDisabled}
                    label="NO"
                    styles={styles}
                    selected={selection === 'NO'}
                    onPress={() => setSelection('NO')}
                  />
                </View>
                {vote.error ? (
                  <Text accessibilityLiveRegion="polite" style={styles.error}>{t(errorMessage(vote.error))}</Text>
                ) : null}
                {verificationError ? (
                  <Text accessibilityLiveRegion="polite" style={styles.error}>{t(verificationError)}</Text>
                ) : null}
                {selection ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      disabled={voteDisabled}
                      onPress={() => void beginVote()}
                      style={({ pressed }) => [
                        styles.submitButton,
                        voteDisabled && styles.disabled,
                        pressed && styles.submitButtonPressed
                      ]}
                    >
                      {vote.isPending ? (
                        <ActivityIndicator color={colors.onPrimary} />
                      ) : (
                        <Text style={styles.submitButtonText}>{t('Submit {choice}', { choice: t(selection) })}</Text>
                      )}
                    </Pressable>
                    <Text style={styles.disclosure}>{t("Your vote can’t be changed after server acceptance.")}</Text>
                  </>
                ) : (
                    <Text style={styles.disclosure}>{utcChangeoverText(question.votingClosesAt, estimatedServerNow, { t, locale })}</Text>
                )}
              </View>
            )}
          </>
        )}
        <YesterdayResult />
      </ScrollView>
      {pendingAttempt ? (
        <TurnstileChallenge
          binding={pendingAttempt.captchaBinding}
          onCancel={() => setPendingAttempt(null)}
          onToken={(captchaToken) => {
            const attempt = { ...pendingAttempt, captchaToken };
            setPendingAttempt(null);
            vote.mutate(attempt);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof PulseApiError || error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

type VoteButtonProps = {
  disabled: boolean;
  label: VoteChoice;
  onPress: () => void;
  selected: boolean;
  styles: ReturnType<typeof createStyles>;
};

function VoteButton({ disabled, label, onPress, selected, styles }: VoteButtonProps) {
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityLabel={t('Vote {choice}', { choice: t(label) })}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.voteButton,
        selected && styles.voteButtonSelected,
        disabled && styles.disabled,
        pressed && styles.voteButtonPressed
      ]}
    >
      <Text style={[styles.voteButtonText, selected && styles.voteButtonTextSelected]}>{t(label)}</Text>
    </Pressable>
  );
}

function StateCard({ children, styles, title }: { children: ReactNode; styles: ReturnType<typeof createStyles>; title: string }) {
  return <View style={styles.stateCard}><Text style={styles.stateTitle}>{title}</Text>{children}</View>;
}

function RetryButton({ label, onPress, styles }: { label: string; onPress: () => void; styles: ReturnType<typeof createStyles> }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.retryButton}><Text style={styles.retryText}>{label}</Text></Pressable>;
}

function formatQuestionDate(askedOn: string, locale: string) {
  const date = new Date(`${askedOn}T00:00:00Z`);
  const label = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date).toUpperCase();
  return label;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.canvas, flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'space-between', paddingBottom: 28, paddingHorizontal: 24, paddingTop: 18 },
    identity: { gap: 2 },
    eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.8 },
    wordmark: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: 1.5 },
    questionArea: { gap: 16, paddingVertical: 36 },
    date: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.1 },
    question: { color: colors.ink, fontSize: 36, fontWeight: '700', letterSpacing: -1, lineHeight: 43 },
    sponsored: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    actionArea: { gap: 18 },
    prompt: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
    buttonRow: { flexDirection: 'row', gap: 12 },
    voteButton: { alignItems: 'center', backgroundColor: colors.control, borderColor: colors.disabledBorder, borderRadius: 18, borderWidth: 1, flex: 1, minHeight: 64, justifyContent: 'center' },
    voteButtonPressed: { backgroundColor: colors.activeSurface, borderColor: colors.accent, transform: [{ scale: 0.98 }] },
    voteButtonSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    voteButtonText: { color: colors.accent, fontSize: 17, fontWeight: '800', letterSpacing: 0.8 },
    voteButtonTextSelected: { color: colors.onPrimary },
    submitButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 18, minHeight: 60, justifyContent: 'center' },
    submitButtonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
    submitButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '800', letterSpacing: 0.7 },
    disclosure: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    offline: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    error: { color: colors.error, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    disabled: { opacity: 0.45 },
    receipt: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 24, borderWidth: 1, gap: 10, padding: 24 },
    receiptMark: { color: colors.accent, fontSize: 28, fontWeight: '700' },
    receiptTitle: { color: colors.ink, fontSize: 22, fontWeight: '700' },
    receiptBody: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
    receiptId: { color: colors.disabledText, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    stateCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 24, gap: 16, marginVertical: 40, padding: 24 },
    stateTitle: { color: colors.ink, fontSize: 22, fontWeight: '700', textAlign: 'center' },
    stateBody: { color: colors.body, fontSize: 15, lineHeight: 22, textAlign: 'center' },
    retryButton: { borderColor: colors.accent, borderRadius: 14, borderWidth: 1, minHeight: 48, paddingHorizontal: 22, justifyContent: 'center' },
    retryText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
    warning: { backgroundColor: colors.activeSurface, borderRadius: 14, marginTop: 16, padding: 12 },
    warningText: { color: colors.body, fontSize: 13, lineHeight: 19 }
  });
}
