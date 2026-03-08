import * as Notifications from 'expo-notifications';

export async function registerForPushToken() {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}
