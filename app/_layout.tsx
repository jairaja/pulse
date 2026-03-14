import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { QueryProvider } from './providers/QueryProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { useSessionStore } from '@/stores/sessionStore';
import { getOrCreateDeviceId } from '@/utils/device';

export default function RootLayout() {
  const setDeviceId = useSessionStore((state) => state.setDeviceId);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, [setDeviceId]);

  return (
    <QueryProvider>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(drawer)" />
        </Stack>
      </ThemeProvider>
    </QueryProvider>
  );
}
