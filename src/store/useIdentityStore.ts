import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nanoid } from 'nanoid/non-secure';

type IdentityState = {
  anonymousId: string;
  deviceId: string;
  countryCode: string;
  language: string;
  theme: 'system' | 'dark' | 'light';
  init: () => void;
  setCountryCode: (code: string) => void;
  setLanguage: (language: string) => void;
  setTheme: (theme: IdentityState['theme']) => void;
};

export const useIdentityStore = create<IdentityState>()(
  persist(
    (set, get) => ({
      anonymousId: '',
      deviceId: '',
      countryCode: process.env.EXPO_PUBLIC_DEFAULT_COUNTRY ?? 'GB',
      language: 'en',
      theme: 'system',
      init: () => {
        if (!get().anonymousId) {
          set({ anonymousId: nanoid(20), deviceId: nanoid(16) });
        }
      },
      setCountryCode: (countryCode) => set({ countryCode }),
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'pulse-identity', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
