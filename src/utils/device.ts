import * as Application from 'expo-application';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'pulse-identity' });
const DEVICE_ID_KEY = 'pulse-device-id';

function getHardwareFingerprint() {
  const nativeStableId = Application.getAndroidId?.() || Application.applicationId || 'unknown-device';
  const vendorScopedId = Application.applicationName || 'pulse';
  return `${nativeStableId}:${vendorScopedId}`;
}

export function getOrCreateDeviceId() {
  const existing = storage.getString(DEVICE_ID_KEY);
  if (existing) return existing;

  const stableFingerprint = getHardwareFingerprint();
  storage.set(DEVICE_ID_KEY, stableFingerprint);
  return stableFingerprint;
}
