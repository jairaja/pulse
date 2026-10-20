import { useI18n, AppText as Text } from '../lib/i18n';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountPrompt } from '../components/AccountPrompt';
import { useAppTheme, type ThemeColors } from '../lib/theme';

export default function MyPulseScreen() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{t("MY PULSE")}</Text>

        <View style={styles.message}>
          <Text style={styles.title}>{t("Your patterns, when there’s enough to say.")}</Text>
          <Text style={styles.body}>{t("After you answer at least 10 questions, this is where you’ll see how often your answers align with PULSE voters.")}</Text>
        </View>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderValue}>—</Text>
          <Text style={styles.placeholderLabel}>{t("QUESTIONS ANSWERED")}</Text>
          <Text style={styles.placeholderNote}>{t("Insights are coming in a later phase.")}</Text>
        </View>

        <AccountPrompt
          action={t("Keep my history")}
          body={t("Keep answered-question history and future insights available when you change devices.")}
          source="my-pulse"
          title={t("Keep your Pulse")}
        />
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  content: { flex: 1, justifyContent: 'space-between', padding: 24, paddingBottom: 48 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  message: { gap: 12 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '700', letterSpacing: -0.7, lineHeight: 39 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  placeholder: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 24
  },
  placeholderValue: { color: colors.accent, fontSize: 42, fontWeight: '700' },
  placeholderLabel: { color: colors.ink, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  placeholderNote: { color: colors.disabledText, fontSize: 13, lineHeight: 19, textAlign: 'center' }
});
}
