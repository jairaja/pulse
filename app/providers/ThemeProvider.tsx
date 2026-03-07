import { PropsWithChildren } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useSettingsStore } from '@/stores/settingsStore';

export function ThemeProvider({ children }: PropsWithChildren) {
  const theme = useSettingsStore((state) => state.theme);
  return (
    <>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      {children}
    </>
  );
}
