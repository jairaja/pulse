export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', english: 'English', rtl: false },
  { code: 'zh-Hans', name: '简体中文', english: 'Mandarin Chinese', rtl: false },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi', rtl: false },
  { code: 'es', name: 'Español', english: 'Spanish', rtl: false },
  { code: 'ar', name: 'العربية', english: 'Modern Standard Arabic', rtl: true },
  { code: 'fr', name: 'Français', english: 'French', rtl: false },
  { code: 'bn', name: 'বাংলা', english: 'Bengali', rtl: false },
  { code: 'pt', name: 'Português', english: 'Portuguese', rtl: false },
  { code: 'ru', name: 'Русский', english: 'Russian', rtl: false },
  { code: 'ur', name: 'اردو', english: 'Urdu', rtl: true }
] as const;
export type Language = typeof SUPPORTED_LANGUAGES[number]['code'];
export type ThemePreference = 'light' | 'dark' | 'system';
export type Preferences = { language: Language; theme: ThemePreference };
export type PreferencePatch = Partial<Preferences>;
export const DEFAULT_PREFERENCES: Preferences = { language: 'en', theme: 'system' };
export function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.some(language => language.code === value);
}
export function isTheme(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}
export function parsePreferences(value: unknown): Preferences | null {
  if (!value || typeof value !== 'object') return null;
  const prefs = value as Partial<Preferences>;
  return isLanguage(prefs.language) && isTheme(prefs.theme) ? { language: prefs.language, theme: prefs.theme } : null;
}
export function parsePatch(value: unknown): PreferencePatch {
  if (!value || typeof value !== 'object') return {};
  const patch = value as PreferencePatch;
  return { ...(isLanguage(patch.language) ? { language: patch.language } : {}), ...(isTheme(patch.theme) ? { theme: patch.theme } : {}) };
}
