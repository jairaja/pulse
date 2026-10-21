import * as SystemUI from 'expo-system-ui';
import { createContext, type ReactNode, useContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { usePreferences } from './preferences';
import type { ThemePreference } from './preferencesModel';
export type { ThemePreference } from './preferencesModel';
export type ResolvedTheme = 'light' | 'dark';

export type ThemeColors = {
  accent: string;
  activeSurface: string;
  body: string;
  border: string;
  canvas: string;
  control: string;
  disabledBorder: string;
  disabledSurface: string;
  disabledText: string;
  ink: string;
  muted: string;
  onPrimary: string;
  primary: string;
  surface: string;
};

const palettes: Record<ResolvedTheme, ThemeColors> = {
  light: {
    accent: '#315FC7',
    activeSurface: '#E1E5ED',
    body: '#565853',
    border: '#D6D2C9',
    canvas: '#E9EAE6',
    control: '#FAF9F6',
    disabledBorder: '#C8C5BD',
    disabledSurface: '#DFDED8',
    disabledText: '#777872',
    ink: '#1B1C1A',
    muted: '#6F716C',
    onPrimary: '#FAF9F6',
    primary: '#1B1C1A',
    surface: '#F3F1EC'
  },
  dark: {
    accent: '#9CB5FF',
    activeSurface: '#28354E',
    body: '#C5C7C0',
    border: '#393D37',
    canvas: '#151714',
    control: '#292D28',
    disabledBorder: '#454A43',
    disabledSurface: '#2A2D29',
    disabledText: '#90948C',
    ink: '#F3F1EC',
    muted: '#A8AAA4',
    onPrimary: '#151714',
    primary: '#F3F1EC',
    surface: '#20231F'
  }
};

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemTheme = useColorScheme();
  const { preferences, set } = usePreferences();
  const preference = preferences.theme;

  const resolvedTheme: ResolvedTheme =
    preference === 'system' ? (systemTheme === 'dark' ? 'dark' : 'light') : preference;
  const colors = palettes[resolvedTheme];

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.canvas);
  }, [colors.canvas]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      isDark: resolvedTheme === 'dark',
      preference,
      resolvedTheme,
      setPreference: (nextPreference) => {
        set({ theme: nextPreference });
      }
    }),
    [colors, preference, resolvedTheme, set]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used inside AppThemeProvider.');
  return context;
}
