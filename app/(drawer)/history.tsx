import { FlatList, StyleSheet, Text, View } from 'react-native';

const history = [
  { id: 'q1', question: 'Should AI replace teachers?', yourVote: 'NO', world: 'YES 54%' },
  { id: 'q2', question: 'Should voting be mandatory?', yourVote: 'YES', world: 'YES 63%' },
];

export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>History (answered only)</Text>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.question}>{item.question}</Text>
            <Text style={styles.meta}>You: {item.yourVote}</Text>
            <Text style={styles.meta}>World: {item.world}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070f', padding: 16 },
  header: { color: '#eff3ff', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  item: { backgroundColor: '#0d1324', padding: 14, borderRadius: 12, marginBottom: 12 },
  question: { color: '#eff3ff', fontWeight: '600', marginBottom: 6 },
  meta: { color: '#99a8cc' },
});
