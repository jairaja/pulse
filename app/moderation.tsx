import { AppTextInput as TextInput } from '../components/AppTextInput';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { AppText as Text, useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../lib/theme';
import { useHumanCheck } from '../components/HumanCheck';
import { prepareAction } from '../lib/actionVerification';
import { normalizeQuestion, questionLength } from '../lib/questionText';
import { submitCommunityQuestion, fetchCommunityRole } from '../lib/communityApi';
type Pending = { id: string; question_text: string; revision: number; created_at: string };
export default function ReviewQuestions() {
  const { session } = useAuth(); const { colors } = useAppTheme(); const { t } = useI18n(); const cache = useQueryClient();
  const [reason, setReason] = useState(''); const [drafts, setDrafts] = useState<Record<string, string>>({}); const human = useHumanCheck();
  const role = useQuery({ queryKey: ['pulse', 'moderation-role', session?.user.id], queryFn: fetchCommunityRole, enabled: Boolean(session) });
  const questions = useQuery({ queryKey: ['pulse', 'pending', session?.user.id], enabled: Boolean(session), queryFn: async () => {
    const { data, error } = await supabase!.rpc('list_pending_questions'); if (error) throw new Error('Could not load pending questions.'); return data as Pending[];
  }, meta: { persist: false } });
  const moderate = role.data === 'moderator' || role.data === 'admin';
  const review = useMutation({ mutationFn: async ({ item, publish }: { item: Pending; publish: boolean }) => {
    const { error } = await supabase!.rpc('review_brewing_submission', { p_id: item.id, p_revision: item.revision, p_publish: publish, p_reason: reason });
    if (error) throw new Error(error.message);
  }, onSuccess: () => cache.invalidateQueries({ queryKey: ['pulse'] }) });
  async function edit(item: Pending) {
    const text = normalizeQuestion(drafts[item.id] ?? item.question_text);
    if (!text || questionLength(text) > 180) return;
    try {
      const proof = await prepareAction('submit', [text, item.id]); const captchaToken = await human.verify(proof.captchaBinding);
      await submitCommunityQuestion({ text, editId: item.id, proof: { ...proof, captchaToken } });
      await questions.refetch();
    } catch (error) { Alert.alert(t('Question review'), t(error instanceof Error ? error.message : 'Could not edit.')); }
  }
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }} style={{ backgroundColor: colors.canvas }}>
    <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 26 }}>{t('Pending questions')}</Text>
    <Text style={{ color: colors.body }}>{t('Pending questions are private and cannot receive upvotes. Publication does not give a question priority in selection.')}</Text>
    {moderate ? <TextInput accessibilityLabel={t('Review reason')} value={reason} onChangeText={setReason} placeholder={t('Review reason')} style={{ color: colors.ink, padding: 14, backgroundColor: colors.surface }} /> : null}
    {questions.data?.map(item => <View key={item.id} style={{ backgroundColor: colors.surface, padding: 16, gap: 12 }}>
      <Text style={{ color: colors.ink }}>{item.question_text}</Text>
      {moderate ? <View style={{ gap: 12 }}>{[true, false].map(publish => <Pressable key={String(publish)} accessibilityRole="button" disabled={reason.trim().length < 5 || review.isPending}
        onPress={() => review.mutate({ item, publish })} style={{ minHeight: 48 }}><Text style={{ color: colors.accent }}>{t(publish ? 'Publish after review' : 'Hold for review')}</Text></Pressable>)}</View> : <>
        <TextInput accessibilityLabel={t('Edit pending question')} multiline value={drafts[item.id] ?? item.question_text} onChangeText={value => setDrafts(old => ({ ...old, [item.id]: value }))} style={{ color: colors.ink, padding: 12 }} />
        <Pressable accessibilityRole="button" onPress={() => void edit(item)} style={{ minHeight: 48 }}><Text style={{ color: colors.accent }}>{t('Save changes for review')}</Text></Pressable>
      </>}
    </View>)}
    {review.error || questions.error ? <Text style={{ color: colors.error }}>{t((review.error ?? questions.error)!.message)}</Text> : null}
    <Pressable accessibilityRole="button" onPress={() => void questions.refetch()} style={{ minHeight: 48 }}><Text style={{ color: colors.accent }}>{t('Refresh')}</Text></Pressable>
    {human.element}
  </ScrollView>;
}
