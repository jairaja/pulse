import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../lib/auth';
import { type BrewingFilter, type BrewingSort, type CommunityQuestion } from '../lib/communityApi';
import { useCommunityBrewing } from '../lib/communityQueries';
import { useI18n, AppText as Text } from '../lib/i18n';
import { useConnectivity } from '../lib/query';
import { useAppTheme, type ThemeColors } from '../lib/theme';

const sorts: { value: BrewingSort; label: string }[] = [
  { value: 'most_upvoted', label: 'Most upvoted' }, { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }
];
const filters: { value: BrewingFilter; label: string; signedIn?: boolean }[] = [
  { value: 'all', label: 'All questions' }, { value: 'today', label: 'Submitted today' },
  { value: 'mine', label: 'My questions', signedIn: true }, { value: 'others', label: 'Other people’s questions', signedIn: true }
];

export default function BrewingQuestionsScreen() {
  const { session } = useAuth();
  return <CommunityList key={session?.user.id ?? 'guest'} userId={session?.user.id} />;
}

function CommunityList({ userId }: { userId?: string }) {
  const { t, locale, direction } = useI18n();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const connectivity = useConnectivity();
  const [sort, setSort] = useState<BrewingSort>('most_upvoted');
  const [filter, setFilter] = useState<BrewingFilter>('all');
  const [menu, setMenu] = useState<'filter' | 'sort' | null>(null);
  const [compose, setCompose] = useState(false);
  const [draft, setDraft] = useState('');
  const [target, setTarget] = useState<{ question: CommunityQuestion; requestId: string } | null>(null);
  const [reason, setReason] = useState('');
  const { feed, allowance, role, submit, upvote, remove, refresh } = useCommunityBrewing(userId, sort, filter);
  const items = [...new Map((feed.data?.pages.flatMap(page => page.items) ?? []).map(item => [item.id, item])).values()];
  const available = Boolean(userId && allowance.data && !allowance.isError && !allowance.isFetching &&
    connectivity.determined && connectivity.online && !submit.isPending && !upvote.isPending);
  const canModerate = Boolean(userId && !role.isError && (role.data === 'admin' || role.data === 'superuser'));
  const canRemove = canModerate && connectivity.online && !remove.isPending;
  const inputDirection = { writingDirection: direction, textAlign: direction === 'rtl' ? 'right' as const : 'left' as const };
  const formatTime = (value: string) => `${new Intl.DateTimeFormat(locale, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hourCycle: 'h23'
  }).format(new Date(value))} UTC`;

  async function sendQuestion() {
    if (!available || allowance.data?.submittedQuestionId) return;
    try { await submit.mutateAsync(draft); setDraft(''); setCompose(false); } catch { /* Shown in the form. */ }
  }
  function closeRemoval() { if (!remove.isPending) { setTarget(null); setReason(''); remove.reset(); } }
  async function confirmRemoval() {
    if (!target || !userId || !canRemove || reason.trim().length < 5) return;
    try {
      await remove.mutateAsync({ userId, id: target.question.id, reason: reason.trim(), requestId: target.requestId });
      setTarget(null); setReason(''); remove.reset();
    } catch { /* Keep reason and request ID for a safe retry. */ }
  }
  const menuOptions = menu === 'sort' ? sorts : filters.filter(option => !option.signedIn || userId);
  const sortLabel = sorts.find(option => option.value === sort)!.label;
  const filterLabel = filters.find(option => option.value === filter)!.label;

  return <SafeAreaView edges={['bottom']} style={styles.screen}>
    <FlatList data={items} keyExtractor={item => item.id} contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled" onRefresh={() => void refresh()} refreshing={feed.isRefetching && !feed.isFetchingNextPage}
      ListHeaderComponent={<View style={styles.section}>
        <Text style={styles.eyebrow}>{t('BREWING QUESTIONS')}</Text>
        <Text style={styles.title}>{t('Community questions')}</Text>
        <Text style={styles.body}>{t('At 00:00 UTC, the most upvoted question goes live. Ties favor the later submission.')}</Text>
        <View style={styles.toolbar}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('Filter')}: ${t(filterLabel)}`} onPress={() => setMenu('filter')} style={styles.tool}>
            <Text style={styles.meta}>{t('Filter')}</Text><Text style={styles.toolText}>{t(filterLabel)} ▾</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('Sort')}: ${t(sortLabel)}`} onPress={() => setMenu('sort')} style={styles.tool}>
            <Text style={styles.meta}>{t('Sort')}</Text><Text style={styles.toolText}>{t(sortLabel)} ▾</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Refresh community questions')} disabled={feed.isFetching}
            onPress={() => void refresh()} style={[styles.refresh, feed.isFetching && styles.disabled]}>
            <Text style={styles.refreshIcon}>↻</Text>
          </Pressable>
        </View>
        {!userId ? <Pressable accessibilityRole="button" style={styles.button}
          onPress={() => router.push({ pathname: '/account', params: { source: 'brewing-questions' } })}>
          <Text style={styles.buttonText}>{t('Sign in to submit or upvote')}</Text>
        </Pressable> : <View style={styles.section}>
          <Text style={styles.body}>{t('One question and one upvote per UTC day. You cannot upvote your own question.')}</Text>
          {allowance.isPending ? <Text style={styles.meta}>{t('Checking your daily allowance…')}</Text> : allowance.isError ?
            <Text style={styles.error}>{t('Your daily allowance could not be verified. Refresh before submitting or upvoting.')}</Text> : allowance.data ? <>
              {allowance.data.submittedQuestionId ? <Text style={styles.meta}>{t('Your question has been submitted today.')}</Text> :
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: compose }} onPress={() => setCompose(value => !value)} style={styles.button}>
                  <Text style={styles.buttonText}>{compose ? t('Cancel') : t('Ask a question')}</Text></Pressable>}
              {allowance.data.upvotedQuestionId ? <Text style={styles.meta}>{t('You have used today’s upvote.')}</Text> : null}
            </> : null}
          {compose && !allowance.data?.submittedQuestionId ? <View style={styles.card}>
            <TextInput accessibilityLabel={t('Your question')} multiline maxLength={280} value={draft} onChangeText={setDraft}
              placeholder={t('Ask a question that can be answered YES or NO')} placeholderTextColor={colors.muted}
              editable={available} style={[styles.input, inputDirection]} />
            <Text style={styles.meta}>{t('{count}/280 characters · minimum 5', { count: draft.length })}</Text>
            <Pressable accessibilityRole="button" disabled={!available || draft.trim().length < 5} onPress={() => void sendQuestion()}
              style={[styles.button, (!available || draft.trim().length < 5) && styles.disabled]}>
              <Text style={styles.buttonText}>{submit.isPending ? t('Submitting…') : t('Submit today’s question')}</Text></Pressable>
          </View> : null}
        </View>}
        {!connectivity.online && connectivity.determined ? <Text style={styles.meta}>{t('Connect to submit or upvote. Offline actions are not queued.')}</Text> : null}
        {submit.error || upvote.error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{t((submit.error ?? upvote.error)?.message ?? 'Something went wrong. Please try again.')}</Text> : null}
        {feed.isError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{t(feed.error.message)}</Text> : null}
        {role.isError && userId ? <Text style={styles.meta}>{t('Could not verify moderator access.')}</Text> : null}
      </View>}
      ListEmptyComponent={feed.isPending ? <ActivityIndicator color={colors.accent} /> : feed.isError ? null :
        <Text style={styles.empty}>{t('No questions match this filter.')}</Text>}
      renderItem={({ item }) => {
        const disabled = !available || item.isOwn || Boolean(allowance.data?.upvotedQuestionId);
        return <View style={styles.card}>
          <Text style={styles.question}>{item.text}</Text>
          <Text style={styles.meta}>{formatTime(item.createdAt)}</Text>
          {item.isOwn ? <Text style={styles.own}>{t('Your question')}</Text> : null}
          <View style={styles.cardActions}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected: item.upvotedToday }}
              accessibilityLabel={item.isOwn ? t('Your question cannot be upvoted by you') : t('Upvote: {question}', { question: item.text })}
              disabled={disabled} onPress={() => upvote.mutate(item.id)} style={[styles.upvote, disabled && styles.disabled]}>
              <Text style={styles.upvoteText}>↑ {new Intl.NumberFormat(locale).format(item.upvoteCount)}</Text>
              <Text style={styles.buttonText}>{item.upvotedToday ? t('Upvoted today') : t('Upvote')}</Text>
            </Pressable>
            {canModerate ? <Pressable accessibilityRole="button" accessibilityLabel={t('Delete question')} disabled={!canRemove}
              onPress={() => { remove.reset(); setReason(''); setTarget({ question: item, requestId: Crypto.randomUUID() }); }}
              style={[styles.deleteButton, !canRemove && styles.disabled]}><Text style={styles.error}>{t('Delete')}</Text></Pressable> : null}
          </View>
        </View>;
      }}
      ListFooterComponent={feed.hasNextPage ? <Pressable accessibilityRole="button" disabled={feed.isFetchingNextPage || !connectivity.online}
        onPress={() => void feed.fetchNextPage()} style={styles.button}>
        <Text style={styles.buttonText}>{feed.isFetchingNextPage ? t('Loading…') : t('Load more questions')}</Text></Pressable> : null} />

    <Sheet visible={menu !== null} close={() => setMenu(null)} styles={styles}>
      <Text accessibilityRole="header" style={styles.title}>{menu === 'sort' ? t('Sort') : t('Filter')}</Text>
      {menuOptions.map(option => <Pressable key={option.value} accessibilityRole="radio"
        accessibilityState={{ checked: option.value === (menu === 'sort' ? sort : filter) }}
        onPress={() => { if (menu === 'sort') setSort(option.value as BrewingSort); else setFilter(option.value as BrewingFilter); setMenu(null); }}
        style={styles.button}><Text style={styles.buttonText}>{t(option.label)}{option.value === (menu === 'sort' ? sort : filter) ? ' ✓' : ''}</Text></Pressable>)}
      <Pressable accessibilityRole="button" onPress={() => setMenu(null)} style={styles.button}><Text style={styles.buttonText}>{t('Cancel')}</Text></Pressable>
    </Sheet>
    <Sheet visible={target !== null} close={closeRemoval} styles={styles}>
      <Text accessibilityRole="header" style={styles.title}>{t('Delete question')}</Text>
      <Text style={styles.body}>{t('Remove this question from Brewing? Your identity and reason will be saved in the private audit history.')}</Text>
      <Text numberOfLines={3} style={styles.body}>{target?.question.text}</Text>
      <TextInput accessibilityLabel={t('Reason for removal')} multiline maxLength={1000} value={reason} onChangeText={setReason}
        editable={!remove.isPending} placeholder={t('Reason for removal')} placeholderTextColor={colors.muted} style={[styles.input, inputDirection]} />
      <Text style={styles.meta}>{t('Use 5 to 1000 characters.')}</Text>
      {remove.error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{t(remove.error.message)}</Text> : null}
      <Pressable accessibilityRole="button" disabled={!canRemove || reason.trim().length < 5} onPress={() => void confirmRemoval()}
        style={[styles.button, (!canRemove || reason.trim().length < 5) && styles.disabled]}>
        <Text style={styles.error}>{remove.isPending ? t('Removing…') : t('Confirm delete')}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={remove.isPending} onPress={closeRemoval} style={styles.button}><Text style={styles.buttonText}>{t('Cancel')}</Text></Pressable>
    </Sheet>
  </SafeAreaView>;
}

