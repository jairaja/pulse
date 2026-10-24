import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function configurationError(): string | null {
  if (!supabaseUrl || !supabasePublishableKey) {
    return 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the root .env file.';
  }

  try {
    const parsedUrl = new URL(supabaseUrl);
    const isLocal = parsedUrl.hostname === '127.0.0.1' || parsedUrl.hostname === 'localhost';
    if (parsedUrl.protocol !== 'https:' && !isLocal) return 'The Supabase URL must use HTTPS.';
  } catch {
    return 'EXPO_PUBLIC_SUPABASE_URL is not a valid URL.';
  }

  if (!supabasePublishableKey.startsWith('sb_publishable_')) {
    return 'Use the current sb_publishable_ key, not a secret, service-role, or legacy anon key.';
  }

  return null;
}

export const supabaseConfigurationError = configurationError();
export const AUTH_STORAGE_KEY = (() => { try { return `sb-${new URL(supabaseUrl!).hostname.split('.')[0]}-auth-token`; } catch { return 'sb-unconfigured-auth-token'; } })();
export async function clearAuthStorage() {
  await Promise.all([AUTH_STORAGE_KEY, `${AUTH_STORAGE_KEY}-code-verifier`, `${AUTH_STORAGE_KEY}-user`].map(key => Storage.removeItem(key)));
}


export const supabase: SupabaseClient | null = supabaseConfigurationError
  ? null
  : createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        storage: Storage,
        storageKey: AUTH_STORAGE_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });

export async function checkSupabaseConnection(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  if (!supabase) {
    return { ok: false, message: supabaseConfigurationError ?? 'Supabase is not configured.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const { error } = await supabase
      .rpc('get_today_question', { p_language_code: 'en' })
      .abortSignal(controller.signal);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The connection check failed.';
    return { ok: false, message };
  } finally {
    clearTimeout(timeout);
  }
}
