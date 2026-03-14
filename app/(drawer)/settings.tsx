import { Text, View } from 'react-native';
import { colors } from '@/constants/theme';

export default function SettingsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, gap: 10 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Settings</Text>
      <Text style={{ color: colors.muted }}>Country: United Kingdom (default)</Text>
      <Text style={{ color: colors.muted }}>Language: English (default)</Text>
      <Text style={{ color: colors.muted, marginTop: 12 }}>
        Theme is fixed for now to Pulse Architect (white + blue).
      </Text>
    </View>
  );
}
