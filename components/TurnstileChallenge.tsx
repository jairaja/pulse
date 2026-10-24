import { useI18n, AppText as Text } from '../lib/i18n';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { captchaLoadError, challengeNavigationAllowed, CAPTCHA_LOAD_ERROR } from '../lib/captchaNavigation';
import { getCaptchaChallengeUrl } from '../lib/captcha';
import { usePreferences } from '../lib/preferences';
import { useAppTheme } from '../lib/theme';

type Props = { binding: string; onCancel: () => void; onToken: (token: string) => void };

export function TurnstileChallenge({ binding, onCancel, onToken }: Props) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { preferences } = usePreferences();
  const [error, setError] = useState<string | null>(null);
  const url = useMemo(() => getCaptchaChallengeUrl(binding), [binding]);
  const origin = useMemo(() => new URL(url).origin, [url]);

  function receive(event: WebViewMessageEvent) {
    try {
      if (new URL(event.nativeEvent.url).origin !== origin) return;
      const message = JSON.parse(event.nativeEvent.data) as { type?: unknown; token?: unknown };
      if (message.type === 'turnstile-success' && typeof message.token === 'string' && message.token.length > 0 && message.token.length <= 2048) {
        onToken(message.token);
      } else if (message.type === 'turnstile-error') {
        setError('Human verification failed. Close this window and try again.');
      }
    } catch {
      setError('The verification response was invalid.');
    }
  }

  return (
    <Modal animationType={preferences.reduceMotion ? 'none' : 'slide'} onRequestClose={onCancel} presentationStyle="pageSheet" visible>
      <View style={[styles.screen, { backgroundColor: colors.canvas }]}> 
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: colors.ink }]}>{t("Verify you’re human")}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{t("Complete this security check to continue.")}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onCancel}><Text style={[styles.close, { color: colors.accent }]}>{t("Cancel")}</Text></Pressable>
        </View>
        {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.error }]}>{t(error)}</Text> : null}
        <WebView
          mixedContentMode="never"
          allowFileAccess={false}
          domStorageEnabled
          javaScriptEnabled
          onError={({ nativeEvent }) => setError(captchaLoadError(nativeEvent.description, nativeEvent.code))}
          onHttpError={() => setError(CAPTCHA_LOAD_ERROR)}
          onMessage={receive}
          onShouldStartLoadWithRequest={navigation => challengeNavigationAllowed(navigation.url, origin)}
          renderError={() => <View style={styles.loading} />}
          originWhitelist={[origin, 'https://challenges.cloudflare.com', 'about:blank', 'about:srcdoc']}
          renderLoading={() => <ActivityIndicator color={colors.accent} style={styles.loading} />}
          setSupportMultipleWindows={false}
          sharedCookiesEnabled
          source={{ uri: url }}
          startInLoadingState
          style={styles.webview}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 18 }, header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', padding: 20 },
  headerCopy: { flex: 1, marginEnd: 12 },
  title: { fontSize: 22, fontWeight: '700' }, body: { fontSize: 13, marginTop: 4 }, close: { fontSize: 15, fontWeight: '700' },
  error: { paddingHorizontal: 20, paddingBottom: 8 }, webview: { flex: 1 }, loading: { flex: 1 }
});
