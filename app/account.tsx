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
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../lib/auth';
import { buildShareAttribution } from '../lib/shareAttribution';
import { useAppTheme, type ThemeColors } from '../lib/theme';

type Stage = 'email' | 'code' | 'profile';

export default function AccountScreen() {
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
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [nicknameDraft, setNicknameDraft] = useState(nickname);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [includeNickname, setIncludeNickname] = useState(false);

  useEffect(() => setNicknameDraft(nickname), [nickname]);
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
    const result = await verifyEmailCode(email, code);
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
      'Log out on this device?',
      'Your account history stays safe. Personal account data cached on this device will be removed. You can keep using PULSE without an account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
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
            <Text style={styles.eyebrow}>OPTIONAL ACCOUNT</Text>
            <Text style={styles.title}>{signedIn ? 'Your Pulse is connected.' : 'Keep your Pulse.'}</Text>
            <Text style={styles.body}>
              {signedIn
                ? 'Your email is verified. Secure history sync will be enabled only after server-confirmed voting is connected.'
                : 'Verify your email now to prepare for cross-device history and question updates. PULSE still works without an account.'}
            </Text>
          </View>

          {!available ? (
            <MessageCard
              body="Add the Supabase URL and publishable key before using accounts."
              styles={styles}
              title="Accounts are not configured"
            />
          ) : authLoading ? (
            <MessageCard body="Checking this device…" styles={styles} title="Loading account" />
          ) : showProfile ? (
            <View style={styles.form}>
              <Text style={styles.label}>VERIFIED EMAIL</Text>
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
                    <Text style={styles.cardTitle}>Share preview</Text>
                    <Text style={styles.smallBody}>Nickname attribution is always opt-in per share.</Text>
                  </View>
                  <Switch
                    disabled={!nickname}
                    onValueChange={setIncludeNickname}
                    value={includeNickname && Boolean(nickname)}
                  />
                </View>
                <Text style={styles.previewText}>
                  {buildShareAttribution({
                    dateLabel: '15 Oct 2026',
                    includeNickname,
                    nickname
                  })}
                </Text>
              </View>

              <Pressable accessibilityRole="button" onPress={confirmLogout} style={styles.logoutButton}>
                <Text style={styles.logoutText}>Log out</Text>
              </Pressable>
            </View>
          ) : signedIn && stage === 'email' ? (
            <View style={styles.form}>
              <MessageCard
                body="Your verified account is ready. Add an optional nickname or continue without one."
                styles={styles}
                title="Account connected"
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setStage('profile')}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
              </Pressable>
            </View>
          ) : stage === 'email' ? (
            <View style={styles.form}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                editable={!busy}
                inputMode="email"
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.disabledText}
                style={styles.input}
                value={email}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void requestCode()}
                style={[styles.primaryButton, busy && styles.disabledButton]}
              >
                <Text style={styles.primaryButtonText}>{busy ? 'Sending…' : 'Email me a code'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.textButton}>
                <Text style={styles.textButtonLabel}>Not now</Text>
              </Pressable>
            </View>
          ) : stage === 'code' ? (
            <View style={styles.form}>
              <Text style={styles.label}>6-DIGIT CODE</Text>
              <Text style={styles.smallBody}>We sent a code to {email.trim().toLowerCase()}.</Text>
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
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void verifyCode()}
                style={[styles.primaryButton, busy && styles.disabledButton]}
              >
                <Text style={styles.primaryButtonText}>{busy ? 'Verifying…' : 'Verify'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={resendSeconds > 0 || busy}
                onPress={() => void requestCode()}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>
                  {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Send a new code'}
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
                <Text style={styles.textButtonLabel}>Use another email</Text>
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
  return (
    <View style={styles.form}>
      <Text style={styles.label}>WHAT SHOULD PULSE CALL YOU? · OPTIONAL</Text>
      <TextInput
        autoCapitalize="words"
        editable={!busy}
        maxLength={30}
        onChangeText={onChange}
        placeholder="Nickname"
        style={styles.input}
        value={nickname}
      />
      <Text style={styles.privacyNote}>
        Your nickname stays on this device. PULSE does not upload it. Change or remove it anytime;
        on a new device, you’ll need to set it again.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onSave}
        style={[styles.primaryButton, busy && styles.disabledButton]}
      >
        <Text style={styles.primaryButtonText}>{nickname.trim() ? 'Save nickname' : 'Continue without one'}</Text>
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
    error: { color: '#C95B55', fontSize: 14, lineHeight: 20 },
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
      borderColor: '#C95B55',
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 54
    },
    logoutText: { color: '#C95B55', fontSize: 15, fontWeight: '800' }
  });
}
