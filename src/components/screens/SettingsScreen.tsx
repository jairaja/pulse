import { Text, View } from 'react-native';

export function SettingsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#090A0F', padding: 20 }}>
      <Text style={{ color: '#fff', fontSize: 24 }}>Settings</Text>
      <Text style={{ color: '#E8EEFF', marginTop: 12 }}>Language selection</Text>
      <Text style={{ color: '#E8EEFF', marginTop: 12 }}>Country selection</Text>
      <Text style={{ color: '#E8EEFF', marginTop: 12 }}>Theme: System / Dark / Light</Text>
    </View>
  );
}
