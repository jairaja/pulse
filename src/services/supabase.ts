import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

const extra = Constants.expoConfig?.extra as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

export const supabase = createClient(
  extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  extra?.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
);
