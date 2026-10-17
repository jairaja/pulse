import Storage from 'expo-sqlite/kv-store';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { claimAccountHistory } from './pulseApi';
import { supabase, supabaseConfigurationError } from './supabase';

type AuthResult = { ok: true } | { ok: false; message: string };

type AuthContextValue = {
  available: boolean;
  loading: boolean;
  nickname: string;
  session: Session | null;
  sendEmailCode: (email: string) => Promise<AuthResult>;
  setNickname: (nickname: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  verifyEmailCode: (email: string, token: string) => Promise<AuthResult>;
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
  const [loading, setLoading] = useState(Boolean(supabase));
  const [session, setSession] = useState<Session | null>(null);
  const [nickname, setNicknameState] = useState('');

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setLoading(false);
      }
    });

    const appStateListener =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', (state) => {
            if (state === 'active') supabase!.auth.startAutoRefresh();
            else supabase!.auth.stopAutoRefresh();
          });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      appStateListener?.remove();
    };
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    // Sync is idempotent and server-authoritative. Authentication remains usable if it fails.
    void claimAccountHistory().catch(() => undefined);
  }, [session?.user.id]);

  useEffect(() => {
    let mounted = true;
    if (!session?.user.id) {
      setNicknameState('');
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
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail(email),
        options: { shouldCreateUser: true }
      });
      return error
        ? { ok: false, message: 'We could not send a code. Wait a moment and try again.' }
        : { ok: true };
    } catch {
      return { ok: false, message: 'Check your connection and try again.' };
    }
  }, []);

  const verifyEmailCode = useCallback(
    async (email: string, token: string): Promise<AuthResult> => {
      if (!supabase) {
        return { ok: false, message: supabaseConfigurationError ?? 'Supabase is unavailable.' };
      }
      if (!/^\d{6}$/.test(token.trim())) {
        return { ok: false, message: 'Enter the 6-digit code from your email.' };
      }

      try {
        const { error } = await supabase.auth.verifyOtp({
          email: cleanEmail(email),
          token: token.trim(),
          type: 'email'
        });
        return error
          ? { ok: false, message: 'That code is invalid or expired. Request a new code.' }
          : { ok: true };
      } catch {
        return { ok: false, message: 'Check your connection and try again.' };
      }
    },
    []
  );

  const setNickname = useCallback(
    async (nextNickname: string): Promise<AuthResult> => {
      if (!session?.user.id) return { ok: false, message: 'Sign in before setting a nickname.' };
      const cleaned = cleanNickname(nextNickname);
      if (cleaned.length > 30) {
        return { ok: false, message: 'Keep your nickname to 30 characters or fewer.' };
      }

      if (cleaned) await Storage.setItem(nicknameKey(session.user.id), cleaned);
      else await Storage.removeItem(nicknameKey(session.user.id));
      setNicknameState(cleaned);
      return { ok: true };
    },
    [session?.user.id]
  );

  const signOut = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) return { ok: false, message: 'Supabase is unavailable.' };
    const userId = session?.user.id;
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) return { ok: false, message: 'Could not log out. Please try again.' };
      if (userId) await Storage.removeItem(nicknameKey(userId));
      setNicknameState('');
      setSession(null);
      return { ok: true };
    } catch {
      return { ok: false, message: 'Check your connection and try again.' };
    }
  }, [session?.user.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      available: Boolean(supabase),
      loading,
      nickname,
      session,
      sendEmailCode,
      setNickname,
      signOut,
      verifyEmailCode
    }),
    [loading, nickname, sendEmailCode, session, setNickname, signOut, verifyEmailCode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
