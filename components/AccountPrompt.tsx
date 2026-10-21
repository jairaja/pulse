import { useI18n, AppText as Text } from '../lib/i18n';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '../lib/auth';
import { useAppTheme, type ThemeColors } from '../lib/theme';

export function AccountPrompt({
  action,
  body,
  source,
  title
}: {
  action: string;
  body: string;
  source: string;
  title: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { loading, session } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (loading || session) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/account', params: { source } })}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>{action}</Text>
      </Pressable>
      <Text style={styles.optional}>{t("Optional, always.")}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: { backgroundColor: colors.activeSurface, borderRadius: 22, gap: 11, padding: 19 },
    title: { color: colors.ink, fontSize: 20, fontWeight: '700' },
    body: { color: colors.body, fontSize: 14, lineHeight: 21 },
    button: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 15,
      justifyContent: 'center',
      marginTop: 3,
      minHeight: 50
    },
    pressed: { opacity: 0.8 },
    buttonText: { color: colors.onPrimary, fontSize: 14, fontWeight: '800' },
    optional: { color: colors.muted, fontSize: 12, textAlign: 'center' }
  });
}
