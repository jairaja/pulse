import { Text, View } from 'react-native';

export function MyPulseScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#090A0F', padding: 20 }}>
      <Text style={{ color: '#fff', fontSize: 24 }}>My Pulse</Text>
      <Text style={{ color: '#E8EEFF', marginTop: 12 }}>You agree with the world X% of the time</Text>
      <Text style={{ color: '#E8EEFF', marginTop: 6 }}>You disagree with the world X% of the time</Text>
      <Text style={{ color: '#90A0C8', marginTop: 10 }}>Metrics unlock after 10 answered questions.</Text>
    </View>
  );
}
