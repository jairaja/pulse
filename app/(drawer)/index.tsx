import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PredictionCard } from '@/components/PredictionCard';
import { ResultsCard } from '@/components/ResultsCard';
import { ShareCard } from '@/components/ShareCard';
import { VoteCard } from '@/components/VoteCard';
import { WorldHeatMap } from '@/components/WorldHeatMap';
import { colors } from '@/constants/theme';
import { useHeatMap, useResults, useSubmitPrediction, useSubmitVote, useTodayQuestion } from '@/hooks/usePulseData';
import { useSessionStore } from '@/stores/sessionStore';

export default function HomeScreen() {
  const [isOnline, setIsOnline] = useState(true);
  const predictionSubmitted = useSessionStore((state) => state.predictionSubmitted);
  const questionQuery = useTodayQuestion();
  const question = questionQuery.data;

  const predictionMutation = useSubmitPrediction(question?.id ?? '');
  const voteMutation = useSubmitVote(question?.id ?? '');
  const resultsQuery = useResults(question?.id ?? '');
  const heatMapQuery = useHeatMap(question?.id ?? '');

  useEffect(() => {
    const subscription = NetInfo.addEventListener((state) => setIsOnline(Boolean(state.isConnected)));
    return () => subscription();
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, backgroundColor: colors.bg }}>
      <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>PULSE</Text>
      <Text style={{ color: colors.muted }}>The world today</Text>
      {!isOnline && <OfflineBanner />}
      <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 14 }}>
        <Text style={{ color: colors.muted }}>Today’s Question</Text>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{question?.text ?? 'Loading...'}</Text>
      </View>

      <PredictionCard onSelect={(value) => predictionMutation.mutate(value)} disabled={predictionMutation.isPending || !isOnline} />
      <VoteCard disabled={!predictionSubmitted || voteMutation.isPending || !isOnline} onVote={(vote) => voteMutation.mutate(vote)} />

      {resultsQuery.data && (
        <>
          <ResultsCard data={resultsQuery.data} />
          <WorldHeatMap points={heatMapQuery.data ?? []} />
          <ShareCard
            question={question?.text ?? ''}
            worldResult={resultsQuery.data.worldResult}
            countryResult={resultsQuery.data.countryResult}
            userVote={resultsQuery.data.userVote}
          />
        </>
      )}
    </ScrollView>
  );
}
