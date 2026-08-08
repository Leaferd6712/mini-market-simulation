import { LB_API_BASE, isLeaderboardConfigured } from '../config.js';
import { sanitizePlayerName, clampScorePayload } from '../utils/sanitize.js';

let _globalPlayerName = null;

export function getGlobalPlayerName() {
  return _globalPlayerName;
}

export { isLeaderboardConfigured, isLeaderboardConfigured as isSupabaseConfigured };

/**
 * Submit score to the laptop API (via tunnel when online).
 * Returns rank number or null.
 */
export async function submitGlobalScore(playerName, score, day, level) {
  if (!isLeaderboardConfigured()) return null;
  const name = sanitizePlayerName(playerName);
  if (!name) return null;
  const payload = clampScorePayload({ score, day, level });
  _globalPlayerName = name;

  try {
    const res = await fetch(`${LB_API_BASE}/api/submit-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  if (!isLeaderboardConfigured()) throw new Error('Leaderboard API not configured');

  const params = new URLSearchParams({ limit: '50' });
  if (_globalPlayerName) params.set('name', _globalPlayerName);

  const res = await fetch(`${LB_API_BASE}/api/leaderboard?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  const top10 = Array.isArray(data.top10)
    ? data.top10
    : Array.isArray(data.entries)
      ? data.entries.slice(0, 10)
      : [];

  return {
    top10,
    playerRank: typeof data.playerRank === 'number' ? data.playerRank : null,
    total: typeof data.total === 'number' ? data.total : top10.length,
  };
}
