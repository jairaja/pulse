import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MyPulseScreen() {
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>MY PULSE</Text>

        <View style={styles.message}>
          <Text style={styles.title}>Your patterns, when there’s enough to say.</Text>
          <Text style={styles.body}>
            After you answer at least 10 questions, this is where you’ll see how often your answers
            align with PULSE voters.
          </Text>
        </View>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderValue}>—</Text>
          <Text style={styles.placeholderLabel}>QUESTIONS ANSWERED</Text>
          <Text style={styles.placeholderNote}>Insights are coming in a later phase.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#E9EAE6', flex: 1 },
  content: { flex: 1, justifyContent: 'space-between', padding: 24, paddingBottom: 48 },
  eyebrow: { color: '#315FC7', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  message: { gap: 12 },
  title: { color: '#1B1C1A', fontSize: 32, fontWeight: '700', letterSpacing: -0.7, lineHeight: 39 },
  body: { color: '#6F716C', fontSize: 16, lineHeight: 24 },
  placeholder: {
    alignItems: 'center',
    backgroundColor: '#F3F1EC',
    borderColor: '#D6D2C9',
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 24
  },
  placeholderValue: { color: '#315FC7', fontSize: 42, fontWeight: '700' },
  placeholderLabel: { color: '#1B1C1A', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  placeholderNote: { color: '#777872', fontSize: 13, lineHeight: 19, textAlign: 'center' }
});
