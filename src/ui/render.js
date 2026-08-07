/** Shared DOM render helpers. */
export function setText(id, text) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) el.textContent = text;
}

export function clearChildren(el) {
  if (!el) return;
  el.replaceChildren();
}

/** XSS-safe leaderboard row builder. */
export function appendLeaderboardRow(parent, { rank, name, score, meta, isYou }) {
  const div = document.createElement('div');
  div.className = 'lb-entry' + (isYou ? ' lb-you' : '');
  const rankEl = document.createElement('span');
  rankEl.className = 'lb-rank';
  rankEl.textContent = rank;
  const nameEl = document.createElement('span');
  nameEl.className = 'lb-name';
  nameEl.textContent = name;
  const scoreEl = document.createElement('span');
  scoreEl.className = 'lb-score';
  scoreEl.textContent = score;
  const metaEl = document.createElement('span');
  metaEl.className = 'lb-meta';
  metaEl.textContent = meta;
  div.append(rankEl, nameEl, scoreEl, metaEl);
  parent.appendChild(div);
  return div;
}
