import { AppTextInput as TextInput } from '../components/AppTextInput';
import { useI18n, AppText as Text } from '../lib/i18n';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useHumanCheck } from '../components/HumanCheck';
import { useAuth } from '../lib/auth';
import { useAppTheme, type ThemeColors } from '../lib/theme';

type Stage = 'email' | 'code' | 'profile';

export default function AccountScreen() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    available,
    loading: authLoading,
    nickname,
    sendEmailCode,
    session,
    setNickname,
    signOut,
    verifyEmailCode
  } = useAuth();
  const human = useHumanCheck();
  const [importHistory, setImportHistory] = useState(true);
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [nicknameEdit, setNicknameEdit] = useState({ source: nickname, value: nickname });
  if (nicknameEdit.source !== nickname) {
    setNicknameEdit({ source: nickname, value: nickname });
  }
  const nicknameDraft = nicknameEdit.source === nickname ? nicknameEdit.value : nickname;
  const setNicknameDraft = (value: string) => setNicknameEdit({ source: nickname, value });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [includeNickname, setIncludeNickname] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  async function requestCode() {
    setBusy(true);
    setError('');
    const result = await sendEmailCode(email);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStage('code');
    setResendSeconds(60);
  }

  async function verifyCode() {
    setBusy(true);
    setError('');
    const result = await verifyEmailCode(email, code, importHistory, human.verify);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStage('profile');
  }

  async function saveNickname() {
    setBusy(true);
    setError('');
    const result = await setNickname(nicknameDraft);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }

  function confirmLogout() {
    Alert.alert(
      t('Log out of Pulse?'),
      t('Your account history stays saved. Pulse will reset on this device.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Log out'),
          style: 'destructive',
          onPress: () => {
            void signOut().then((result) => {
              if (!result.ok) setError(result.message);
              else router.replace('/settings');
            });
          }
        }
      ]
    );
  }

  const signedIn = Boolean(session?.user.email);
  const showProfile = signedIn && (stage === 'profile' || source === 'settings');

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>{t("OPTIONAL ACCOUNT")}</Text>
            <Text style={styles.title}>{signedIn ? t("Your Pulse is connected.") : t("Keep your Pulse.")}</Text>
            <Text style={styles.body}>
              {signedIn
                ? t("Your history and preferences are saved to your account. Only one device can use this account at a time.")
                : t("Keep your history across devices. You can still cast the daily YES/NO vote as a guest.")}
            </Text>
          </View>

          {!available ? (
            <MessageCard
              body={t("Add the Supabase URL and publishable key before using accounts.")}
              styles={styles}
              title={t("Accounts are not configured")}
            />
          ) : authLoading ? (
            <MessageCard body={t("Checking this device…")} styles={styles} title={t("Loading account")} />
          ) : showProfile ? (
            <View style={styles.form}>
              <Text style={styles.label}>{t("VERIFIED EMAIL")}</Text>
              <Text style={styles.emailValue}>{session?.user.email}</Text>
              <NicknameEditor
                busy={busy}
                error={error}
                nickname={nicknameDraft}
                onChange={setNicknameDraft}
                onSave={() => void saveNickname()}
                styles={styles}
              />

              <View style={styles.previewCard}>
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.cardTitle}>{t("Share preview")}</Text>
                    <Text style={styles.smallBody}>{t("Nickname attribution is always opt-in per share.")}</Text>
                  </View>
                  <Switch
                    disabled={!nickname}
                    onValueChange={setIncludeNickname}
                    value={includeNickname && Boolean(nickname)}
                  />
                </View>
                <Text style={styles.previewText}>
                  {includeNickname && nickname ? `${nickname} · ` : ''}{t('My Pulse')} · {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date('2026-10-15T00:00:00Z'))}
                </Text>
              </View>

              <Pressable accessibilityRole="button" onPress={confirmLogout} style={styles.logoutButton}>
                <Text style={styles.logoutText}>{t("Log out")}</Text>
              </Pressable>
            </View>
          ) : signedIn && stage === 'email' ? (
            <View style={styles.form}>
              <MessageCard
                body={t("Your verified account is ready. Add an optional nickname or continue without one.")}
                styles={styles}
                title={t("Account connected")}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setStage('profile')}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>{t("Continue")}</Text>
              </Pressable>
            </View>
          ) : stage === 'email' ? (
            <View style={styles.form}>
              <Text style={styles.label}>{t("EMAIL")}</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                editable={!busy}
                inputMode="email"
                onChangeText={setEmail}
                placeholder={t("you@example.com")}
                placeholderTextColor={colors.disabledText}
                style={[styles.input, { writingDirection: 'ltr', textAlign: 'left' }]}
                value={email}
              />
              {error ? <Text style={styles.error}>{t(error)}</Text> : null}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void requestCode()}
                style={[styles.primaryButton, busy && styles.disabledButton]}
              >
                <Text style={styles.primaryButtonText}>{busy ? t("Sending…") : t("Email me a code")}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.textButton}>
                <Text style={styles.textButtonLabel}>{t("Not now")}</Text>
              </Pressable>
            </View>
          ) : stage === 'code' ? (
            <View style={styles.form}>
              <Text style={styles.label}>{t("6-DIGIT CODE")}</Text>
              <Text style={styles.smallBody}>{t('Enter the code sent to {email}. Signing in here will sign your account out on any other device.', { email: email.trim().toLowerCase() })}</Text>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: importHistory, disabled: busy }}
                disabled={busy} onPress={() => setImportHistory(value => !value)} style={[styles.switchRow, { minHeight: 48 }]}>
                <Text style={[styles.smallBody, { flex: 1 }]}>{t('Add earlier votes from this device to my new account.')}</Text>
                <Text style={{ color: colors.accent, fontSize: 28 }}>{importHistory ? '☑' : '☐'}</Text>
              </Pressable>
              <Text style={styles.privacyNote}>{t('Only when creating an account here. Existing-account sign-ins restore account history instead. Turn this off on a shared device.')}</Text>
              <TextInput
                autoComplete="one-time-code"
                editable={!busy}
                inputMode="numeric"
                maxLength={6}
                onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
                placeholder="000000"
                placeholderTextColor={colors.disabledText}
                style={[styles.input, styles.codeInput]}
                textContentType="oneTimeCode"
                value={code}
              />
              {error ? <Text style={styles.error}>{t(error)}</Text> : null}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void verifyCode()}
                style={[styles.primaryButton, busy && styles.disabledButton]}
              >
                <Text style={styles.primaryButtonText}>{busy ? t("Verifying…") : t("Verify")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={resendSeconds > 0 || busy}
                onPress={() => void requestCode()}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>
                  {resendSeconds > 0 ? t('Resend in {seconds}s', { seconds: resendSeconds }) : t("Send a new code")}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setStage('email');
                  setCode('');
                  setError('');
                }}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>{t("Use another email")}</Text>
              </Pressable>
            </View>
          ) : (
            <NicknameEditor
              busy={busy}
              error={error}
              nickname={nicknameDraft}
              onChange={setNicknameDraft}
              onSave={() => void saveNickname()}
              styles={styles}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {human.element}
    </SafeAreaView>
  );
}

