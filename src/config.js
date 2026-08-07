export const STORAGE_KEY = 'marketSim_v7_tilemode';
export const LEGACY_STORAGE_KEY = 'marketSim_v6_tilemode';
export const LEADERBOARD_KEY = 'marketSim_v6_leaderboard';
export const LEADERBOARD_PROMPT_PROFIT = 500;
export const SAVE_VERSION = 7;

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const INITIAL_TOTAL_DAYS = 365;
export const EXTENDED_TOTAL_DAYS = 700;

export function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_URL &&
      SUPABASE_ANON_KEY &&
      !SUPABASE_URL.includes('YOUR_SUPABASE') &&
      !SUPABASE_URL.includes('your-project') &&
      !SUPABASE_ANON_KEY.includes('YOUR_') &&
      !SUPABASE_ANON_KEY.includes('your-anon')
  );
}
