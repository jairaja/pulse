import { useCallback } from 'react';
import { Text as NativeText, StyleSheet, type TextProps } from 'react-native';

import { usePreferences } from './preferences';
import { SUPPORTED_LANGUAGES, type Language } from './preferencesModel';
import { catalogs } from './locales/catalogs';

export type TranslationValues = Record<string, string | number>;
export function translate(language: Language, source: string, values: TranslationValues = {}) {
  const message = catalogs[language]?.[source] ?? source;
  return message.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}
export function localeFor(language: Language) { return language; }
export function useI18n() {
  const { preferences } = usePreferences();
  const language = preferences.language;
  const t = useCallback((source: string, values?: TranslationValues) => translate(language, source, values), [language]);
  const rtl = SUPPORTED_LANGUAGES.find(item => item.code === language)?.rtl ?? false;
  return { t, language, locale: localeFor(language), direction: rtl ? 'rtl' as const : 'ltr' as const };
}
export function AppText({ style, ...props }: TextProps) {
  const { direction } = useI18n();
  const { preferences } = usePreferences();
  const flat = StyleSheet.flatten(style);
  const size = preferences.largerText ? { fontSize: (flat?.fontSize ?? 14) * 1.25, ...(flat?.lineHeight ? { lineHeight: flat.lineHeight * 1.25 } : {}) } : {};
  return <NativeText {...props} allowFontScaling style={[{ writingDirection: direction, textAlign: direction === 'rtl' ? 'right' : 'auto' }, style, size]} />;
}
