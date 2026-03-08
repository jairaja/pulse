import { create } from 'zustand';

type ThemeMode = 'system' | 'dark' | 'light';

type AppState = {
  deviceId: string;
  countryCode: string;
  languageCode: string;
  theme: ThemeMode;
  isOnline: boolean;
  setOnline: (value: boolean) => void;
  setTheme: (value: ThemeMode) => void;
  setLanguage: (value: string) => void;
  setCountry: (value: string) => void;
};

export const useAppStore = create<AppState>((set) => ({
  deviceId: 'anonymous-device-id',
  countryCode: 'GB',
  languageCode: 'en',
  theme: 'system',
  isOnline: true,
  setOnline: (value) => set({ isOnline: value }),
  setTheme: (value) => set({ theme: value }),
  setLanguage: (value) => set({ languageCode: value }),
  setCountry: (value) => set({ countryCode: value })
}));
