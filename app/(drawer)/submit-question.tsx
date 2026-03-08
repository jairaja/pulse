import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function SubmitQuestionScreen() {
  const [value, setValue] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Submit Question</Text>
      <Text style={styles.meta}>1 question per user per week. Community-owned after submit.</Text>
      <TextInput
        placeholder="Type your question…"
        placeholderTextColor="#5d6d94"
        style={styles.input}
        value={value}
        onChangeText={setValue}
        multiline
      />
      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>Submit</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070f', padding: 16, gap: 10 },
  header: { color: '#eff3ff', fontSize: 22, fontWeight: '700' },
  meta: { color: '#99a8cc' },
  input: { minHeight: 120, backgroundColor: '#0d1324', borderColor: '#1a2745', borderWidth: 1, borderRadius: 12, color: '#eff3ff', padding: 12 },
  button: { backgroundColor: '#00f6ff', padding: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#05070f', fontWeight: '700' },
});
