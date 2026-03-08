import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { VoteFlowCard } from '@/app/features/vote/VoteFlowCard';
import { ResultsChart } from '@/app/features/results/ResultsChart';
import { WorldHeatMap } from '@/app/features/heatmap/WorldHeatMap';
import { useAppStore } from '@/app/store/useAppStore';

export default function HomeScreen() {
  const [completed, setCompleted] = useState(false);
  const isOnline = useAppStore((state) => state.isOnline);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.brand}>PULSE · The world today</Text>
      {!isOnline ? <Text style={styles.offline}>No internet connection.</Text> : null}

      {!completed ? (
        <VoteFlowCard
          onDone={() => {
            setCompleted(true);
          }}
        />
      ) : (
        <View style={styles.results}>
          <Text style={styles.sectionTitle}>World Result</Text>
          <ResultsChart yes={62} no={38} />
          <Text style={styles.sectionTitle}>Live Heat Map</Text>
          <WorldHeatMap />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#030712',
    padding: 16,
    gap: 16
  },
  brand: {
    color: '#00E6FF',
    fontWeight: '700',
    fontSize: 20
  },
  offline: {
    color: '#F87171'
  },
  results: {
    gap: 16
  },
  sectionTitle: {
    color: '#F9FAFB',
    fontWeight: '600',
    fontSize: 16
  }
});
