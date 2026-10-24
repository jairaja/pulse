import { AppTextInput as TextInput } from '../components/AppTextInput';
import * as Crypto from 'expo-crypto';
import Storage from 'expo-sqlite/kv-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { AppText as Text, useI18n } from '../lib/i18n';
import { useAppTheme } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { useHumanCheck } from '../components/HumanCheck';
import { fetchBrewingAllowance, submitCommunityQuestion } from '../lib/communityApi';
import { localGeneration, writeLocal } from '../lib/localReset';
import { prepareAction } from '../lib/actionVerification';
import { normalizeQuestion, questionLength } from '../lib/questionText';
import { openQuestion } from '../lib/publicQuestions';

type Suggestion = { id: string; question_text: string; destination: string };
export default function AskQuestionScreen() {
  const { session } = useAuth();
  return <AskForm key={session?.user.id ?? 'guest'} userId={session?.user.id} />;
}
function AskForm({ userId }: { userId?: string }) {
  const { t, direction } = useI18n(); const { colors } = useAppTheme(); const router = useRouter(); const cache = useQueryClient();
  const allowance = useQuery({ queryKey: ['pulse', 'community', userId, 'allowance'], queryFn: fetchBrewingAllowance, enabled: Boolean(userId), staleTime: 0, meta: { persist: false } });
  const [generation] = useState(localGeneration);
  const human = useHumanCheck(); const [draft, setDraft] = useState(''); const [ready, setReady] = useState(false);
  const [debounced, setDebounced] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const key = `pulse.ask-draft.${userId}`; const requestId = useRef(Crypto.randomUUID());
  useEffect(() => { let alive = true; void Storage.getItem(key).then(value => { if (alive) { setDraft(value ?? ''); setReady(true); } }); return () => { alive = false; }; }, [key]);
  useEffect(() => { const timer = setTimeout(() => setDebounced(draft.trim()), 300); return () => clearTimeout(timer); }, [draft]);
  const suggestions = useQuery({ queryKey: ['pulse', 'question-search', debounced], enabled: debounced.length >= 2,
    queryFn: async ({ signal }) => { const { data, error } = await supabase!.rpc('search_public_questions', { p_query: debounced, p_limit: 6 }).abortSignal(signal);
      if (error) throw new Error('Suggestions are unavailable.'); return data as Suggestion[]; }, meta: { persist: false } });
  async function submit() {
    if (!userId || busy || !allowance.data || allowance.isError || allowance.data.submittedQuestionId) return; setBusy(true); setError('');
    const text = normalizeQuestion(draft);
    try {
      if (questionLength(text) < 1 || questionLength(text) > 180) throw new Error('Keep your question to 180 characters.');
      const proof = await prepareAction('submit', [text, null], undefined, requestId.current);
      const captchaToken = await human.verify(proof.captchaBinding);
      await submitCommunityQuestion({ text, proof: { ...proof, captchaToken } });
      if (generation !== localGeneration()) return;
      await Storage.removeItem(key); await cache.invalidateQueries({ queryKey: ['pulse', 'community'] });
      Alert.alert(t('Question received'), t('Your question will appear in Brewing after its safety check. You can share it there.'));
      router.back();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not submit your question.'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['bottom']}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 18 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Back to Brewing')} onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.accent }}>‹ {t('Brewing Questions')}</Text></Pressable>
      <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 28 }}>{t('Ask a question')}</Text>
      {!userId ? <Text style={{ color: colors.body }}>{t('Sign in to ask a question')}</Text> : <>
        {allowance.data?.submittedQuestionId ? <Text style={{ color: colors.accent }}>{t('Your question has been submitted today.')}</Text> : null}
        {allowance.isError ? <Pressable accessibilityRole="button" onPress={() => void allowance.refetch()}><Text style={{ color: colors.accent }}>{t('Retry')}</Text></Pressable> : null}
        <Text style={{ color: colors.body }}>{t('Ask one clear question people can answer YES or NO. One submission per UTC day; your allowance resets at 00:00 UTC.')}</Text>
        <TextInput accessibilityLabel={t('Your question')} multiline value={draft} editable={ready && !busy}
          onChangeText={value => { setDraft(value); requestId.current = Crypto.randomUUID(); void writeLocal(key, value, generation); }}
          placeholder={t('What would you like to ask the world?')} placeholderTextColor={colors.muted}
          style={{ color: colors.ink, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, minHeight: 140, fontSize: 18, writingDirection: direction, textAlignVertical: 'top' }} />
        <Text style={{ color: questionLength(draft) > 180 ? colors.error : colors.muted }}>{questionLength(draft)}/180 {t('characters')}</Text>
        <Text style={{ color: colors.body }}>{t('Keep it neutral. Ask about one idea. Avoid names, private information, insults and links. Check similar questions below before submitting.')}</Text>
        {debounced === draft.trim() ? suggestions.data?.map(item => <Pressable key={item.id} accessibilityRole="button"
          onPress={() => openQuestion(router, item.destination === 'brewing' ? 'submission' : 'question', item.id)}
          style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12, minHeight: 48 }}>
          <Text style={{ color: colors.ink }}>{item.question_text}</Text><Text style={{ color: colors.muted }}>{t(item.destination === 'today' ? 'Today' : item.destination === 'brewing' ? 'Brewing Questions' : 'Past Results')}</Text>
        </Pressable>) : null}
        {suggestions.isError ? <Text style={{ color: colors.muted }}>{t('Suggestions are unavailable. You can still submit your question.')}</Text> : null}
        {error ? <Text accessibilityLiveRegion="polite" style={{ color: colors.error }}>{t(error)}</Text> : null}
        <Pressable accessibilityRole="button" disabled={busy || !ready || !allowance.data || allowance.isError || Boolean(allowance.data.submittedQuestionId) || !draft.trim() || questionLength(draft) > 180} onPress={() => void submit()}
          style={{ backgroundColor: colors.primary, padding: 18, borderRadius: 16, minHeight: 52 }}><Text style={{ color: colors.onPrimary }}>{t(busy ? 'Submitting…' : 'Submit for review')}</Text></Pressable>
      </>}
    </ScrollView>{human.element}
  </SafeAreaView>;
}
