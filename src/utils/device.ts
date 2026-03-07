import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

const DEVICE_ID_KEY = 'pulse-device-id';

export async function getOrCreateDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const fallback = `${Device.osName}-${Device.osVersion}-${Date.now()}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, fallback);
  return fallback;
}
