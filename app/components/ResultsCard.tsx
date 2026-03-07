import { Text, View } from 'react-native';
import { VictoryPie } from 'victory-native';
import { colors } from '@/constants/theme';
import { ResultsSnapshot } from '@/types/domain';

type Props = { data: ResultsSnapshot };

export function ResultsCard({ data }: Props) {
  return (
    <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 14, gap: 8 }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>The world today</Text>
      <VictoryPie
        width={260}
        height={180}
        data={[
          { x: 'Yes', y: data.worldYesPercent },
          { x: 'No', y: 100 - data.worldYesPercent }
        ]}
        colorScale={[colors.accent, colors.danger]}
      />
      <Text style={{ color: colors.text }}>World Result: {data.worldResult}</Text>
      <Text style={{ color: colors.text }}>Country Result: {data.countryResult}</Text>
      <Text style={{ color: colors.text }}>Your Vote: {data.userVote}</Text>
    </View>
  );
}
