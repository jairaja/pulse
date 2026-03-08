import { Text, TextInput, View } from 'react-native';

export function SubmitQuestionScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#090A0F', padding: 20, gap: 12 }}>
      <Text style={{ color: '#fff', fontSize: 24 }}>Submit Question</Text>
      <Text style={{ color: '#90A0C8' }}>1 question per user per week.</Text>
      <TextInput placeholder="Should...?" placeholderTextColor="#90A0C8" style={{ color: '#fff', borderColor: '#1F253A', borderWidth: 1, borderRadius: 12, padding: 12 }} />
    </View>
  );
}
