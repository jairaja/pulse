import { useI18n } from '../lib/i18n';
import { Drawer } from 'expo-router/drawer';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { DailyCycleObserver } from '../components/DailyCycleObserver';
import { PreferencesProvider } from '../lib/preferences';
import { AuthProvider } from '../lib/auth';
import { QueryProvider } from '../lib/query';
import { AppThemeProvider, useAppTheme } from '../lib/theme';

export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthProvider>
        <PreferencesProvider>
          <AppThemeProvider>
            <AppDrawer />
          </AppThemeProvider>
        </PreferencesProvider>
      </AuthProvider>
    </QueryProvider>
  );
}

function AppDrawer() {
  const { t, direction } = useI18n();
  const { colors, isDark } = useAppTheme();

  return (
    <View style={{ flex: 1, direction }}>
      <DailyCycleObserver />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Drawer
        screenOptions={{
          drawerPosition: direction === 'rtl' ? 'right' : 'left',
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
        <Drawer.Screen name="index" options={{ drawerLabel: t('Today'), title: 'PULSE' }} />
        <Drawer.Screen
          name="past-results"
          options={{ drawerLabel: t('Past Results'), title: t('Past Results') }}
        />
        <Drawer.Screen name="my-pulse" options={{ drawerLabel: t('My Pulse'), title: t('My Pulse') }} />
        <Drawer.Screen
          name="brewing-questions"
          options={{ drawerLabel: t('Brewing Questions'), title: t('Brewing Questions') }}
        />
        <Drawer.Screen name="settings" options={{ drawerLabel: t('Settings'), title: t('Settings') }} />
        <Drawer.Screen
          name="account"
          options={{
            drawerItemStyle: { display: 'none' },
            drawerLabel: t('Account'),
            title: t('Keep your Pulse')
          }}
        />
        <Drawer.Screen name="about" options={{ drawerLabel: t('About'), title: t('About PULSE') }} />
      </Drawer>
    </View>
  );
}
