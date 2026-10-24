import { Pressable, useWindowDimensions } from 'react-native';
import { usePreferences } from '../lib/preferences';
import { AppText as Text, useI18n } from '../lib/i18n';
import { useAppTheme } from '../lib/theme';
export function useCardView(screen: 'brewing' | 'results') {
  const { preferences, set, status } = usePreferences();
  const { fontScale, width } = useWindowDimensions();
  const key = screen === 'brewing' ? 'brewingView' : 'resultsView';
  const selected = preferences[key] ?? 'list';
  const accessibleList = fontScale >= 1.4 || Boolean(preferences.largerText) || width < 350;
  return { mode: accessibleList ? 'list' as const : selected, selected, accessibleList, disabled: status === 'loading',
    toggle: () => set({ [key]: selected === 'list' ? 'grid' : 'list' }) };
}
export function ViewToggle({ view }: { view: ReturnType<typeof useCardView> }) {
  const { t } = useI18n(); const { colors } = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={t(view.selected === 'list' ? 'Switch to grid' : 'Switch to list')}
    disabled={view.disabled} onPress={view.toggle} style={{ minHeight: 48, justifyContent: 'center', padding: 10 }}>
    <Text style={{ color: colors.accent }}>{t(view.selected === 'list' ? '▦ Grid' : '☰ List')}</Text>
    {view.accessibleList && view.selected === 'grid' ? <Text style={{ color: colors.muted }}>{t('List fits your text size')}</Text> : null}
  </Pressable>;
}
