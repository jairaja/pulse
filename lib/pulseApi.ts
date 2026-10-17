import * as Crypto from 'expo-crypto';
import type { VerifyVote } from './captcha';

import { getInstallationCredential } from './installation';
import { collectClientDeviceEvidence, IneligibleDeviceError } from './deviceIntegrity';
import type {
  FinalizedResult,
  FinalResult,
  QuestionSummary,
  ResultPage,
  TodayQuestion,
  VoteChoice,
  VoteReceipt
} from './pulseTypes';
import { supabase, supabaseConfigurationError } from './supabase';
import { storeVoteReceipt } from './voteReceipts';

type UnknownRecord = Record<string, unknown>;

export class PulseApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'PulseApiError';
  }
}

function client() {
  if (!supabase) {
    throw new PulseApiError(
      supabaseConfigurationError ?? 'PULSE is not configured.',
      'NOT_CONFIGURED'
    );
  }
  return supabase;
}

function record(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PulseApiError('The server returned an invalid response.', 'INVALID_RESPONSE');
  }
  return value as UnknownRecord;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new PulseApiError(`The server response is missing ${field}.`, 'INVALID_RESPONSE');
  }
  return value;
}

function safeCount(value: unknown, field: string) {
  const count = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new PulseApiError(`The server returned an invalid ${field}.`, 'INVALID_RESPONSE');
  }
  return count;
}

function parseQuestion(value: unknown): QuestionSummary {
  const row = record(value);
  return {
    id: requiredString(row.id ?? row.question_id, 'question id'),
    questionText: requiredString(row.question_text, 'question text'),
    sourceLanguage: requiredString(row.source_language, 'source language'),
    askedOn: requiredString(row.asked_on, 'question date'),
    sponsored: row.sponsored === true
  };
}

function parseFinalizedResult(value: unknown): FinalizedResult {
  const row = record(value);
  const finalResult = requiredString(row.result, 'final result');
  if (!['YES', 'NO', 'TIE'].includes(finalResult)) {
    throw new PulseApiError('The server returned an invalid final result.', 'INVALID_RESPONSE');
  }

  const yesCount = safeCount(row.yes_count, 'YES count');
  const noCount = safeCount(row.no_count, 'NO count');
  const totalVotes = safeCount(row.total_votes, 'vote count');
  if (totalVotes !== yesCount + noCount) {
    throw new PulseApiError('The server returned inconsistent vote totals.', 'INVALID_RESPONSE');
  }

  return {
    ...parseQuestion(row),
    yesCount,
    noCount,
    totalVotes,
    finalResult: finalResult as FinalResult,
    finalizedAt: requiredString(row.finalized_at, 'finalization time')
  };
}

export async function fetchTodayQuestion(languageCode = 'en'): Promise<TodayQuestion | null> {
  const { data, error } = await client().rpc('get_today_question', {
    p_language_code: languageCode
  });
  if (error) throw new PulseApiError('Could not load today’s question.', error.code, true);
  if (!Array.isArray(data) || data.length === 0) return null;
  const row = record(data[0]);
  return {
    ...parseQuestion(row),
    serverTime: requiredString(row.server_time, 'server time'),
    votingClosesAt: requiredString(row.voting_closes_at, 'voting close time')
  };
}

export async function fetchFinalizedResults({
  cursor,
  languageCode = 'en',
  limit = 20
}: {
  cursor?: string | null;
  languageCode?: string;
  limit?: number;
}): Promise<ResultPage> {
  const { data, error } = await client().rpc('list_finalized_results', {
    p_language_code: languageCode,
    p_limit: limit,
    p_before: cursor ?? undefined
  });
  if (error) throw new PulseApiError('Could not load past results.', error.code, true);
  if (!Array.isArray(data)) {
    throw new PulseApiError('The server returned an invalid result list.', 'INVALID_RESPONSE');
  }
  const items = data.map(parseFinalizedResult);
  return {
    items,
    nextCursor: items.length === limit ? items[items.length - 1]?.askedOn ?? null : null
  };
}

