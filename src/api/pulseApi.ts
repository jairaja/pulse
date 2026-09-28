import { supabase } from './supabase';
import { BinaryChoice, DailyQuestion, HeatMapCountry, ResultsSnapshot } from '@/types/domain';

export async function fetchTodayQuestion(countryCode: string): Promise<DailyQuestion> {
  const { data, error } = await supabase.rpc('get_today_question', { p_country: countryCode }).single();
  if (error) throw error;
  return data as DailyQuestion;
}

export async function submitPrediction(questionId: string, prediction: BinaryChoice, deviceId: string) {
  const { error } = await supabase.from('predictions').insert({
    question_id: questionId,
    prediction,
    device_id: deviceId
  });
  if (error) throw error;
}

export async function submitVote(
  questionId: string,
  vote: BinaryChoice,
  deviceId: string,
  countryCode: string
) {
  const { error } = await supabase.from('votes').insert({
    question_id: questionId,
    vote,
    device_id: deviceId,
    country_code: countryCode,
    device_fingerprint: deviceId
  });
  if (error) throw error;
}

export async function fetchResults(
  questionId: string,
  countryCode: string,
  deviceId: string
): Promise<ResultsSnapshot> {
  const { data, error } = await supabase
    .rpc('get_live_results', {
      p_question_id: questionId,
      p_country: countryCode,
      p_device_id: deviceId
    })
    .single();
  if (error) throw error;
  return data as ResultsSnapshot;
}

export async function fetchHeatMap(questionId: string): Promise<HeatMapCountry[]> {
  const { data, error } = await supabase.rpc('get_country_heatmap', { p_question_id: questionId });
  if (error) throw error;
  return (data ?? []) as HeatMapCountry[];
}
