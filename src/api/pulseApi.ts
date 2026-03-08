import { supabase } from '@/services/supabase';
import { BinaryChoice, MyPulseMetrics, PulseResult, Question } from '@/types/domain';

export const pulseApi = {
  async getTodayQuestion(languageCode: string): Promise<Question> {
    const { data, error } = await supabase
      .from('daily_question_view')
      .select('*')
      .eq('language_code', languageCode)
      .single();

    if (error) throw error;
    return data as Question;
  },

  async submitPrediction(params: {
    questionId: string;
    userId: string;
    prediction: BinaryChoice;
  }): Promise<void> {
    const { error } = await supabase.from('predictions').insert({
      question_id: params.questionId,
      user_id: params.userId,
      prediction: params.prediction,
    });

    if (error) throw error;
  },

  async submitVote(params: {
    questionId: string;
    userId: string;
    deviceId: string;
    countryCode: string;
    choice: BinaryChoice;
  }): Promise<void> {
    const { error } = await supabase.from('votes').insert({
      question_id: params.questionId,
      user_id: params.userId,
      device_id: params.deviceId,
      country_code: params.countryCode,
      choice: params.choice,
    });

    if (error) throw error;
  },

  async getResult(questionId: string, countryCode: string): Promise<PulseResult> {
    const { data, error } = await supabase.rpc('get_pulse_result', {
      p_question_id: questionId,
      p_country_code: countryCode,
    });

    if (error) throw error;
    return data as PulseResult;
  },

  async getMyPulse(userId: string): Promise<MyPulseMetrics> {
    const { data, error } = await supabase.rpc('get_my_pulse_metrics', {
      p_user_id: userId,
    });

    if (error) throw error;
    return data as MyPulseMetrics;
  },
};
