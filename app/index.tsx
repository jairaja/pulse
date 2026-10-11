import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

type Choice = 'YES' | 'NO';

export default function HomeScreen() {
  const [prediction, setPrediction] = useState<Choice | null>(null);
  const [vote, setVote] = useState<Choice | null>(null);

  const submitPrediction = (choice: Choice) => {
    setPrediction(choice);
    setVote(null);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>THE WORLD TODAY</Text>
        <Text style={styles.title}>PULSE</Text>
        <Text style={styles.subtitle}>Step 1 — local interaction check</Text>

        <View style={styles.card}>
          <Text style={styles.label}>TODAY’S QUESTION</Text>
          <Text style={styles.question}>Should cities create more car-free streets?</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What do you predict the world will say?</Text>
          <ChoiceButtons selected={prediction} onSelect={submitPrediction} />
        </View>

        <View style={[styles.card, !prediction && styles.cardDisabled]}>
          <Text style={styles.cardTitle}>Cast your vote</Text>
          <Text style={styles.helperText}>
            {prediction ? 'Voting is unlocked.' : 'Choose a prediction first to unlock voting.'}
          </Text>
          <ChoiceButtons selected={vote} onSelect={setVote} disabled={!prediction} />
        </View>

        {vote && (
          <View style={styles.confirmation}>
            <Text style={styles.confirmationText}>Recorded locally: {vote}</Text>
            <Text style={styles.confirmationDetail}>No backend request has been made in Step 1.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

type ChoiceButtonsProps = {
  disabled?: boolean;
  selected: Choice | null;
  onSelect: (choice: Choice) => void;
};

function ChoiceButtons({ disabled = false, selected, onSelect }: ChoiceButtonsProps) {
  return (
    <View style={styles.buttonRow}>
      {(['YES', 'NO'] as const).map((choice) => {
        const isSelected = selected === choice;
        return (
          <Pressable
            key={choice}
            accessibilityRole="button"
            accessibilityState={{ disabled, selected: isSelected }}
            disabled={disabled}
            onPress={() => onSelect(choice)}
            style={({ pressed }) => [
              styles.choiceButton,
              isSelected && styles.choiceButtonSelected,
              disabled && styles.choiceButtonDisabled,
              pressed && !disabled && styles.choiceButtonPressed
            ]}
          >
            <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>{choice}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7fbff' },
  content: { flexGrow: 1, gap: 16, padding: 20 },
  eyebrow: { color: '#527ca7', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#1f4b7a', fontSize: 36, fontWeight: '800', letterSpacing: 1 },
  subtitle: { color: '#6c86a1', fontSize: 15, marginBottom: 8 },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#c6ddf5',
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    padding: 18
  },
  cardDisabled: { backgroundColor: '#f3f8fe' },
  label: { color: '#527ca7', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  question: { color: '#1f4b7a', fontSize: 22, fontWeight: '700', lineHeight: 29 },
  cardTitle: { color: '#1f4b7a', fontSize: 18, fontWeight: '700' },
  helperText: { color: '#6c86a1', fontSize: 14, lineHeight: 20 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  choiceButton: {
    alignItems: 'center',
    backgroundColor: '#edf5ff',
    borderColor: '#2879d0',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 13
  },
  choiceButtonSelected: { backgroundColor: '#2879d0' },
  choiceButtonDisabled: { borderColor: '#bfd0e2', opacity: 0.55 },
  choiceButtonPressed: { opacity: 0.75 },
  choiceText: { color: '#1f63ad', fontSize: 15, fontWeight: '800' },
  choiceTextSelected: { color: '#ffffff' },
  confirmation: {
    backgroundColor: '#e7f4eb',
    borderColor: '#9fceaa',
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 14
  },
  confirmationText: { color: '#196b36', fontSize: 16, fontWeight: '700' },
  confirmationDetail: { color: '#39724d', fontSize: 13 }
});
