import { ACHIEVEMENTS } from '../data/achievements.js';
import { CATEGORIES } from '../data/constants.js';
import { netWorth } from '../state.js';
import { round2 } from '../utils/format.js';

export function checkAchievements(game, { onUnlock } = {}) {
  const nw = round2(netWorth(game));

  const tryUnlock = (id) => {
    if (game.achievements[id] || !ACHIEVEMENTS[id]) return;
    game.achievements[id] = true;
    onUnlock?.(ACHIEVEMENTS[id]);
  };

  if (game.totalTrades >= 1) tryUnlock('first_trade');
  if (nw >= 1000000) tryUnlock('millionaire');
  if (game.totalTrades >= 100) tryUnlock('day_trader');

  const sectors = new Set(
    Object.keys(game.portfolio)
      .map((id) => game.stocks.find((s) => s.id === id)?.sector)
      .filter(Boolean)
  );
  if (sectors.size === CATEGORIES.length) tryUnlock('diversified');
  if (game.level >= 4) tryUnlock('fortune_500');
  if (game.day >= 365) tryUnlock('market_master');

  if (game.comebackReady) {
    tryUnlock('comeback_kid');
    game.comebackReady = false;
  }

  if ((game.luckyGainDays || 0) >= 10) tryUnlock('lucky_trader');
}
