import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PastResultsScreen() {
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>PAST RESULTS</Text>
        <View style={styles.message}>
          <Text style={styles.title}>Yesterday’s pulse will live here.</Text>
          <Text style={styles.body}>Only questions you answered will reveal their results.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#E9EAE6', flex: 1 },
  content: { flex: 1, justifyContent: 'space-between', padding: 24 },
  eyebrow: { color: '#315FC7', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  message: { gap: 12, paddingBottom: 52 },
  title: { color: '#1B1C1A', fontSize: 32, fontWeight: '700', letterSpacing: -0.7, lineHeight: 39 },
  body: { color: '#6F716C', fontSize: 16, lineHeight: 24 }
});
