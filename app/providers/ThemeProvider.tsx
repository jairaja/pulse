import { PropsWithChildren } from 'react';
import { StatusBar } from 'expo-status-bar';

export function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <>
      <StatusBar style="dark" />
      {children}
    </>
  );
}
