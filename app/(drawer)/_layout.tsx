import { Drawer } from 'expo-router/drawer';
import { colors } from '@/constants/theme';

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.bg },
        drawerStyle: { backgroundColor: colors.card },
        drawerActiveTintColor: colors.accent,
        drawerInactiveTintColor: colors.muted
      }}
    >
      <Drawer.Screen name="index" options={{ title: 'Home' }} />
      <Drawer.Screen name="history" options={{ title: 'History' }} />
      <Drawer.Screen name="my-pulse" options={{ title: 'My Pulse' }} />
      <Drawer.Screen name="submit-question" options={{ title: 'Submit Question' }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
      <Drawer.Screen name="about" options={{ title: 'About' }} />
    </Drawer>
  );
}
