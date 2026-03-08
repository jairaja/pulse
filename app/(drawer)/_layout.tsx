import { Drawer } from 'expo-router/drawer';

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerStyle: { backgroundColor: '#05070f' },
        headerTintColor: '#eff3ff',
        drawerStyle: { backgroundColor: '#0d1324' },
        drawerActiveTintColor: '#00f6ff',
        drawerInactiveTintColor: '#99a8cc',
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
