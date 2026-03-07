import { Pressable, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { ThemeMode, useSettingsStore } from '@/stores/settingsStore';

export default function SettingsScreen() {
  const { theme, setTheme } = useSettingsStore();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, gap: 10 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Settings</Text>
      <Text style={{ color: colors.muted }}>Country: United Kingdom (default)</Text>
      <Text style={{ color: colors.muted }}>Language: English (default)</Text>
      <Text style={{ color: colors.text, marginTop: 12 }}>Theme</Text>
      {(['system', 'dark', 'light'] as ThemeMode[]).map((mode) => (
        <Pressable
          key={mode}
          onPress={() => setTheme(mode)}
          style={{ borderWidth: 1, borderColor: mode === theme ? colors.accent : '#253147', borderRadius: 10, padding: 12 }}
        >
          <Text style={{ color: mode === theme ? colors.accent : colors.text }}>{mode.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}