type AccountStyles = ReturnType<typeof createStyles>;

function NicknameEditor({
  busy,
  error,
  nickname,
  onChange,
  onSave,
  styles
}: {
  busy: boolean;
  error: string;
  nickname: string;
  onChange: (value: string) => void;
  onSave: () => void;
  styles: AccountStyles;
}) {
  const { t, direction } = useI18n();
  return (
    <View style={styles.form}>
      <Text style={styles.label}>{t("WHAT SHOULD PULSE CALL YOU? · OPTIONAL")}</Text>
      <TextInput
        autoCapitalize="words"
        editable={!busy}
        maxLength={30}
        onChangeText={onChange}
        placeholder={t("Nickname")}
        style={[styles.input, { writingDirection: direction, textAlign: direction === 'rtl' ? 'right' : 'left' }]}
        value={nickname}
      />
      <Text style={styles.privacyNote}>{t("Your nickname stays on this device. PULSE does not upload it. Change or remove it anytime; on a new device, you’ll need to set it again.")}</Text>
      {error ? <Text style={styles.error}>{t(error)}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onSave}
        style={[styles.primaryButton, busy && styles.disabledButton]}
      >
        <Text style={styles.primaryButtonText}>{nickname.trim() ? t("Save nickname") : t("Continue without one")}</Text>
      </Pressable>
    </View>
  );
}

function MessageCard({ body, styles, title }: { body: string; styles: AccountStyles; title: string }) {
  return (
    <View style={styles.messageCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.smallBody}>{body}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.canvas, flex: 1 },
    keyboardView: { flex: 1 },
    content: { gap: 28, padding: 24, paddingBottom: 56 },
    intro: { gap: 12 },
    eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
    title: { color: colors.ink, fontSize: 32, fontWeight: '700', letterSpacing: -0.7, lineHeight: 39 },
    body: { color: colors.body, fontSize: 16, lineHeight: 24 },
    form: { gap: 14 },
    label: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    input: {
      backgroundColor: colors.control,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 17,
      minHeight: 56,
      paddingHorizontal: 16
    },
    codeInput: { fontSize: 25, fontWeight: '700', letterSpacing: 8, textAlign: 'center' },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 17,
      justifyContent: 'center',
      minHeight: 56,
      paddingHorizontal: 16
    },
    primaryButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '800' },
    disabledButton: { opacity: 0.48 },
    textButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
    textButtonLabel: { color: colors.accent, fontSize: 14, fontWeight: '700' },
    error: { color: colors.error, fontSize: 14, lineHeight: 20 },
    smallBody: { color: colors.body, fontSize: 14, lineHeight: 21 },
    emailValue: { color: colors.ink, fontSize: 17, fontWeight: '700' },
    privacyNote: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    messageCard: { backgroundColor: colors.surface, borderRadius: 20, gap: 8, padding: 18 },
    cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
    previewCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 14,
      padding: 18
    },
    switchRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
    switchCopy: { flex: 1, gap: 4 },
    previewText: { color: colors.accent, fontSize: 15, fontWeight: '800', textAlign: 'center' },
    logoutButton: {
      alignItems: 'center',
      borderColor: colors.error,
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 54
    },
    logoutText: { color: colors.error, fontSize: 15, fontWeight: '800' }
  });
}
