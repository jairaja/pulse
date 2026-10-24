import Storage from 'expo-sqlite/kv-store';
let generation = 0;
const writes = new Set<Promise<unknown>>();
export const localGeneration = () => generation;
export function writeLocal(key: string, value: string, expectedGeneration = generation) {
  if (expectedGeneration !== generation) return Promise.resolve();
  const operation = Storage.setItem(key, value);
  writes.add(operation);
  void operation.finally(() => writes.delete(operation)).catch(() => undefined);
  return operation;
}
export async function clearLocalPulse(includePreferences = true) {
  generation++;
  // Drain writes already handed to native storage before deleting. Later stale writes are rejected above.
  await Promise.allSettled([...writes]);
  const keys = await Storage.getAllKeys();
  await Promise.all(keys.filter(key => key.startsWith('pulse.') &&
    (includePreferences || (!key.startsWith('pulse.preferences.') && key !== 'pulse.theme-preference')))
    .map(key => Storage.removeItem(key)));
  // SecureStore installation credential intentionally survives UI reset; server anti-abuse data survives too.
}
