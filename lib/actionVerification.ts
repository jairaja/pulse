import * as Crypto from 'expo-crypto';
import { getInstallationCredential } from './installation';
import { collectClientDeviceEvidence } from './deviceIntegrity';
import { supabase } from './supabase';

export function sessionId(token: string): string {
  const value = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id;
  if (typeof value !== 'string') throw new Error('Sign in again.');
  return value;
}
export async function prepareAction(purpose: string, target: unknown, token?: string, requestId = Crypto.randomUUID()) {
  const accessToken = token ?? (await supabase?.auth.getSession())?.data.session?.access_token;
  if (!accessToken) throw new Error('Sign in to continue.');
  const credential = await getInstallationCredential();
  const deviceEvidence = await collectClientDeviceEvidence();
  const captchaBinding = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify([credential, sessionId(accessToken), purpose, target, requestId]));
  return { credential, deviceEvidence, requestId, captchaBinding };
}
export type ActionProof = Awaited<ReturnType<typeof prepareAction>> & { captchaToken: string };
export async function invokeAction(name: string, body: Record<string, unknown>, token?: string) {
  if (!supabase) throw new Error('PULSE is not configured.');
  const { data, error } = await supabase.functions.invoke(name, {
    body, ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {})
  });
  if (error) {
    let message = 'Could not complete this action. Please try again.';
    try { const result = await error.context?.json(); if (typeof result?.error === 'string') message = result.error; } catch { /* Transport failure. */ }
    throw new Error(message);
  }
  return data;
}
