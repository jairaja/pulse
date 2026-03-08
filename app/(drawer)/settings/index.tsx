import { StyleSheet, Text, View } from 'react-native';
import { PulseButton } from '@/app/components/PulseButton';
import { useAppStore } from '@/app/store/useAppStore';

export default function SettingsScreen() {
  const setTheme = useAppStore((state) => state.setTheme);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.label}>Theme</Text>
      <View style={styles.row}>
        <PulseButton title="System" onPress={() => setTheme('system')} />
        <PulseButton title="Dark" onPress={() => setTheme('dark')} />
        <PulseButton title="Light" onPress={() => setTheme('light')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', padding: 16, gap: 12 },
  title: { color: '#F9FAFB', fontSize: 20, fontWeight: '700' },
  label: { color: '#CBD5E1' },
  row: { flexDirection: 'row', gap: 8 }
});
