import { supabase } from '@/lib/supabase';
import { BinaryChoice, Question, ResultSnapshot } from '@/types/domain';

export async function fetchTodayQuestion(language = 'en'): Promise<Question> {
  const { data, error } = await supabase.rpc('get_today_question', { p_language: language }).single();
  if (error) throw error;
  return data;
}

export async function submitPrediction(questionId: string, choice: BinaryChoice, deviceId: string) {
  const { error } = await supabase.from('predictions').upsert({ question_id: questionId, prediction: choice, device_id: deviceId });
  if (error) throw error;
}

export async function submitVote(questionId: string, choice: BinaryChoice, deviceId: string, countryCode: string) {
  const { error } = await supabase.from('votes').upsert({ question_id: questionId, vote: choice, device_id: deviceId, country_code: countryCode });
  if (error) throw error;
}

export async function fetchResults(questionId: string, countryCode: string): Promise<ResultSnapshot> {
  const { data, error } = await supabase.rpc('get_live_results', { p_question_id: questionId, p_country_code: countryCode }).single();
  if (error) throw error;
  return data;
}

export async function fetchAnsweredHistory(deviceId: string) {
  const { data, error } = await supabase.rpc('get_answered_history', { p_device_id: deviceId });
  if (error) throw error;
  return data;
}
