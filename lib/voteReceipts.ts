import Storage from 'expo-sqlite/kv-store';

import type { VoteReceipt } from './pulseTypes';

// A receipt from a local/test project must never hide voting in another project.
const projectScope = encodeURIComponent((process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'unconfigured').replace(/\/+$/, ''));
const receiptKey = (questionId: string) => `pulse.vote-receipt.v2.${projectScope}.${questionId}`;

export async function getStoredVoteReceipt(questionId: string): Promise<VoteReceipt | null> {
  const serialized = await Storage.getItem(receiptKey(questionId));
  if (!serialized) return null;

  try {
    const value = JSON.parse(serialized) as Partial<VoteReceipt>;
    if (
      typeof value.receiptId === 'string' &&
      typeof value.questionId === 'string' &&
      typeof value.acceptedAt === 'string' &&
      (value.choice === 'YES' || value.choice === 'NO')
    ) {
      return value as VoteReceipt;
    }
  } catch {
    // Corrupt local cache must not block a fresh server-confirmed vote lookup/submission.
  }

  await Storage.removeItem(receiptKey(questionId));
  return null;
}

export async function storeVoteReceipt(receipt: VoteReceipt) {
  await Storage.setItem(receiptKey(receipt.questionId), JSON.stringify(receipt));
}
