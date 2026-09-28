import { Text, View } from 'react-native';
import { colors } from '@/constants/theme';

export function OfflineBanner() {
  return (
    <View style={{ backgroundColor: '#fef3e8', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#f7d3ab' }}>
      <Text style={{ color: '#8a5a2b', fontWeight: '700' }}>No internet connection.</Text>
    </View>
  );
}