export async function submitVote(questionId: string, choice: VoteChoice, verify: VerifyVote): Promise<VoteReceipt> {
  const credential = await getInstallationCredential();
  let deviceEvidence;
  try {
    deviceEvidence = await collectClientDeviceEvidence();
  } catch (error) {
    if (error instanceof IneligibleDeviceError) {
      throw new PulseApiError(error.message, 'INELIGIBLE_DEVICE');
    }
    throw error;
  }
  // Keep the same payload and idempotency key throughout the challenge/submit pair.
  const body = { credential, deviceEvidence, questionId, choice, idempotencyKey: Crypto.randomUUID() };
  const challenge = await invokeVote({ ...body, operation: 'challenge' });
  let proof = {};
  if (challenge.required === true) {
    const expiresAt = Number(challenge.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 150_000) {
      throw new PulseApiError('Verification expired. Please try again.', 'CAPTCHA_REQUIRED');
    }
    const captchaChallenge = requiredString(challenge.challenge, 'verification challenge');
    const cdata = requiredString(challenge.cdata, 'verification binding');
    const captchaToken = await verify({ challenge: captchaChallenge, cdata, expiresAt });
    proof = { captchaChallenge, captchaToken };
  } else if (challenge.required !== false) {
    throw new PulseApiError('Verification is unavailable.', 'INVALID_RESPONSE');
  }
  // Token lives only in this call; never put it into mutation variables, cache or persistent storage.
  const data = await invokeVote({ ...body, ...proof });

  const row = record(data);
  const status = requiredString(row.status, 'vote status');
  if (status !== 'ACCEPTED') {
    const messages: Record<string, string> = {
      ALREADY_VOTED: 'This account or device already voted on this question.',
      IDEMPOTENCY_CONFLICT: 'This vote request conflicts with an earlier request.',
      INSTALLATION_ACCOUNT_CONFLICT: 'This device is linked to another account.',
      INVALID_INSTALLATION: 'This device could not be verified. Please try again.',
      INVALID_REQUEST: 'The vote request was invalid.',
      QUESTION_CLOSED: 'Voting for this question has closed.',
      RATE_LIMITED: 'Too many attempts. Wait ten minutes and try again.',
      VOTING_DISABLED: 'Voting is temporarily unavailable.'
    };
    throw new PulseApiError(messages[status] ?? 'The vote was not accepted.', status);
  }

  const acceptedChoice = requiredString(row.accepted_choice, 'accepted choice');
  if (acceptedChoice !== 'YES' && acceptedChoice !== 'NO') {
    throw new PulseApiError('The server returned an invalid vote choice.', 'INVALID_RESPONSE');
  }
  const receipt: VoteReceipt = {
    receiptId: requiredString(row.receipt_id, 'receipt id'),
    questionId,
    choice: acceptedChoice,
    acceptedAt: requiredString(row.accepted_at, 'acceptance time')
  };
  await storeVoteReceipt(receipt);
  return receipt;
}

async function invokeVote(body: Record<string, unknown>): Promise<UnknownRecord> {
  const { data, error } = await client().functions.invoke('vote', { body });
  if (error) {
    let failure: UnknownRecord = {};
    try { if (error.context instanceof Response) failure = record(await error.context.json()); } catch { /* generic message */ }
    const code = typeof failure.code === 'string' ? failure.code : 'VOTE_GATEWAY_ERROR';
    const messages: Record<string, string> = {
      CAPTCHA_REQUIRED: 'Verification expired or failed. Please submit again for a fresh verification.',
      CAPTCHA_UNAVAILABLE: 'Verification is temporarily unavailable. Please try again later.',
      DATABASE_UNAVAILABLE: 'Voting is temporarily unavailable. Please try again later.'
    };
    throw new PulseApiError(messages[code] ?? 'Could not submit your vote. Please try again.', code, true);
  }
  return record(data);
}

export async function claimAccountHistory() {
  const credential = await getInstallationCredential();
  const { data, error } = await client().rpc('claim_installation_history', { p_credential: credential });
  if (error) throw new PulseApiError('Could not synchronize vote history.', error.code, true);
  const row = record(Array.isArray(data) ? data[0] : data);
  return { claimedCount: safeCount(row.claimed_count, 'claimed count'), conflictCount: safeCount(row.conflict_count, 'conflict count') };
}
