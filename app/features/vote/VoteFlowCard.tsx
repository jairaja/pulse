import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PulseButton } from '@/app/components/PulseButton';

type Binary = 'YES' | 'NO';

export function VoteFlowCard({ onDone }: { onDone: (prediction: Binary, vote: Binary) => void }) {
  const [prediction, setPrediction] = useState<Binary | null>(null);
  const [vote, setVote] = useState<Binary | null>(null);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>What do you predict the world will say?</Text>
      <View style={styles.row}>
        <PulseButton title="Predict YES" onPress={() => setPrediction('YES')} />
        <PulseButton title="Predict NO" onPress={() => setPrediction('NO')} />
      </View>

      <Text style={styles.title}>Cast your vote</Text>
      <View style={styles.row}>
        <PulseButton title="Vote YES" onPress={() => setVote('YES')} disabled={!prediction} />
        <PulseButton title="Vote NO" onPress={() => setVote('NO')} disabled={!prediction} />
      </View>

      <PulseButton
        title="Submit"
        disabled={!prediction || !vote}
        onPress={() => {
          if (prediction && vote) onDone(prediction, vote);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16
  },
  title: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600'
  },
  row: {
    flexDirection: 'row',
    gap: 8
  }
});
