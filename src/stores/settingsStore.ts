import { create } from 'zustand';

type SettingsState = {
  country: string;
  language: string;
  setCountry: (country: string) => void;
  setLanguage: (language: string) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  country: 'GB',
  language: 'en',
  setCountry: (country) => set({ country }),
  setLanguage: (language) => set({ language })
}));
