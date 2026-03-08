import { create } from 'zustand';
import { DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from '@/constants/defaults';
import { ThemeMode } from '@/types/domain';

interface SessionState {
  userId?: string;
  deviceId?: string;
  anonymousUuid?: string;
  countryCode: string;
  languageCode: string;
  themeMode: ThemeMode;
  setIdentity: (params: {
    userId: string;
    deviceId: string;
    anonymousUuid: string;
  }) => void;
  setPreferences: (params: {
    countryCode?: string;
    languageCode?: string;
    themeMode?: ThemeMode;
  }) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  countryCode: DEFAULT_COUNTRY,
  languageCode: DEFAULT_LANGUAGE,
  themeMode: 'system',
  setIdentity: ({ userId, deviceId, anonymousUuid }) =>
    set({ userId, deviceId, anonymousUuid }),
  setPreferences: ({ countryCode, languageCode, themeMode }) =>
    set((state) => ({
      countryCode: countryCode ?? state.countryCode,
      languageCode: languageCode ?? state.languageCode,
      themeMode: themeMode ?? state.themeMode,
    })),
}));
