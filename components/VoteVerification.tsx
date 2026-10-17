import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { VerifyVote, VoteChallenge } from '../lib/captcha';

const page = process.env.EXPO_PUBLIC_TURNSTILE_URL;

export function useVoteVerification() {
  const [challenge, setChallenge] = useState<VoteChallenge | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);
  const finish = useCallback((token?: string) => {
    const current = pending.current;
    pending.current = null;
    setChallenge(null);
    if (token) current?.resolve(token);
    else current?.reject(new Error('Verification cancelled or expired. Please submit your vote again.'));
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') finish(); });
    return () => {
      listener.remove();
      pending.current?.reject(new Error('Verification cancelled.'));
      pending.current = null;
    };
  }, [finish]);
  useEffect(() => {
    if (!challenge) return;
    const timer = setTimeout(() => finish(), Math.max(0, challenge.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [challenge, finish]);
  const verify: VerifyVote = useCallback(value => {
    let validPage = false;
    try { if (page) { const url = new URL(page); validPage = url.protocol === 'https:' && !url.hash && !url.search && !url.username && !url.password; } } catch { /* fail closed */ }
    if (Platform.OS === 'web' || !validPage) {
      return Promise.reject(new Error('Verification is unavailable. Please try again later in the mobile app.'));
    }
    pending.current?.reject(new Error('Verification replaced.'));
    setFailed(false);
    setChallenge(value);
    return new Promise<string>((resolve, reject) => { pending.current = { resolve, reject }; });
  }, []);
  const verification = challenge && page ? (
    <Modal visible animationType="slide" onRequestClose={() => finish()} accessibilityViewIsModal>
      <View style={{ flex: 1, paddingTop: 60, paddingBottom: 30, paddingHorizontal: 20, backgroundColor: '#fff' }}>
        <Text accessibilityRole="header" style={{ fontSize: 24, color: '#111' }}>Verify your vote</Text>
        <Text accessibilityLiveRegion="polite" style={{ color: '#111', marginVertical: 16 }}>
          {failed ? 'Verification could not load. Check your connection and retry, or cancel and try later.' :
            'Complete the verification below. Your vote is submitted only after verification succeeds.'}
        </Text>
        {!failed ? <WebView
          key={attempt}
          source={{ uri: `${page}#${challenge.cdata}` }}
          javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled
          mixedContentMode="never" allowFileAccess={false} setSupportMultipleWindows={false}
          originWhitelist={[new URL(page).origin, 'https://challenges.cloudflare.com', 'about:blank', 'about:srcdoc']}
          onShouldStartLoadWithRequest={request => {
            if (request.url === 'about:blank' || request.url === 'about:srcdoc') return true;
            try { const url = new URL(request.url); return url.protocol === 'https:' &&
              [new URL(page).origin, 'https://challenges.cloudflare.com'].includes(url.origin); }
            catch { return false; }
          }}
          onError={() => setFailed(true)} onHttpError={() => setFailed(true)}
          onMessage={event => {
            try {
              if (new URL(event.nativeEvent.url).origin !== new URL(page).origin) return;
              const message = JSON.parse(event.nativeEvent.data);
              if (message.type === 'token' && message.cdata === challenge.cdata &&
                  typeof message.token === 'string' && message.token.length >= 10 && message.token.length <= 2048 &&
                  Date.now() < challenge.expiresAt) finish(message.token);
              else if (['error', 'expired', 'timeout'].includes(message.type)) setFailed(true);
            } catch { setFailed(true); }
          }}
          style={{ flex: 1 }}
        /> : <Pressable accessibilityRole="button" onPress={() => { setAttempt(n => n + 1); setFailed(false); }} style={{ padding: 18 }}>
          <Text style={{ color: '#111' }}>Retry verification</Text>
        </Pressable>}
        <Pressable accessibilityRole="button" onPress={() => finish()} style={{ padding: 18 }}>
          <Text style={{ color: '#111' }}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  ) : null;
  return { verify, verification, cancelVerification: finish };
}
