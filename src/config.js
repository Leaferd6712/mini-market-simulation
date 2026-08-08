export const STORAGE_KEY = 'marketSim_v7_tilemode';
export const LEGACY_STORAGE_KEY = 'marketSim_v6_tilemode';
export const LEADERBOARD_KEY = 'marketSim_v6_leaderboard';
export const LEADERBOARD_PROMPT_PROFIT = 500;
export const SAVE_VERSION = 7;

/** Base URL for the laptop leaderboard API (no trailing slash). */
export const LB_API_BASE = String(import.meta.env.VITE_LB_API_BASE || '').replace(/\/$/, '');

export const INITIAL_TOTAL_DAYS = 365;
export const EXTENDED_TOTAL_DAYS = 700;

export function isLeaderboardConfigured() {
  return Boolean(LB_API_BASE && /^https?:\/\//i.test(LB_API_BASE));
}

/** @deprecated Use isLeaderboardConfigured */
export const isSupabaseConfigured = isLeaderboardConfigured;
