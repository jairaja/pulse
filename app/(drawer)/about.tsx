import { ScrollView, Text } from 'react-native';
import { colors } from '@/constants/theme';

export default function AboutScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10, backgroundColor: colors.bg }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>About PULSE</Text>
      <Text style={{ color: colors.text }}>We do not collect personal data. We do not know your name, age, or gender.</Text>
      <Text style={{ color: colors.text }}>We do not know your exact location. We only know device country.</Text>
      <Text style={{ color: colors.text }}>We do not store unnecessary cookies. We do not show ads. We will never show ads.</Text>
      <Text style={{ color: colors.text }}>Sometimes we may post sponsored questions, clearly labeled.</Text>
      <Text style={{ color: colors.text }}>
        This started as a hobby experiment to see if a random idea could work. Feelings change, so repeated questions are allowed.
      </Text>
    </ScrollView>
  );
}
