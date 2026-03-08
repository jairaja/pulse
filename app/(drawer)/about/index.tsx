import { ScrollView, StyleSheet, Text } from 'react-native';

export default function AboutScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>About PULSE</Text>
      <Text style={styles.body}>No login, no creepy profile tracking, no ads. Ever.</Text>
      <Text style={styles.body}>We do not know your name, age, gender, or exact location.</Text>
      <Text style={styles.body}>We only know your device country so we can compare local vs world pulse.</Text>
      <Text style={styles.body}>Sometimes we may run sponsored questions, clearly labeled.</Text>
      <Text style={styles.body}>This started as a hobby experiment. Humans change, so questions can repeat.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#030712', padding: 16, gap: 10 },
  title: { color: '#F9FAFB', fontSize: 20, fontWeight: '700' },
  body: { color: '#CBD5E1' }
});
