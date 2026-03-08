import { useMutation, useQuery } from '@tanstack/react-query';
import { Text, TouchableOpacity, View } from 'react-native';
import { fetchResults, submitPrediction, submitVote } from '@/api/pulseApi';
import { useTodayQuestion } from '@/hooks/useTodayQuestion';
import { useIdentityStore } from '@/store/useIdentityStore';
import { useVoteStore } from '@/store/useVoteStore';
import { BinaryChoice } from '@/types/domain';
import { ResultChart } from './ResultChart';
import { WorldHeatMap } from './WorldHeatMap';

function BinaryButtons({ title, onSelect }: { title: string; onSelect: (choice: BinaryChoice) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: '#E8EEFF', fontSize: 18 }}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {(['YES', 'NO'] as const).map((choice) => (
          <TouchableOpacity key={choice} onPress={() => onSelect(choice)} style={{ backgroundColor: '#151826', padding: 14, borderRadius: 14 }}>
            <Text style={{ color: '#fff' }}>{choice}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export function VoteFlowScreen() {
  const { data: question } = useTodayQuestion();
  const { prediction, vote, setPrediction, setVote } = useVoteStore();
  const { deviceId, countryCode, init } = useIdentityStore();
  init();

  const predictionMutation = useMutation({
    mutationFn: (choice: BinaryChoice) => submitPrediction(question!.id, choice, deviceId),
  });

  const voteMutation = useMutation({
    mutationFn: (choice: BinaryChoice) => submitVote(question!.id, choice, deviceId, countryCode),
  });

  const { data: results } = useQuery({
    queryKey: ['result', question?.id, countryCode],
    queryFn: () => fetchResults(question!.id, countryCode),
    enabled: Boolean(vote && question?.id),
    refetchInterval: 4000,
  });

  if (!question) return <View style={{ flex: 1, backgroundColor: '#090A0F' }} />;

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#090A0F', gap: 16 }}>
      <Text style={{ color: '#00F5D4', fontSize: 13 }}>The world today</Text>
      <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>{question.text}</Text>

      {!prediction && (
        <BinaryButtons
          title="What do you predict the world will say?"
          onSelect={(choice) => {
            setPrediction(choice);
            predictionMutation.mutate(choice);
          }}
        />
      )}

      {prediction && !vote && (
        <BinaryButtons
          title="Cast your vote"
          onSelect={(choice) => {
            setVote(choice);
            voteMutation.mutate(choice);
          }}
        />
      )}

      {vote && results && (
        <View style={{ gap: 16 }}>
          <Text style={{ color: '#fff' }}>World Result: {results.worldResult}</Text>
          <Text style={{ color: '#fff' }}>Country Result YES: {results.countryYesPct.toFixed(1)}%</Text>
          <Text style={{ color: '#fff' }}>Your Vote: {vote}</Text>
          <ResultChart worldYesPct={results.worldYesPct} countryYesPct={results.countryYesPct} />
          <WorldHeatMap />
        </View>
      )}
    </View>
  );
}
