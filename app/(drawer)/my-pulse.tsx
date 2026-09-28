import { Text, View } from 'react-native';
import { colors } from '@/constants/theme';

export default function MyPulseScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>My Pulse</Text>
      <Text style={{ color: colors.text }}>You agree with the world X% of the time.</Text>
      <Text style={{ color: colors.text }}>You disagree with the world X% of the time.</Text>
      <Text style={{ color: colors.muted }}>Insights unlock after 10 answered questions.</Text>
    </View>
  );
}
