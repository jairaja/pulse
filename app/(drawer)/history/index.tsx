import { StyleSheet, Text, View } from 'react-native';

export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>History</Text>
      <Text style={styles.body}>Only questions you voted on are shown here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', padding: 16 },
  title: { color: '#F9FAFB', fontSize: 20, fontWeight: '700' },
  body: { color: '#CBD5E1', marginTop: 8 }
});
