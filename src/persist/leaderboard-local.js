import { LEADERBOARD_KEY } from '../config.js';
import { sanitizePlayerName } from '../utils/sanitize.js';

export function getLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

export function setLeaderboard(list) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list));
}

/**
 * Upsert local score by player name (case-insensitive). Keeps best score.
 */
export function upsertLocalScore({ name, score, day, level }) {
  const cleanName = sanitizePlayerName(name) || 'Player';
  const board = getLeaderboard();
  const key = cleanName.toLowerCase();
  const existingIndex = board.findIndex((entry) => (entry.name || '').trim().toLowerCase() === key);
  let keptExisting = false;
  if (existingIndex >= 0) {
    if (score > Number(board[existingIndex].score || 0)) {
      board[existingIndex] = {
        ...board[existingIndex],
        name: cleanName,
        score,
        day,
        level,
        date: new Date().toISOString(),
      };
    } else {
      keptExisting = true;
    }
  } else {
    board.push({
      name: cleanName,
      score,
      day,
      level,
      date: new Date().toISOString(),
    });
  }
  board.sort((a, b) => b.score - a.score);
  setLeaderboard(board.slice(0, 50));
  return { cleanName, keptExisting };
}
