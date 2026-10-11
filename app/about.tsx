import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutScreen() {
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ABOUT PULSE</Text>
        <Text style={styles.title}>
          One world. One question. One answer today.
        </Text>
        <Text style={styles.title}>No awkward profile form.</Text>
        <Text style={styles.body}>
          PULSE is a small experiment in finding out what people think today—not what an algorithm
          thinks they should think.
        </Text>
        <Text style={styles.body}>
          We do not need your name, age, gender, or exact location. There are no ads. If a question
          is sponsored, we will say so plainly.
        </Text>
        <Text style={styles.body}>
          Questions may repeat because people change. “Am I happy today?” can have a very different
          answer next month. Humans are inconveniently interesting like that.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#E9EAE6', flex: 1 },
  content: { gap: 22, padding: 24, paddingBottom: 48 },
  eyebrow: { color: '#315FC7', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#1B1C1A', fontSize: 32, fontWeight: '700', letterSpacing: -0.7, lineHeight: 39 },
  body: { color: '#565853', fontSize: 17, lineHeight: 27 }
});
