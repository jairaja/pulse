import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { AppText as Text, useI18n } from '../lib/i18n';
import { copyQuestionLink, shareQuestion } from '../lib/sharing';
import { useAppTheme } from '../lib/theme';
export function ShareQuestion({ kind, id, text }: { kind: 'submission' | 'question'; id: string; text: string }) {
  const { t } = useI18n(); const { colors } = useAppTheme(); const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Pressable accessibilityRole="button" disabled={busy} accessibilityLabel={t('Share question')}
    onPress={() => { setBusy(true); void shareQuestion(kind, id, text, t(kind === 'submission' ? 'Support this question on PULSE.' : 'Explore this question and its results on PULSE.')).catch(error => Alert.alert(t('Sharing'), t(error.message))).finally(() => setBusy(false)); }}
    style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.accent }}>{t('Share ↗')}</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void copyQuestionLink(kind, id).then(() => setCopied(true)).catch(error => Alert.alert(t('Sharing'), t(error.message))); }}
      style={{ minHeight: 48, justifyContent: 'center' }}><Text accessibilityLiveRegion="polite" style={{ color: colors.accent }}>{t(copied ? 'Link copied' : 'Copy link')}</Text></Pressable>
  </View>;
}
