import { Drawer } from 'expo-router/drawer';

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerStyle: { backgroundColor: '#0B0F1A' },
        headerTintColor: '#FFFFFF',
        drawerStyle: { backgroundColor: '#0B0F1A' },
        drawerActiveTintColor: '#00E6FF',
        drawerInactiveTintColor: '#A3AEC2'
      }}
    >
      <Drawer.Screen name="index" options={{ title: 'Home' }} />
      <Drawer.Screen name="history/index" options={{ title: 'History' }} />
      <Drawer.Screen name="my-pulse/index" options={{ title: 'My Pulse' }} />
      <Drawer.Screen name="submit-question/index" options={{ title: 'Submit Question' }} />
      <Drawer.Screen name="settings/index" options={{ title: 'Settings' }} />
      <Drawer.Screen name="about/index" options={{ title: 'About' }} />
    </Drawer>
  );
}
