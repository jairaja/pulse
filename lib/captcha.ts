import * as Crypto from 'expo-crypto';

import { getInstallationCredential } from './installation';
import type { VoteChoice } from './pulseTypes';

export type VoteAttempt = {
  captchaBinding: string;
  captchaToken: string;
  choice: VoteChoice;
  idempotencyKey: string;
  questionId: string;
};

export type PendingVoteAttempt = Omit<VoteAttempt, 'captchaToken'>;

export async function prepareVoteAttempt(questionId: string, choice: VoteChoice): Promise<PendingVoteAttempt> {
  const credential = await getInstallationCredential();
  const idempotencyKey = Crypto.randomUUID();
  const captchaBinding = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${credential}:${questionId}:${choice}:${idempotencyKey}`
  );
  return { captchaBinding, choice, idempotencyKey, questionId };
}

export function getCaptchaChallengeUrl(binding: string) {
  const configured = process.env.EXPO_PUBLIC_TURNSTILE_CHALLENGE_URL;
  if (!configured) throw new Error('Human verification is not configured.');
  const url = new URL(configured);
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new Error('Human verification must use HTTPS.');
  }
  url.searchParams.set('cdata', binding);
  return url.toString();
}
