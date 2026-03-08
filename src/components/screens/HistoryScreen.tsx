import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { fetchAnsweredHistory } from '@/api/pulseApi';
import { useIdentityStore } from '@/store/useIdentityStore';

export function HistoryScreen() {
  const deviceId = useIdentityStore((s) => s.deviceId);
  const { data } = useQuery({ queryKey: ['history', deviceId], queryFn: () => fetchAnsweredHistory(deviceId) });
  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#090A0F' }}>
      <Text style={{ color: '#fff', fontSize: 24 }}>History</Text>
      {(data ?? []).map((item: any) => (
        <Text key={item.question_id} style={{ color: '#E8EEFF', marginTop: 10 }}>{item.question_text}</Text>
      ))}
    </View>
  );
}
