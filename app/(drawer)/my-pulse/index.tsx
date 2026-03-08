import { StyleSheet, Text, View } from 'react-native';

export default function MyPulseScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Pulse</Text>
      <Text style={styles.body}>You agree with the world X% of the time (after 10 answered questions).</Text>
      <Text style={styles.body}>You disagree with the world X% of the time.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', padding: 16 },
  title: { color: '#F9FAFB', fontSize: 20, fontWeight: '700' },
  body: { color: '#CBD5E1', marginTop: 8 }
});
