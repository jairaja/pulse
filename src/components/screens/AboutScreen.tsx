import { ScrollView, Text } from 'react-native';

export function AboutScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#090A0F' }} contentContainerStyle={{ padding: 20, gap: 10 }}>
      <Text style={{ color: '#fff', fontSize: 24 }}>About PULSE</Text>
      <Text style={{ color: '#E8EEFF' }}>We do not collect personal data. We do not know your name, age, or gender.</Text>
      <Text style={{ color: '#E8EEFF' }}>We only know device country and never your exact location.</Text>
      <Text style={{ color: '#E8EEFF' }}>We do not show ads. We will never show ads. Sponsored questions are clearly labeled.</Text>
      <Text style={{ color: '#E8EEFF' }}>This app started as a hobby experiment to test whether a random idea could work.</Text>
      <Text style={{ color: '#E8EEFF' }}>Questions can repeat because human feelings change over time.</Text>
    </ScrollView>
  );
}