type Styles = ReturnType<typeof createStyles>;
function Sheet({ visible, close, styles, children }: { visible: boolean; close: () => void; styles: Styles; children: ReactNode }) {
  const { t, direction } = useI18n();
  return <Modal transparent animationType="fade" visible={visible} onRequestClose={close}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Cancel')} onPress={close} style={StyleSheet.absoluteFill} />
      <SafeAreaView accessibilityViewIsModal style={[styles.sheet, { direction }]} edges={['bottom']}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.section}>{children}</ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>;
}
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.canvas, flex: 1 }, content: { padding: 20, gap: 16, paddingBottom: 40 }, section: { gap: 12 },
    card: { gap: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 18, borderRadius: 18 },
    eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700' }, title: { color: colors.ink, fontSize: 27, fontWeight: '700' },
    body: { color: colors.body, fontSize: 15, lineHeight: 23 }, meta: { color: colors.muted, fontSize: 13, lineHeight: 20 },
    question: { color: colors.ink, fontSize: 21, fontWeight: '600', lineHeight: 29 }, own: { color: colors.accent, fontSize: 13 },
    toolbar: { flexDirection: 'row', gap: 8, alignItems: 'stretch' }, tool: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, justifyContent: 'center' },
    toolText: { color: colors.ink, fontSize: 13, fontWeight: '700' }, refresh: { width: 44, minHeight: 48, justifyContent: 'center', alignItems: 'center' }, refreshIcon: { color: colors.accent, fontSize: 28 },
    button: { borderColor: colors.accent, borderWidth: 1, borderRadius: 14, padding: 14, minHeight: 48, alignItems: 'center' }, buttonText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
    cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' },
    upvote: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', paddingHorizontal: 14, minHeight: 48, borderWidth: 1, borderColor: colors.accent, borderRadius: 14 },
    upvoteText: { color: colors.accent, fontSize: 19, fontWeight: '700' }, deleteButton: { padding: 12, minHeight: 48 },
    input: { color: colors.ink, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 100, textAlignVertical: 'top' },
    disabled: { opacity: 0.45 }, error: { color: '#C95B55', fontSize: 14, lineHeight: 21 }, empty: { color: colors.muted, paddingVertical: 30, fontSize: 15 },
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }, sheet: { backgroundColor: colors.canvas, borderTopStartRadius: 22, borderTopEndRadius: 22, padding: 22, maxHeight: '90%' }
  });
}
