import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BrewingQuestionsScreen() {
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>BREWING QUESTIONS</Text>
        <View style={styles.message}>
          <Text style={styles.title}>Tomorrow’s question starts here.</Text>
          <Text style={styles.body}>Community questions and voting are coming in a later step.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled
          style={styles.button}
        >
          <Text style={styles.buttonText}>Ask a question · Coming soon</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#E9EAE6', flex: 1 },
  content: { flex: 1, justifyContent: 'space-between', padding: 24 },
  eyebrow: { color: '#315FC7', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  message: { gap: 12 },
  title: { color: '#1B1C1A', fontSize: 32, fontWeight: '700', letterSpacing: -0.7, lineHeight: 39 },
  body: { color: '#6F716C', fontSize: 16, lineHeight: 24 },
  button: {
    alignItems: 'center',
    backgroundColor: '#DFDED8',
    borderColor: '#C8C5BD',
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 58,
    justifyContent: 'center'
  },
  buttonText: { color: '#777872', fontSize: 15, fontWeight: '700' }
});
