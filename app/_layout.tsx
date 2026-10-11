import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';

const colors = {
  accent: '#315FC7',
  canvas: '#E9EAE6',
  ink: '#1B1C1A',
  muted: '#6F716C',
  surface: '#F3F1EC'
};

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Drawer
        screenOptions={{
          drawerActiveBackgroundColor: '#E1E5ED',
          drawerActiveTintColor: colors.accent,
          drawerInactiveTintColor: colors.ink,
          drawerLabelStyle: { fontSize: 16, fontWeight: '600' },
          drawerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          sceneStyle: { backgroundColor: colors.canvas }
        }}
      >
        <Drawer.Screen name="index" options={{ drawerLabel: 'Today', title: 'PULSE' }} />
        <Drawer.Screen
          name="past-results"
          options={{ drawerLabel: 'Past Results', title: 'Past Results' }}
        />
        <Drawer.Screen
          name="brewing-questions"
          options={{ drawerLabel: 'Brewing Questions', title: 'Brewing Questions' }}
        />
        <Drawer.Screen name="about" options={{ drawerLabel: 'About', title: 'About PULSE' }} />
      </Drawer>
    </>
  );
}
