import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from '@/app/lib/queryClient';
import { useConnectivityMonitor } from '@/app/lib/useConnectivityMonitor';

export default function RootLayout() {
  useConnectivityMonitor();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(drawer)" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
