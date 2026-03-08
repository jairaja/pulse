import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { pulseApi } from '@/api/pulseApi';
import { useSessionStore } from '@/stores/sessionStore';

export default function MyPulseScreen() {
  const { userId = '' } = useSessionStore();
  const { data } = useQuery({ queryKey: ['my-pulse', userId], queryFn: () => pulseApi.getMyPulse(userId), enabled: Boolean(userId) });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Pulse</Text>
      <Text style={styles.metric}>Agree with world: {data?.worldAgreementPercent ?? 0}%</Text>
      <Text style={styles.metric}>Disagree with world: {data?.worldDisagreementPercent ?? 0}%</Text>
      <Text style={styles.metric}>Prediction accuracy (after 10): {data?.predictionAccuracyPercent ?? 0}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070f', padding: 16, gap: 12 },
  header: { color: '#eff3ff', fontSize: 22, fontWeight: '700' },
  metric: { color: '#99a8cc', fontSize: 16 },
});
