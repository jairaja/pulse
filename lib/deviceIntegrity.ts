import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export type ClientDeviceEvidence = {
  platform: 'android' | 'ios';
  deviceIdentifier: string;
  deviceType: 'phone' | 'tablet';
  isPhysicalDevice: true;
  isRooted: false;
  model: string | null;
  osBuild: string | null;
};

export class IneligibleDeviceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IneligibleDeviceError';
  }
}

/**
 * Adds friction before server attestation is available. Every value here is client-controlled and
 * must be treated as a signal, never as authorization. Raw identifiers are sent only to the vote
 * gateway, which HMACs them with a server secret before database storage.
 */
export async function collectClientDeviceEvidence(): Promise<ClientDeviceEvidence> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    throw new IneligibleDeviceError('Voting is available only in the iOS and Android apps.');
  }
  if (!Device.isDevice) {
    throw new IneligibleDeviceError('Voting is not available on simulators or emulators.');
  }

  const type = await Device.getDeviceTypeAsync();
  if (type !== Device.DeviceType.PHONE && type !== Device.DeviceType.TABLET) {
    throw new IneligibleDeviceError('Voting requires a supported physical phone or tablet.');
  }

  let rooted: boolean;
  try {
    rooted = await Device.isRootedExperimentalAsync();
  } catch {
    throw new IneligibleDeviceError('This device could not complete the security check.');
  }
  if (rooted) {
    throw new IneligibleDeviceError('Voting is unavailable on rooted or jailbroken devices.');
  }

  const deviceIdentifier = Platform.OS === 'android'
    ? Application.getAndroidId()
    : await Application.getIosIdForVendorAsync();
  if (!deviceIdentifier) {
    throw new IneligibleDeviceError('A device identifier is temporarily unavailable. Unlock the device and try again.');
  }

  return {
    platform: Platform.OS,
    deviceIdentifier,
    deviceType: type === Device.DeviceType.PHONE ? 'phone' : 'tablet',
    isPhysicalDevice: true,
    isRooted: false,
    model: Device.modelId ?? Device.modelName,
    osBuild: Device.osBuildId,
  };
}
