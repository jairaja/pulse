import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../lib/auth';
import { useAppTheme, type ThemeColors, type ThemePreference } from '../lib/theme';
import {
  checkSupabaseConnection,
  supabaseConfigurationError
} from '../lib/supabase';

type ConnectionState =
  | { status: 'checking'; message: string }
  | { status: 'connected'; message: string }
  | { status: 'error'; message: string };

const themeOptions: Array<{ label: string; value: ThemePreference }> = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: "System's theme", value: 'system' }
];

export default function SettingsScreen() {
  const router = useRouter();
  const { loading: authLoading, nickname, session } = useAuth();
  const { colors, preference, resolvedTheme, setPreference } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [connection, setConnection] = useState<ConnectionState>(() =>
    supabaseConfigurationError
      ? { status: 'error', message: supabaseConfigurationError }
      : { status: 'checking', message: 'Checking the read-only API…' }
  );

  const verifyConnection = useCallback(async () => {
    setConnection({ status: 'checking', message: 'Checking the read-only API…' });
    const result = await checkSupabaseConnection();
    setConnection(
      result.ok
        ? { status: 'connected', message: 'Connected to the PULSE database.' }
        : { status: 'error', message: result.message }
    );
  }, []);

  useEffect(() => {
    if (!supabaseConfigurationError) void verifyConnection();
  }, [verifyConnection]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.eyebrow}>APPEARANCE</Text>
          <Text style={styles.title}>Choose how PULSE looks.</Text>
          <View accessibilityRole="radiogroup" style={styles.options}>
            {themeOptions.map((option) => {
              const selected = preference === option.value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={option.value}
                  onPress={() => setPreference(option.value)}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && styles.optionPressed
                  ]}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.note}>
            Active theme: {resolvedTheme}. System follows your device and changes automatically.
          </Text>
        </View>

        <View style={styles.accountCard}>
          <Text style={styles.eyebrow}>ACCOUNT</Text>
          <Text style={styles.connectionTitle}>
            {authLoading
              ? 'Checking this device…'
              : session
                ? nickname || 'Your Pulse is connected'
                : 'Using PULSE without an account'}
          </Text>
          <Text style={styles.connectionMessage}>
            {session
              ? session.user.email
              : 'Sign in with an email code to keep future server-confirmed history and questions across devices.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={authLoading}
            onPress={() => router.push({ pathname: '/account', params: { source: 'settings' } })}
            style={({ pressed }) => [
              styles.accountButton,
              authLoading && styles.retryButtonDisabled,
              pressed && styles.optionPressed
            ]}
          >
            <Text style={styles.accountButtonText}>
              {session ? 'Manage account' : 'Sign in or create account'}
            </Text>
          </Pressable>
          {!session ? <Text style={styles.note}>Optional, always.</Text> : null}
        </View>

        <View style={styles.connectionCard}>
          <View style={styles.connectionHeading}>
            <Text style={styles.eyebrow}>DATABASE</Text>
            <View
              style={[
                styles.statusDot,
                connection.status === 'connected' && styles.statusDotConnected,
                connection.status === 'error' && styles.statusDotError
              ]}
            />
          </View>
          <Text style={styles.connectionTitle}>
            {connection.status === 'checking'
              ? 'Checking connection'
              : connection.status === 'connected'
                ? 'Supabase connected'
                : 'Supabase needs attention'}
          </Text>
          <Text accessibilityLiveRegion="polite" style={styles.connectionMessage}>
            {connection.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={connection.status === 'checking'}
            onPress={() => void verifyConnection()}
            style={({ pressed }) => [
              styles.retryButton,
              connection.status === 'checking' && styles.retryButtonDisabled,
              pressed && styles.optionPressed
            ]}
          >
            <Text style={styles.retryButtonText}>Check again</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.canvas, flex: 1 },
    content: { gap: 30, padding: 24, paddingBottom: 48 },
    section: { gap: 16 },
    eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
    title: { color: colors.ink, fontSize: 30, fontWeight: '700', letterSpacing: -0.6, lineHeight: 37 },
    options: { gap: 10 },
    option: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 14,
      minHeight: 58,
      paddingHorizontal: 18
    },
    optionSelected: { backgroundColor: colors.activeSurface, borderColor: colors.accent },
    optionPressed: { opacity: 0.78 },
    optionText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
    optionTextSelected: { color: colors.accent, fontWeight: '800' },
    radio: {
      alignItems: 'center',
      borderColor: colors.muted,
      borderRadius: 10,
      borderWidth: 2,
      height: 20,
      justifyContent: 'center',
      width: 20
    },
    radioSelected: { borderColor: colors.accent },
    radioDot: { backgroundColor: colors.accent, borderRadius: 5, height: 10, width: 10 },
    note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    connectionCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: 12,
      padding: 20
    },
    accountCard: {
      backgroundColor: colors.activeSurface,
      borderRadius: 24,
      gap: 12,
      padding: 20
    },
    accountButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 15,
      justifyContent: 'center',
      minHeight: 52
    },
    accountButtonText: { color: colors.onPrimary, fontSize: 14, fontWeight: '800' },
    connectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    connectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '700' },
    connectionMessage: { color: colors.body, fontSize: 14, lineHeight: 21 },
    statusDot: { backgroundColor: colors.muted, borderRadius: 6, height: 12, width: 12 },
    statusDotConnected: { backgroundColor: '#3B9A67' },
    statusDotError: { backgroundColor: '#C95B55' },
    retryButton: {
      alignItems: 'center',
      borderColor: colors.accent,
      borderRadius: 15,
      borderWidth: 1,
      justifyContent: 'center',
      marginTop: 4,
      minHeight: 50
    },
    retryButtonDisabled: { opacity: 0.45 },
    retryButtonText: { color: colors.accent, fontSize: 14, fontWeight: '800' }
  });
}
