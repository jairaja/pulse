import { Text, View } from 'react-native';
import { colors } from '@/constants/theme';

export function OfflineBanner() {
  return (
    <View style={{ backgroundColor: '#2b0d1c', borderRadius: 10, padding: 10 }}>
      <Text style={{ color: '#ffd3e0', fontWeight: '700' }}>No internet connection.</Text>
    </View>
  );
}
