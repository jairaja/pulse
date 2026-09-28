import { Text, View } from 'react-native';
import { colors } from '@/constants/theme';

export default function HistoryScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>History</Text>
      <Text style={{ color: colors.muted, marginTop: 8 }}>
        Shows only questions you voted on, including offline-cached entries.
      </Text>
    </View>
  );
}
