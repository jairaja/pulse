import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountPrompt } from '../components/AccountPrompt';
import { useAppTheme, type ThemeColors } from '../lib/theme';

type PastResult = {
  date: string;
  question: string;
  result: 'YES' | 'NO' | 'TIE';
  yesPercent: number;
  userVote?: 'YES' | 'NO';
};

const previewResults: PastResult[] = [
  {
    date: 'YESTERDAY',
    question: 'Should cities create more car-free streets?',
    result: 'YES',
    yesPercent: 64,
    userVote: 'YES'
  },
  {
    date: '2 DAYS AGO',
    question: 'Should schools start later in the morning?',
    result: 'YES',
    yesPercent: 71
  },
  {
    date: '3 DAYS AGO',
    question: 'Should social media have a minimum age of 16?',
    result: 'NO',
    yesPercent: 46,
    userVote: 'NO'
  }
];

export default function PastResultsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>PAST RESULTS</Text>
          <Text style={styles.title}>What PULSE voters said.</Text>
          <Text style={styles.body}>Every finalized question is visible, whether you voted or not.</Text>
        </View>

        <View style={styles.results}>
          {previewResults.map((item) => (
            <View key={item.question} style={styles.resultCard}>
              <Text style={styles.date}>{item.date}</Text>
              <Text style={styles.question}>{item.question}</Text>
              <View style={styles.resultRow}>
                <Text style={styles.result}>{item.result}</Text>
                <Text style={styles.percentage}>{item.yesPercent}% YES</Text>
              </View>
              <Text style={item.userVote ? styles.voted : styles.notVoted}>
                {item.userVote ? `You voted ${item.userVote}` : 'You didn’t vote on this one'}
              </Text>
            </View>
          ))}
        </View>

        <AccountPrompt
          action="Protect my history"
          body="Keep future server-confirmed answers available when you change phones."
          source="past-results"
          title="Changing phones someday?"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { gap: 28, padding: 24, paddingBottom: 48 },
  intro: { gap: 12 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '700', letterSpacing: -0.7, lineHeight: 39 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  results: { gap: 12 },
  resultCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 11,
    padding: 18
  },
  date: { color: colors.disabledText, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  question: { color: colors.ink, fontSize: 18, fontWeight: '700', lineHeight: 25 },
  resultRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  result: { color: colors.accent, fontSize: 26, fontWeight: '800' },
  percentage: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  voted: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  notVoted: { color: colors.disabledText, fontSize: 13 },
});
}
