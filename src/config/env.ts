import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? String(extra.supabaseUrl ?? ''),
  supabasePublishableKey:
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    String(extra.supabasePublishableKey ?? extra.supabaseAnonKey ?? ''),
  pulseWebsiteUrl:
    process.env.EXPO_PUBLIC_WEBSITE_URL ?? 'https://pulse-world.example.com'
};
