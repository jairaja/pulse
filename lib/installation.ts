import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const INSTALLATION_CREDENTIAL_KEY = 'pulse.installation-credential.v1';

export async function getInstallationCredential() {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error('Secure device storage is unavailable. Voting is disabled on this device.');
  }

  const existing = await SecureStore.getItemAsync(INSTALLATION_CREDENTIAL_KEY);
  if (existing) return existing;

  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const credential = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(INSTALLATION_CREDENTIAL_KEY, credential, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
  return credential;
}
