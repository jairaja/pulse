import { DEFAULT_PREFERENCES, isTheme, parsePatch, parsePreferences, type Preferences, type PreferencePatch } from './preferencesModel';

export type PreferenceStatus = 'loading' | 'device' | 'synced' | 'pending';
export type PreferenceSnapshot = { preferences: Preferences; status: PreferenceStatus };
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };
type Remote = { ensure(owner: string, initial: Preferences): Promise<Preferences>; patch(owner: string, patch: PreferencePatch): Promise<Preferences> };
export function createPreferenceController({ owner, scope, storage, remote, changed }: {
  owner: string | null; scope: string; storage: Storage; remote: Remote; changed: (snapshot: PreferenceSnapshot) => void;
}) {
  const deviceKey = 'pulse.preferences.device.v1';
  const accountKey = `pulse.preferences.account.v1.${encodeURIComponent(scope)}.${owner}`;
  let preferences = { ...DEFAULT_PREFERENCES };
  let pending: PreferencePatch = {};
  let deviceReadFailed = false;
  let stopped = false;
  let ready = false;
  let chain: Promise<void> = Promise.resolve();
  const emit = (status: PreferenceStatus) => { if (!stopped) changed({ preferences: { ...preferences }, status }); };
  async function persist() {
    if (stopped) return;
    if (!deviceReadFailed) await storage.setItem(deviceKey, JSON.stringify(preferences));
    if (owner) await storage.setItem(accountKey, JSON.stringify({ preferences, pending }));
  }
  async function synchronize() {
    if (stopped || !ready) return;
    if (!owner) {
      if (deviceReadFailed) {
        try {
          const saved = await storage.getItem(deviceKey);
          try { preferences = parsePreferences(JSON.parse(saved ?? 'null')) ?? preferences; } catch { /* Invalid cache uses defaults. */ }
          deviceReadFailed = false;
        } catch { emit('pending'); return; }
      }
      try { await persist(); emit('device'); } catch { emit('pending'); }
      return;
    }
    try {
      // Ensure never overwrites a preference row already created on another device.
      const remotePreferences = await remote.ensure(owner, preferences);
      if (stopped) return;
      const sent = { ...pending };
      const result = Object.keys(sent).length ? await remote.patch(owner, sent) : remotePreferences;
      if (stopped) return;
      for (const key of ['language', 'theme'] as const) {
        if (pending[key] === sent[key]) delete pending[key];
      }
      preferences = { ...result, ...pending };
      deviceReadFailed = false;
      await persist();
      emit(Object.keys(pending).length ? 'pending' : 'synced');
    } catch {
      if (!stopped) { await persist().catch(() => undefined); emit('pending'); }
    }
  }
  function queue(work: () => Promise<void>) {
    chain = chain.catch(() => undefined).then(work);
    return chain;
  }
  return {
    start: () => queue(async () => {
      try {
        const saved = await storage.getItem(deviceKey);
        if (saved) {
          try { preferences = parsePreferences(JSON.parse(saved)) ?? preferences; } catch { /* Invalid cached JSON uses defaults. */ }
        }
        else {
          const oldTheme = await storage.getItem('pulse.theme-preference');
          if (isTheme(oldTheme)) preferences.theme = oldTheme;
        }
      } catch { deviceReadFailed = true; /* Never overwrite unreadable device preferences with defaults. */ }
      // Read the independent account cache even if the device cache is corrupt/unavailable.
      if (owner) {
        try {
          const cached = await storage.getItem(accountKey);
          if (cached) {
            const value = JSON.parse(cached);
            preferences = parsePreferences(value.preferences) ?? preferences;
            pending = parsePatch(value.pending);
          }
        } catch { /* A valid server preference remains authoritative. */ }
      }
      if (stopped) return;
      ready = true;
      emit(owner ? 'loading' : 'device');
      await synchronize();
    }),
    set: (patch: PreferencePatch) => {
      const valid = parsePatch(patch);
      if (stopped || !ready || Object.keys(valid).length === 0) return Promise.resolve();
      deviceReadFailed = false;
      preferences = { ...preferences, ...valid };
      if (owner) pending = { ...pending, ...valid };
      emit(owner ? 'pending' : 'device');
      return queue(async () => { await persist().catch(() => undefined); await synchronize(); });
    },
    refresh: () => queue(synchronize),
    stop: () => { stopped = true; }
  };
}
