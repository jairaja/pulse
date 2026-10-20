import { useI18n, AppText as Text } from '../lib/i18n';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SUPPORTED_LANGUAGES } from '../lib/preferencesModel';
import { usePreferences } from '../lib/preferences';
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

const themeOptions: { label: string; value: ThemePreference }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: "System's theme", value: 'system' }
];

export default function SettingsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { preferences, status: preferenceStatus, set: setPreferences, retry: retryPreferences } = usePreferences();
  const { loading: authLoading, nickname, session } = useAuth();
  const { colors, preference, resolvedTheme, setPreference } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [connection, setConnection] = useState<ConnectionState>(() =>
    supabaseConfigurationError
      ? { status: 'error', message: supabaseConfigurationError }
      : { status: 'checking', message: 'Checking the read-only API…' }
  );

  const [connectionAttempt, setConnectionAttempt] = useState(0);

  function verifyConnection() {
    setConnection({ status: 'checking', message: 'Checking the read-only API…' });
    setConnectionAttempt((attempt) => attempt + 1);
  }

  useEffect(() => {
    let active = true;
    void checkSupabaseConnection().then((result) => {
      if (!active) return;
      setConnection(result.ok
        ? { status: 'connected', message: 'Connected to the PULSE database.' }
        : { status: 'error', message: result.message });
    });
    return () => { active = false; };
  }, [connectionAttempt]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.eyebrow}>{t("APPEARANCE")}</Text>
          <Text style={styles.title}>{t("Choose how PULSE looks.")}</Text>
          <View accessibilityRole="radiogroup" style={styles.options}>
            {themeOptions.map((option) => {
              const selected = preference === option.value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={option.value}
                  disabled={preferenceStatus === 'loading'}
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
                    {t(option.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.note}>{t('Active theme: {theme}. System follows your device.', { theme: t(resolvedTheme === 'light' ? 'Light' : 'Dark') })}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.eyebrow}>{t('LANGUAGE')}</Text>
          <Text style={styles.title}>{t('Choose your language')}</Text>
          <View accessibilityRole="radiogroup" style={styles.options}>
            {SUPPORTED_LANGUAGES.map(language => <Pressable key={language.code} accessibilityRole="radio"
              accessibilityState={{ checked: preferences.language === language.code, disabled: preferenceStatus === 'loading' }}
              disabled={preferenceStatus === 'loading'} onPress={() => setPreferences({ language: language.code })}
              style={[styles.option, preferences.language === language.code && styles.optionSelected]}>
              <Text style={styles.optionText}>{language.name}</Text>
            </Pressable>)}
          </View>
          <Text style={styles.note}>{session
            ? t('Theme and language are saved to your account and restored when you sign in on another device.')
            : t('Theme and language are saved on this device. Choose them again on a new device.')}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.note}>{t(preferenceStatus === 'synced' ? 'Preferences synced'
            : preferenceStatus === 'pending' ? 'Preferences could not be saved. Your changes will retry when connected.'
            : preferenceStatus === 'loading' ? 'Loading preferences…' : 'Saved on this device')}</Text>
          {preferenceStatus === 'pending' ? <Pressable accessibilityRole="button" onPress={retryPreferences} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>{t('Retry sync')}</Text></Pressable> : null}
        </View>

        <View style={styles.accountCard}>
          <Text style={styles.eyebrow}>{t("ACCOUNT")}</Text>
          <Text style={styles.connectionTitle}>
            {authLoading
              ? t("Checking this device…")
              : session
                ? nickname || t("Your Pulse is connected")
                : t("Using PULSE without an account")}
          </Text>
          <Text style={styles.connectionMessage}>
            {session
              ? session.user.email
              : t("Sign in with an email code to keep future server-confirmed history and questions across devices.")}
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
              {session ? t("Manage account") : t("Sign in or create account")}
            </Text>
          </Pressable>
          {!session ? <Text style={styles.note}>{t("Optional, always.")}</Text> : null}
        </View>

        <View style={styles.connectionCard}>
          <View style={styles.connectionHeading}>
            <Text style={styles.eyebrow}>{t("DATABASE")}</Text>
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
              ? t("Checking connection")
              : connection.status === 'connected'
                ? t("Supabase connected")
                : t("Supabase needs attention")}
          </Text>
          <Text accessibilityLiveRegion="polite" style={styles.connectionMessage}>
            {t(connection.message)}
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
            <Text style={styles.retryButtonText}>{t("Check again")}</Text>
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
