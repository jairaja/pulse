import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export function publicQuestionUrl(kind: 'submission' | 'question', id: string) {
  const base = process.env.EXPO_PUBLIC_SHARE_ORIGIN;
  if (!base) throw new Error('Question sharing will be available when public links are configured.');
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Public links must use HTTPS.');
  url.pathname = `/q/${kind}/${encodeURIComponent(id)}`;
  return url.toString();
}
export async function shareQuestion(kind: 'submission' | 'question', id: string, text: string, caption: string) {
  const url = publicQuestionUrl(kind, id);
  await Share.share({ title: 'PULSE', message: `${text}\n\n${caption}\n${url}` });
}
export async function copyQuestionLink(kind: 'submission' | 'question', id: string) {
  await Clipboard.setStringAsync(publicQuestionUrl(kind, id));
}
