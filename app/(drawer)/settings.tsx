import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSessionStore } from '@/stores/sessionStore';

export default function SettingsScreen() {
  const { countryCode, languageCode, themeMode, setPreferences } = useSessionStore();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Settings</Text>
      <Text style={styles.meta}>Country: {countryCode}</Text>
      <Text style={styles.meta}>Language: {languageCode}</Text>
      <Text style={styles.meta}>Theme: {themeMode}</Text>
      <Pressable style={styles.button} onPress={() => setPreferences({ themeMode: 'dark' })}>
        <Text style={styles.buttonText}>Use Dark Theme</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070f', padding: 16, gap: 12 },
  header: { color: '#eff3ff', fontSize: 22, fontWeight: '700' },
  meta: { color: '#99a8cc' },
  button: { backgroundColor: '#0d1324', borderWidth: 1, borderColor: '#00f6ff', borderRadius: 12, padding: 12 },
  buttonText: { color: '#eff3ff', fontWeight: '600' },
});
