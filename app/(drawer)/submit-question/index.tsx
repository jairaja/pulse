import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PulseButton } from '@/app/components/PulseButton';

export default function SubmitQuestionScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Submit Question</Text>
      <TextInput placeholder="Enter your question" placeholderTextColor="#64748B" style={styles.input} multiline />
      <Text style={styles.help}>One question per user per week. Community votes decide tomorrow's question.</Text>
      <PulseButton title="Submit" onPress={() => undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', padding: 16, gap: 12 },
  title: { color: '#F9FAFB', fontSize: 20, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#1F2937', borderRadius: 10, color: '#F8FAFC', padding: 12, minHeight: 120 },
  help: { color: '#94A3B8' }
});
