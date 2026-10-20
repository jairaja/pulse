import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountPrompt } from '../components/AccountPrompt';
import { useBrewingQuestion } from '../lib/pulseQueries';
import { useAppTheme, type ThemeColors } from '../lib/theme';

export default function BrewingQuestionsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const brewing = useBrewingQuestion();
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>BREWING QUESTIONS</Text>
        <View style={styles.message}>
          <Text style={styles.title}>Tomorrow’s question starts here.</Text>
          {brewing.isPending ? <ActivityIndicator color={colors.accent} /> : brewing.isError ? (
            <Text accessibilityLiveRegion="polite" style={styles.body}>Tomorrow’s preview could not be loaded. Check your connection and retry.</Text>
          ) : brewing.data ? (
            <>
              <Text style={styles.date}>SCHEDULED · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
                .format(new Date(`${brewing.data.askedOn}T00:00:00Z`))} · 00:00 UTC</Text>
              <Text style={styles.question}>{brewing.data.questionText}</Text>
              <Text style={styles.body}>Preview only. Voting opens after the daily UTC rollover; the schedule may change.</Text>
            </>
          ) : <Text style={styles.body}>No preview has been published for tomorrow yet.</Text>}
          <Pressable accessibilityRole="button" disabled={brewing.isFetching} onPress={() => void brewing.refetch()} style={styles.refresh}>
            <Text style={styles.refreshText}>{brewing.isFetching ? 'Refreshing…' : 'Refresh preview'}</Text>
          </Pressable>
          <Text style={styles.body}>Community questions and voting are coming in a later step.</Text>
        </View>
        <View style={styles.actions}>
          <AccountPrompt
            action="Sign in and save"
            body="Save future question submissions across devices and know if one goes live."
            source="brewing-questions"
            title="Save this question"
          />
          <Pressable accessibilityRole="button" disabled style={styles.button}>
            <Text style={styles.buttonText}>Ask a question · Coming soon</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { flexGrow: 1, justifyContent: 'space-between', padding: 24, gap: 28 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  message: { gap: 12 },
  actions: { gap: 12 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '700', letterSpacing: -0.7, lineHeight: 39 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  date: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  question: { color: colors.ink, fontSize: 24, fontWeight: '700', lineHeight: 32 },
  refresh: { borderColor: colors.accent, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  refreshText: { color: colors.accent, fontWeight: '700' },
  button: {
    alignItems: 'center',
    backgroundColor: colors.disabledSurface,
    borderColor: colors.disabledBorder,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 58,
    justifyContent: 'center'
  },
  buttonText: { color: colors.disabledText, fontSize: 15, fontWeight: '700' }
});
}
