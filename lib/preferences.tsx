import Storage from 'expo-sqlite/kv-store';
import { onlineManager } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { useAuth } from './auth';
import { createPreferenceController, type PreferenceSnapshot } from './preferenceController';
import { preferenceRemote } from './preferenceApi';
import { DEFAULT_PREFERENCES, type PreferencePatch } from './preferencesModel';

type Value = PreferenceSnapshot & { set: (patch: PreferencePatch) => void; retry: () => void };
const Context = createContext<Value | null>(null);
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const owner = session?.user.id ?? null;
  const [state, setState] = useState<PreferenceSnapshot & { owner: string | null }>({
    owner: null, preferences: DEFAULT_PREFERENCES, status: 'loading'
  });
  const controller = useRef<ReturnType<typeof createPreferenceController> | null>(null);
  useEffect(() => {
    if (loading) return;
    const next = createPreferenceController({ owner, scope: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'unconfigured',
      storage: Storage, remote: preferenceRemote, changed: snapshot => setState({ ...snapshot, owner }) });
    controller.current = next;
    void next.start();
    const unsubscribe = onlineManager.subscribe(online => { if (online) void next.refresh(); });
    const app = AppState.addEventListener('change', phase => { if (phase === 'active') void next.refresh(); });
    return () => { next.stop(); unsubscribe(); app.remove(); controller.current = null; };
  }, [loading, owner]);
  const status = loading || state.owner !== owner ? 'loading' : state.status;
  return <Context.Provider value={{ preferences: state.preferences, status,
    set: patch => { if (status !== 'loading') void controller.current?.set(patch); },
    retry: () => { void controller.current?.refresh(); } }}>{children}</Context.Provider>;
}
export function usePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error('PreferencesProvider is required.');
  return value;
}
