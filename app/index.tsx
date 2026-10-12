import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Vote = 'YES' | 'NO';

export default function TodayScreen() {
  const [selection, setSelection] = useState<Vote | null>(null);
  const [submittedVote, setSubmittedVote] = useState<Vote | null>(null);

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.identity}>
          <Text style={styles.eyebrow}>THE WORLD TODAY</Text>
          <Text style={styles.wordmark}>PULSE</Text>
        </View>

        <View style={styles.questionArea}>
          <Text style={styles.date}>TODAY · QUESTION 001</Text>
          <Text style={styles.question}>Should cities create more car-free streets?</Text>
        </View>

        {submittedVote ? (
          <View accessibilityLiveRegion="polite" style={styles.receipt}>
            <Text style={styles.receiptMark}>✓</Text>
            <Text style={styles.receiptTitle}>Your voice is in.</Text>
            <Text style={styles.receiptBody}>
              You voted {submittedVote}. Come back tomorrow to see how PULSE voters answered.
            </Text>
          </View>
        ) : (
          <View style={styles.actionArea}>
            <Text style={styles.prompt}>WHAT DO YOU THINK?</Text>
            <View style={styles.buttonRow}>
              <VoteButton
                label="YES"
                selected={selection === 'YES'}
                onPress={() => setSelection('YES')}
              />
              <VoteButton label="NO" selected={selection === 'NO'} onPress={() => setSelection('NO')} />
            </View>
            {selection ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSubmittedVote(selection)}
                  style={({ pressed }) => [
                    styles.submitButton,
                    pressed && styles.submitButtonPressed
                  ]}
                >
                  <Text style={styles.submitButtonText}>SUBMIT {selection}</Text>
                </Pressable>
                <Text style={styles.disclosure}>Your vote can’t be changed after submission.</Text>
              </>
            ) : (
              <Text style={styles.disclosure}>Results unlock with tomorrow’s question.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type VoteButtonProps = {
  label: Vote;
  onPress: () => void;
  selected: boolean;
};

function VoteButton({ label, onPress, selected }: VoteButtonProps) {
  return (
    <Pressable
      accessibilityLabel={`Vote ${label.toLowerCase()}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.voteButton,
        selected && styles.voteButtonSelected,
        pressed && styles.voteButtonPressed
      ]}
    >
      <Text style={[styles.voteButtonText, selected && styles.voteButtonTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#E9EAE6', flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 18
  },
  identity: { gap: 2 },
  eyebrow: { color: '#6F716C', fontSize: 11, fontWeight: '700', letterSpacing: 1.8 },
  wordmark: { color: '#1B1C1A', fontSize: 28, fontWeight: '800', letterSpacing: 1.5 },
  questionArea: { gap: 16, paddingVertical: 36 },
  date: { color: '#315FC7', fontSize: 12, fontWeight: '700', letterSpacing: 1.1 },
  question: { color: '#1B1C1A', fontSize: 36, fontWeight: '700', letterSpacing: -1, lineHeight: 43 },
  actionArea: { gap: 18 },
  prompt: { color: '#6F716C', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  voteButton: {
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
    borderColor: '#C8C5BD',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 64,
    justifyContent: 'center'
  },
  voteButtonPressed: { backgroundColor: '#E1E5ED', borderColor: '#315FC7', transform: [{ scale: 0.98 }] },
  voteButtonSelected: { backgroundColor: '#315FC7', borderColor: '#315FC7' },
  voteButtonText: { color: '#315FC7', fontSize: 17, fontWeight: '800', letterSpacing: 0.8 },
  voteButtonTextSelected: { color: '#FAF9F6' },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#1B1C1A',
    borderRadius: 18,
    minHeight: 60,
    justifyContent: 'center'
  },
  submitButtonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  submitButtonText: { color: '#FAF9F6', fontSize: 15, fontWeight: '800', letterSpacing: 0.7 },
  disclosure: { color: '#6F716C', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  receipt: {
    alignItems: 'center',
    backgroundColor: '#F3F1EC',
    borderColor: '#D6D2C9',
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 24
  },
  receiptMark: { color: '#315FC7', fontSize: 28, fontWeight: '700' },
  receiptTitle: { color: '#1B1C1A', fontSize: 22, fontWeight: '700' },
  receiptBody: { color: '#6F716C', fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
