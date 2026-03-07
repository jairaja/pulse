import { create } from 'zustand';

export type ThemeMode = 'system' | 'dark' | 'light';

type SettingsState = {
  country: string;
  language: string;
  theme: ThemeMode;
  setCountry: (country: string) => void;
  setLanguage: (language: string) => void;
  setTheme: (theme: ThemeMode) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  country: 'GB',
  language: 'en',
  theme: 'system',
  setCountry: (country) => set({ country }),
  setLanguage: (language) => set({ language }),
  setTheme: (theme) => set({ theme })
}));
