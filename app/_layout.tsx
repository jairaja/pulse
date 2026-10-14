import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';

import { AppThemeProvider, useAppTheme } from '../lib/theme';

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AppDrawer />
    </AppThemeProvider>
  );
}

function AppDrawer() {
  const { colors, isDark } = useAppTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Drawer
        screenOptions={{
          drawerActiveBackgroundColor: colors.activeSurface,
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
        <Drawer.Screen name="my-pulse" options={{ drawerLabel: 'My Pulse', title: 'My Pulse' }} />
        <Drawer.Screen
          name="brewing-questions"
          options={{ drawerLabel: 'Brewing Questions', title: 'Brewing Questions' }}
        />
        <Drawer.Screen name="settings" options={{ drawerLabel: 'Settings', title: 'Settings' }} />
        <Drawer.Screen name="about" options={{ drawerLabel: 'About', title: 'About PULSE' }} />
      </Drawer>
    </>
  );
}
