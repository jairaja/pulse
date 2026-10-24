import { AppText as Text, useI18n } from '../lib/i18n';
import { Drawer } from 'expo-router/drawer';
import { Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { DailyCycleObserver } from '../components/DailyCycleObserver';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import { PreferencesProvider, usePreferences } from '../lib/preferences';
import { AuthProvider, useAuth } from '../lib/auth';
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
  const { preferences } = usePreferences();
  const { notice, dismissNotice } = useAuth();

  return (
    <View style={{ flex: 1, direction }}>
      <ReducedMotionConfig mode={preferences.reduceMotion ? ReduceMotion.Always : ReduceMotion.System} />
      <DailyCycleObserver />
      {notice ? <View style={{ backgroundColor: colors.activeSurface, padding: 14, paddingTop: 44, gap: 8 }}>
        <Text accessibilityLiveRegion="polite" style={{ color: colors.ink }}>{t(notice)}</Text>
        <Pressable accessibilityRole="button" onPress={dismissNotice} style={{ minHeight: 48 }}><Text style={{ color: colors.accent }}>{t('Dismiss')}</Text></Pressable>
      </View> : null}
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
        <Drawer.Screen name="ask-question" options={{ drawerItemStyle: { display: 'none' }, title: t('Ask a question') }} />
        <Drawer.Screen name="moderation" options={{ drawerItemStyle: { display: 'none' }, title: t('Pending questions') }} />
        <Drawer.Screen name="q/[kind]/[id]" options={{ drawerItemStyle: { display: 'none' }, title: 'PULSE' }} />
        <Drawer.Screen name="about" options={{ drawerLabel: t('About'), title: t('About PULSE') }} />
      </Drawer>
    </View>
  );
}
