import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#1f4b7a',
          contentStyle: { backgroundColor: '#f7fbff' }
        }}
      >
        <Stack.Screen name="index" options={{ title: 'PULSE' }} />
      </Stack>
    </>
  );
}
