import { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';
import { useConnectivity } from '@/hooks/useConnectivity';

export function ConnectivityGuard({ children }: PropsWithChildren) {
  const online = useConnectivity();
  if (!online) {
    return (
      <View style={{ flex: 1, backgroundColor: '#090A0F', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff' }}>No internet connection.</Text>
        <Text style={{ color: '#90A0C8', marginTop: 8 }}>You can still browse historic questions you answered.</Text>
      </View>
    );
  }
  return children;
}
