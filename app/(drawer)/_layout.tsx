import { Drawer } from 'expo-router/drawer';

export default function DrawerLayout() {
  return (
    <Drawer screenOptions={{ headerShown: false }}>
      <Drawer.Screen name="index" options={{ title: 'Home' }} />
      <Drawer.Screen name="history" options={{ title: 'History' }} />
      <Drawer.Screen name="my-pulse" options={{ title: 'My Pulse' }} />
      <Drawer.Screen name="submit-question" options={{ title: 'Submit Question' }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
      <Drawer.Screen name="about" options={{ title: 'About' }} />
    </Drawer>
  );
}
