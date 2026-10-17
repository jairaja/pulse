import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { getCaptchaChallengeUrl } from '../lib/captcha';
import { useAppTheme } from '../lib/theme';

type Props = { binding: string; onCancel: () => void; onToken: (token: string) => void };

export function TurnstileChallenge({ binding, onCancel, onToken }: Props) {
  const { colors } = useAppTheme();
  const [error, setError] = useState<string | null>(null);
  const url = useMemo(() => getCaptchaChallengeUrl(binding), [binding]);
  const origin = useMemo(() => new URL(url).origin, [url]);

  function receive(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: unknown; token?: unknown };
      if (message.type === 'turnstile-success' && typeof message.token === 'string' && message.token.length <= 2048) {
        onToken(message.token);
      } else if (message.type === 'turnstile-error') {
        setError('Human verification failed. Close this window and try again.');
      }
    } catch {
      setError('The verification response was invalid.');
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onCancel} presentationStyle="pageSheet" visible>
      <View style={[styles.screen, { backgroundColor: colors.canvas }]}> 
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.ink }]}>Verify you’re human</Text>
            <Text style={[styles.body, { color: colors.muted }]}>Complete this security check to submit your vote.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onCancel}><Text style={[styles.close, { color: colors.accent }]}>Cancel</Text></Pressable>
        </View>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        <WebView
          domStorageEnabled
          javaScriptEnabled
          onError={() => setError('Human verification could not be loaded.')}
          onHttpError={() => setError('Human verification could not be loaded.')}
          onMessage={receive}
          onShouldStartLoadWithRequest={(navigation) => {
            const target = navigation.url;
            return target.startsWith(origin) || target.startsWith('https://challenges.cloudflare.com/') ||
              target === 'about:blank' || target === 'about:srcdoc';
          }}
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
  title: { fontSize: 22, fontWeight: '700' }, body: { fontSize: 13, marginTop: 4 }, close: { fontSize: 15, fontWeight: '700' },
  error: { color: '#C95B55', paddingHorizontal: 20, paddingBottom: 8 }, webview: { flex: 1 }, loading: { flex: 1 }
});
