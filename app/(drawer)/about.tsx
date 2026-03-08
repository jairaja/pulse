import { ScrollView, StyleSheet, Text } from 'react-native';

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>About Pulse</Text>
      <Text style={styles.body}>
        Pulse is a no-login social experiment. We do not collect personal data, names, ages, genders,
        or exact locations. We only use broad device country so results can compare local vs world pulse.
      </Text>
      <Text style={styles.body}>
        No ads. Never ads. Sometimes sponsored questions may appear and they are clearly labeled.
      </Text>
      <Text style={styles.body}>
        This started as a hobby experiment and yes, questions can repeat because human feelings change.
        "Am I happy today?" can have a different answer next month. That’s the point.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070f' },
  content: { padding: 16, gap: 12 },
  header: { color: '#eff3ff', fontSize: 22, fontWeight: '700' },
  body: { color: '#99a8cc', lineHeight: 22 },
});
