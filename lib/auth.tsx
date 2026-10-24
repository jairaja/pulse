import Storage from 'expo-sqlite/kv-store';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { clearLocalPulse, localGeneration, writeLocal } from './localReset';
import { collectClientDeviceEvidence } from './deviceIntegrity';
import { getInstallationCredential } from './installation';
import { invokeAction, prepareAction } from './actionVerification';
import { catalogs } from './locales/catalogs';
import { isLanguage, type Language } from './preferencesModel';
import { clearAuthStorage, supabase, supabaseConfigurationError } from './supabase';

type AuthResult = { ok: true } | { ok: false; message: string };

type AuthContextValue = {
  notice: string;
  dismissNotice: () => void;
  available: boolean;
  loading: boolean;
  nickname: string;
  session: Session | null;
  sendEmailCode: (email: string) => Promise<AuthResult>;
  setNickname: (nickname: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  verifyEmailCode: (email: string, token: string, importHistory: boolean, verify: (binding: string) => Promise<string>) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const nicknameKey = (userId: string) => `pulse.nickname.${userId}`;

function cleanEmail(email: string) {
  return email.trim().toLowerCase();
}

function cleanNickname(nickname: string) {
  return nickname.trim().replace(/\s+/g, ' ');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const ceremony = useRef<string | null>(null);
  const active = useRef<Session | null>(null);
  const pendingLogin = useRef<{ ceremony: string; email: string; session: Session; until: number } | null>(null);
  const flow = useRef(0);
  const resetPending = useRef<Promise<boolean> | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [bootLanguage, setBootLanguage] = useState<Language>('en');
  const bootCopy = (key: string) => catalogs[bootLanguage]?.[key] ?? key;
  const [notice, setNotice] = useState('');
  const [resetFailure, setResetFailure] = useState('');
  const [loading, setLoading] = useState(Boolean(supabase));
  const [session, setSession] = useState<Session | null>(null);
  const [nickname, setNicknameState] = useState('');

  const reset = useCallback((all = true): Promise<boolean> => {
    if (resetPending.current) return resetPending.current;
    const operation = (async () => {
      flow.current++; pendingLogin.current = null;
      active.current = null;
      setLoading(true); setSession(null); setNicknameState('');
      try {
        supabase?.auth.stopAutoRefresh();
        await queryClient.cancelQueries(); queryClient.clear();
        await clearAuthStorage(); await clearLocalPulse(all);
        setResetFailure(''); setLoading(false); return true;
      } catch { setResetFailure('Local data could not be cleared. Retry to reset Pulse on this device.'); return false; }
    })();
    resetPending.current = operation;
    void operation.finally(() => { resetPending.current = null; });
    return operation;
  }, [queryClient]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const restore = async () => {
      const epoch = flow.current; const generation = localGeneration();
      try {
        const preferences = JSON.parse(await Storage.getItem('pulse.preferences.device.v1') ?? 'null');
        if (mounted && isLanguage(preferences?.language)) setBootLanguage(preferences.language);
      } catch { /* A missing/corrupt preference must not expose private account data. */ }
      const { data } = await supabase!.auth.getSession();
      if (!mounted || epoch !== flow.current) return;
      if (!data.session) {
        if (await Storage.getItem('pulse.active-account')) await reset(); else setLoading(false);
        return;
      }
      const result = await supabase!.rpc('session_status');
      if (!mounted || epoch !== flow.current) return;
      if (result.error) return; // Offline: no private cache is rendered without verification.
      if (!result.data) {
        setNotice('Your account was signed out on this device. Pulse has reset here.');
        active.current = null;
        await supabase!.auth.signOut({ scope: 'local' }); await reset(); return;
      }
      await writeLocal('pulse.active-account', data.session.user.id, generation);
      if (!mounted || epoch !== flow.current) return;
      active.current = data.session; setSession(data.session); setLoading(false); void supabase!.auth.startAutoRefresh();
    };
    void restore().catch(() => undefined);
    const online = onlineManager.subscribe(connected => { if (connected && !active.current) void restore().catch(() => undefined); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      if (event === 'TOKEN_REFRESHED' && active.current && next?.user.id === active.current.user.id) {
        active.current = next; setSession(next);
      } else if (event === 'SIGNED_OUT' && active.current) { void reset(); }
      // SIGNED_IN is exposed only after the post-OTP CAPTCHA and atomic lease activation.
    });
    const app = AppState.addEventListener('change', phase => {
      if (phase === 'active') { supabase!.auth.startAutoRefresh(); if (!active.current) void restore().catch(() => undefined); }
      else if (Platform.OS !== 'web') supabase!.auth.stopAutoRefresh();
    });
    return () => { mounted = false; online(); listener.subscription.unsubscribe(); app.remove(); };
  }, [reset, restoreAttempt]);

  useEffect(() => {
    if (!session?.user.id || !supabase) return;
    let mounted = true;
    const check = async (touch = false) => {
      const { data, error } = await supabase!.rpc('session_status');
      if (!mounted || error) return;
      if (!data) { setNotice('Your account was signed out on this device. Pulse has reset here.'); active.current = null; await supabase!.auth.signOut({ scope: 'local' }); await reset(); }
      else if (touch) await supabase!.rpc('touch_account_session');
    };
    const timer = setInterval(() => { if (AppState.currentState === 'active') void check(); }, 15_000);
    const app = AppState.addEventListener('change', phase => { if (phase === 'active') void check(true); });
    const channel = supabase.channel(`account-session:${session.user.id}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'account_session_notices', filter: `user_id=eq.${session.user.id}`
    }, () => { void check(); }).subscribe();
    return () => { mounted = false; clearInterval(timer); app.remove(); void supabase!.removeChannel(channel); };
  }, [session?.user.id, reset]);

  useEffect(() => {
    let mounted = true;
    if (!session?.user.id) {
      return;
    }

    void Storage.getItem(nicknameKey(session.user.id)).then((storedNickname) => {
      if (mounted) setNicknameState(storedNickname ?? '');
    });
    return () => {
      mounted = false;
    };
  }, [session?.user.id]);

  const sendEmailCode = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) {
      return { ok: false, message: supabaseConfigurationError ?? 'Supabase is unavailable.' };
    }
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail(email))) {
      return { ok: false, message: 'Enter a valid email address.' };
    }

    try {
      const credential = await getInstallationCredential();
      const deviceEvidence = await collectClientDeviceEvidence();
      const data = await invokeAction('account', { operation: 'begin', email: cleanEmail(email), credential, deviceEvidence });
      if (typeof data?.ceremony !== 'string') throw new Error('Invalid sign-in response.');
      ceremony.current = data.ceremony; pendingLogin.current = null;
      return { ok: true };
    } catch {
      return { ok: false, message: 'Check your connection and try again.' };
    }
  }, []);

  const verifyEmailCode = useCallback(
    async (email: string, token: string, importHistory: boolean, verify: (binding: string) => Promise<string>): Promise<AuthResult> => {
      if (!supabase) {
        return { ok: false, message: supabaseConfigurationError ?? 'Supabase is unavailable.' };
      }
      if (!/^\d{6}$/.test(token.trim())) {
        return { ok: false, message: 'Enter the 6-digit code from your email.' };
      }

      try {
        if (!ceremony.current) return { ok: false, message: 'Request a new email code.' };
        const attemptFlow = flow.current;
        let data: { session: Session };
        const pending = pendingLogin.current;
        if (pending && pending.ceremony === ceremony.current && pending.email === cleanEmail(email) && pending.until > Date.now()) {
          data = { session: pending.session };
        } else {
          const credential = await getInstallationCredential(); const deviceEvidence = await collectClientDeviceEvidence();
          data = await invokeAction('account', { operation: 'verify', email: cleanEmail(email), token: token.trim(), ceremony: ceremony.current, credential, deviceEvidence });
          if (!data?.session?.access_token || !data.session.refresh_token) return { ok: false, message: 'Request a new email code.' };
          pendingLogin.current = { ceremony: ceremony.current, email: cleanEmail(email), session: data.session, until: Date.now() + 14 * 60_000 };
        }
        const proof = await prepareAction('login', [ceremony.current, importHistory], data.session.access_token);
        const captchaToken = await verify(proof.captchaBinding);
        if (attemptFlow !== flow.current) throw new Error('Sign-in was cancelled.');
        await invokeAction('account', { operation: 'complete', ceremony: ceremony.current, importHistory, ...proof, captchaToken }, data.session.access_token);
        const signedIn = await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
        if (signedIn.error || !signedIn.data.session) throw new Error('Sign in again.');
        setLoading(true);
        await queryClient.cancelQueries(); queryClient.clear(); await clearLocalPulse(false);
        await Storage.setItem('pulse.active-account', signedIn.data.session.user.id);
        pendingLogin.current = null;
        active.current = signedIn.data.session; setSession(signedIn.data.session); setLoading(false); void supabase.auth.startAutoRefresh();
        return { ok: true };
      } catch (error) {
        await supabase.auth.signOut({ scope: 'local' });
        return { ok: false, message: error instanceof Error ? error.message : 'Check your connection and try again.' };
      }
    },
    [queryClient]
  );

  const setNickname = useCallback(
    async (nextNickname: string): Promise<AuthResult> => {
      if (!session?.user.id) return { ok: false, message: 'Sign in before setting a nickname.' };
      const cleaned = cleanNickname(nextNickname);
      if (cleaned.length > 30) {
        return { ok: false, message: 'Keep your nickname to 30 characters or fewer.' };
      }

      const generation = localGeneration();
      if (cleaned) await writeLocal(nicknameKey(session.user.id), cleaned, generation);
      else await Storage.removeItem(nicknameKey(session.user.id));
      if (generation !== localGeneration()) return { ok: false, message: 'Sign in again.' };
      setNicknameState(cleaned);
      return { ok: true };
    },
    [session?.user.id]
  );

  const signOut = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) return { ok: false, message: 'Supabase is unavailable.' };
    try {
      await invokeAction('account', { operation: 'logout' });
      active.current = null;
      await supabase.auth.signOut({ scope: 'local' });
      const cleared = await reset();
      return cleared ? { ok: true } : { ok: false, message: 'Local data could not be cleared. Please retry.' };
    } catch {
      return { ok: false, message: 'Check your connection and try again.' };
    }
  }, [reset]);

  const value = useMemo<AuthContextValue>(
    () => ({
      notice, dismissNotice: () => setNotice(''),
      available: Boolean(supabase),
      loading,
      nickname,
      session,
      sendEmailCode,
      setNickname,
      signOut,
      verifyEmailCode
    }),
    [loading, nickname, notice, sendEmailCode, session, setNickname, signOut, verifyEmailCode]
  );

  return <AuthContext.Provider value={value}>{loading ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 }}>
    <ActivityIndicator /><Text>{bootCopy(resetFailure || 'Checking your secure session… Reconnect if you are offline.')}</Text>
    <Pressable accessibilityRole="button" onPress={() => resetFailure ? void reset() : setRestoreAttempt(value => value + 1)} style={{ minHeight: 48, padding: 16 }}><Text>{bootCopy(resetFailure ? 'Retry reset' : 'Retry')}</Text></Pressable>
  </View> : children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
