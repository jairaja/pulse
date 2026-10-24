import Storage from 'expo-sqlite/kv-store';
import type { VoteReceipt } from './pulseTypes';
import { writeLocal } from './localReset';
const scope = encodeURIComponent(process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'unconfigured');
const prefix = `pulse.guest-history.${scope}.`;
export async function rememberGuestAnswer(receipt: VoteReceipt) {
  if (receipt.choice) await writeLocal(`${prefix}${receipt.questionId}`, JSON.stringify(receipt));
}
export async function guestAnswers(): Promise<VoteReceipt[]> {
  const keys = (await Storage.getAllKeys()).filter(key => key.startsWith(prefix));
  const items = await Promise.all(keys.map(async key => {
    try { return JSON.parse((await Storage.getItem(key)) ?? 'null') as VoteReceipt | null; } catch { return null; }
  }));
  return items.filter((v): v is VoteReceipt => Boolean(v && typeof v.questionId === 'string' && (v.choice === 'YES' || v.choice === 'NO') && Number.isFinite(Date.parse(v.acceptedAt))))
    .sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt));
}
