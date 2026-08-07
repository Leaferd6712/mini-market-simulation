import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isSupabaseConfigured,
} from '../config.js';
import { sanitizePlayerName, clampScorePayload } from '../utils/sanitize.js';

let _globalPlayerName = null;

export function getGlobalPlayerName() {
  return _globalPlayerName;
}

export { isSupabaseConfigured };

/**
 * Submit score via Edge Function (no direct table writes).
 * Returns rank number or null.
 */
export async function submitGlobalScore(playerName, score, day, level) {
  if (!isSupabaseConfigured()) return null;
  const name = sanitizePlayerName(playerName);
  if (!name) return null;
  const payload = clampScorePayload({ score, day, level });
  _globalPlayerName = name;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        player_name: name,
        score: payload.score,
        day: payload.day,
        level: payload.level,
      }),
    });
    if (!res.ok) {
      console.warn('Score submit failed:', res.status);
      return null;
    }
    const data = await res.json();
    return typeof data.rank === 'number' ? data.rank : null;
  } catch (e) {
    console.error('submitGlobalScore:', e);
    return null;
  }
}

export async function fetchGlobalLeaderboard() {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  const allRes = await fetch(
    `${SUPABASE_URL}/rest/v1/leaderboard?select=player_name,score,day,level&order=score.desc`,
    { headers }
  );
  if (!allRes.ok) throw new Error(`HTTP ${allRes.status}`);
  const rows = await allRes.json();

  const seen = new Set();
  const uniqueRows = [];
  for (const row of rows) {
    const key = (row.player_name || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(row);
  }

  const top10 = uniqueRows.slice(0, 10);
  let playerRank = null;
  if (_globalPlayerName) {
    const key = _globalPlayerName.trim().toLowerCase();
    const idx = uniqueRows.findIndex((r) => (r.player_name || '').trim().toLowerCase() === key);
    if (idx >= 0) playerRank = idx + 1;
  }

  return { top10, playerRank, total: uniqueRows.length };
}
