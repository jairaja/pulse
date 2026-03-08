import { useMutation, useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { pulseApi } from '@/api/pulseApi';
import { BinaryChoiceButtons } from '@/components/BinaryChoiceButtons';
import { useSessionStore } from '@/stores/sessionStore';
import { useVotingStore } from '@/stores/votingStore';
import { WorldHeatMap } from '@/components/WorldHeatMap';
import { VictoryPie } from 'victory-native';

export default function HomeScreen() {
  const { userId = '', deviceId = '', countryCode, languageCode } = useSessionStore();
  const { predictionByQuestion, voteByQuestion, submitPrediction, submitVote } = useVotingStore();

  const questionQuery = useQuery({
    queryKey: ['today-question', languageCode],
    queryFn: () => pulseApi.getTodayQuestion(languageCode),
  });

  const question = questionQuery.data;
  const prediction = question ? predictionByQuestion[question.id] : undefined;
  const vote = question ? voteByQuestion[question.id] : undefined;

  const predictionMutation = useMutation({
    mutationFn: (predictionValue: 'YES' | 'NO') => {
      if (!question) throw new Error('No active question');
      return pulseApi.submitPrediction({ questionId: question.id, userId, prediction: predictionValue });
    },
    onSuccess: (_, predictionValue) => question && submitPrediction(question.id, predictionValue),
  });

  const voteMutation = useMutation({
    mutationFn: (choice: 'YES' | 'NO') => {
      if (!question) throw new Error('No active question');
      return pulseApi.submitVote({ questionId: question.id, userId, deviceId, countryCode, choice });
    },
    onSuccess: (_, choice) => question && submitVote(question.id, choice),
  });

  const resultQuery = useQuery({
    queryKey: ['result', question?.id, countryCode],
    queryFn: () => pulseApi.getResult(question!.id, countryCode),
    enabled: Boolean(question?.id && vote),
    refetchInterval: 10000,
  });

  if (questionQuery.isLoading) return <Text style={styles.loading}>Loading pulse…</Text>;
  if (!question) return <Text style={styles.loading}>No question live right now.</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>The world today</Text>
      <Text style={styles.question}>{question.questionText}</Text>

      {!prediction ? (
        <View style={styles.card}>
          <Text style={styles.title}>What do you predict the world will say?</Text>
          <BinaryChoiceButtons onSelect={(choice) => predictionMutation.mutate(choice)} />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.title}>Your vote</Text>
        <BinaryChoiceButtons
          onSelect={(choice) => voteMutation.mutate(choice)}
          disabled={!prediction || Boolean(vote)}
          selected={vote}
        />
      </View>

      {vote && resultQuery.data ? (
        <View style={styles.card}>
          <Text style={styles.title}>World Result (Live)</Text>
          <VictoryPie
            data={[
              { x: 'YES', y: resultQuery.data.worldYesPercent },
              { x: 'NO', y: resultQuery.data.worldNoPercent },
            ]}
            colorScale={['#6bffb4', '#ff6b9d']}
            height={220}
          />
          <WorldHeatMap
            data={[
              { lat: 51.5, lng: -0.1, yesRatio: resultQuery.data.countryYesPercent / 100 },
              { lat: 37.7, lng: -122.4, yesRatio: resultQuery.data.worldYesPercent / 100 },
              { lat: 35.6, lng: 139.6, yesRatio: resultQuery.data.worldYesPercent / 100 },
            ]}
          />
          <Text style={styles.meta}>Country YES: {resultQuery.data.countryYesPercent.toFixed(1)}%</Text>
          <Text style={styles.meta}>Your vote: {vote}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070f', padding: 16, gap: 14 },
  subtitle: { color: '#00f6ff', fontSize: 14, letterSpacing: 1.5, textTransform: 'uppercase' },
  question: { color: '#eff3ff', fontSize: 25, fontWeight: '700' },
  card: { backgroundColor: '#0d1324', borderRadius: 16, padding: 14, gap: 12, borderWidth: 1, borderColor: '#1a2745' },
  title: { color: '#eff3ff', fontSize: 17, fontWeight: '600' },
  meta: { color: '#99a8cc', fontSize: 14 },
  loading: { flex: 1, textAlign: 'center', marginTop: 140, color: '#eff3ff' },
});
