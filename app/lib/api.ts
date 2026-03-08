import { supabase } from '@/app/lib/supabase';

export async function getTodayQuestion() {
  const { data, error } = await supabase.rpc('get_today_question_with_translations');
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function submitPrediction(params: {
  questionId: string;
  prediction: 'YES' | 'NO';
  deviceId: string;
  countryCode: string;
}) {
  const { error } = await supabase.from('predictions').insert({
    question_id: params.questionId,
    prediction: params.prediction,
    device_id: params.deviceId,
    country_code: params.countryCode
  });
  if (error) throw error;
}

export async function submitVote(params: {
  questionId: string;
  vote: 'YES' | 'NO';
  deviceId: string;
  countryCode: string;
}) {
  const { error } = await supabase.from('votes').insert({
    question_id: params.questionId,
    vote: params.vote,
    device_id: params.deviceId,
    country_code: params.countryCode
  });
  if (error) throw error;
}

export async function getLiveResults(questionId: string) {
  const { data, error } = await supabase.rpc('get_live_question_results', {
    p_question_id: questionId
  });
  if (error) throw error;
  return data;
}
