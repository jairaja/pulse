import { supabase } from './supabase';
import { parsePreferences, type Preferences, type PreferencePatch } from './preferencesModel';

async function call(name: string, owner: string, values: Record<string, unknown> = {}): Promise<Preferences> {
  if (!supabase) throw new Error('Account preference sync is unavailable.');
  const { data, error } = await supabase.rpc(name, { p_expected_user: owner, ...values });
  if (error) throw new Error('Account preferences could not be synchronized.');
  const preferences = parsePreferences(data);
  if (!preferences) throw new Error('Invalid account preference response.');
  return preferences;
}
export const preferenceRemote = {
  ensure: (owner: string, initial: Preferences) => call('ensure_user_preferences', owner,
    { p_language: initial.language, p_theme: initial.theme }),
  patch: (owner: string, patch: PreferencePatch) => call('update_user_preferences', owner,
    { p_language: patch.language ?? null, p_theme: patch.theme ?? null })
};
