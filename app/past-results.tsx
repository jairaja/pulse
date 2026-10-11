import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

        <View style={styles.accountCard}>
          <Text style={styles.accountEyebrow}>CHANGING PHONES SOMEDAY?</Text>
          <Text style={styles.accountTitle}>Keep your voting history.</Text>
          <Text style={styles.accountBody}>
            PULSE works without an account. Add an email later if you want your answered-question
            history to follow you to another device.
          </Text>
          <Pressable accessibilityRole="button" disabled style={styles.accountButton}>
            <Text style={styles.accountButtonText}>Protect my history · Coming soon</Text>
          </Pressable>
          <Text style={styles.accountNote}>Email is enough. Your name should be optional.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#E9EAE6', flex: 1 },
  content: { gap: 28, padding: 24, paddingBottom: 48 },
  intro: { gap: 12 },
  eyebrow: { color: '#315FC7', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#1B1C1A', fontSize: 32, fontWeight: '700', letterSpacing: -0.7, lineHeight: 39 },
  body: { color: '#6F716C', fontSize: 16, lineHeight: 24 },
  results: { gap: 12 },
  resultCard: {
    backgroundColor: '#F3F1EC',
    borderColor: '#D6D2C9',
    borderRadius: 20,
    borderWidth: 1,
    gap: 11,
    padding: 18
  },
  date: { color: '#777872', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  question: { color: '#1B1C1A', fontSize: 18, fontWeight: '700', lineHeight: 25 },
  resultRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  result: { color: '#315FC7', fontSize: 26, fontWeight: '800' },
  percentage: { color: '#1B1C1A', fontSize: 14, fontWeight: '700' },
  voted: { color: '#315FC7', fontSize: 13, fontWeight: '700' },
  notVoted: { color: '#777872', fontSize: 13 },
  accountCard: {
    backgroundColor: '#E1E5ED',
    borderRadius: 24,
    gap: 12,
    padding: 20
  },
  accountEyebrow: { color: '#315FC7', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  accountTitle: { color: '#1B1C1A', fontSize: 22, fontWeight: '700' },
  accountBody: { color: '#565853', fontSize: 15, lineHeight: 22 },
  accountButton: {
    alignItems: 'center',
    backgroundColor: '#C9CEDA',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 54,
    marginTop: 4
  },
  accountButtonText: { color: '#676B73', fontSize: 14, fontWeight: '700' },
  accountNote: { color: '#6F716C', fontSize: 12, lineHeight: 18, textAlign: 'center' }
});
