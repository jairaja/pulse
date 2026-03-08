import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ConnectivityGuard } from '@/components/ConnectivityGuard';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ConnectivityGuard>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(drawer)" />
              <Stack.Screen name="question/[id]" options={{ presentation: 'modal' }} />
            </Stack>
          </ConnectivityGuard>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
