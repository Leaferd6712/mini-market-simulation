const NAME_MAX = 30;
const NAME_RE = /[^a-zA-Z0-9 _\-'.]/g;

/** Strip HTML/tags and restrict leaderboard names. */
export function sanitizePlayerName(raw) {
  let name = String(raw ?? '');
  name = name.replace(/<[^>]*>/g, '');
  name = name.replace(/&[#a-zA-Z0-9]+;/g, '');
  name = name.replace(NAME_RE, '').trim().replace(/\s+/g, ' ');
  if (name.length > NAME_MAX) name = name.slice(0, NAME_MAX).trim();
  return name;
}

export function isValidPlayerName(name) {
  return sanitizePlayerName(name).length >= 1;
}

/** Clamp score fields to plausible educational-sim ranges. */
export function clampScorePayload({ score, day, level }) {
  const s = Number(score);
  const d = Number(day);
  const l = Number(level);
  return {
    score: Number.isFinite(s) ? Math.max(0, Math.min(s, 1e12)) : 0,
    day: Number.isFinite(d) ? Math.max(0, Math.min(Math.floor(d), 10000)) : 0,
    level: Number.isFinite(l) ? Math.max(1, Math.min(Math.floor(l), 4)) : 1,
  };
}

export function clampScore(score) {
  return clampScorePayload({ score, day: 0, level: 1 }).score;
}

export function clampDay(day) {
  return clampScorePayload({ score: 0, day, level: 1 }).day;
}

export function clampLevel(level) {
  return clampScorePayload({ score: 0, day: 0, level }).level;
}

/** Escape text for safe insertion when building HTML strings (prefer textContent). */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
