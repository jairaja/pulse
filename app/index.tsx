import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme, type ThemeColors } from '../lib/theme';

type Vote = 'YES' | 'NO';

export default function TodayScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
                styles={styles}
                selected={selection === 'YES'}
                onPress={() => setSelection('YES')}
              />
              <VoteButton
                label="NO"
                styles={styles}
                selected={selection === 'NO'}
                onPress={() => setSelection('NO')}
              />
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
  styles: ReturnType<typeof createStyles>;
};

function VoteButton({ label, onPress, selected, styles }: VoteButtonProps) {
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 18
  },
  identity: { gap: 2 },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.8 },
  wordmark: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: 1.5 },
  questionArea: { gap: 16, paddingVertical: 36 },
  date: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.1 },
  question: { color: colors.ink, fontSize: 36, fontWeight: '700', letterSpacing: -1, lineHeight: 43 },
  actionArea: { gap: 18 },
  prompt: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  voteButton: {
    alignItems: 'center',
    backgroundColor: colors.control,
    borderColor: colors.disabledBorder,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 64,
    justifyContent: 'center'
  },
  voteButtonPressed: { backgroundColor: colors.activeSurface, borderColor: colors.accent, transform: [{ scale: 0.98 }] },
  voteButtonSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  voteButtonText: { color: colors.accent, fontSize: 17, fontWeight: '800', letterSpacing: 0.8 },
  voteButtonTextSelected: { color: colors.onPrimary },
  submitButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    minHeight: 60,
    justifyContent: 'center'
  },
  submitButtonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  submitButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '800', letterSpacing: 0.7 },
  disclosure: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  receipt: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 24
  },
  receiptMark: { color: colors.accent, fontSize: 28, fontWeight: '700' },
  receiptTitle: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  receiptBody: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' }
});
}
