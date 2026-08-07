import { DIVIDEND_YIELD } from '../data/constants.js';
import { round2 } from '../utils/format.js';

/** Pay dividends every 7 days for dividend sectors. */
export function applyDividends(game) {
  if (game.day === 0 || game.day % 7 !== 0) return 0;
  let total = 0;
  for (const id of Object.keys(game.portfolio)) {
    const e = game.portfolio[id];
    const s = game.stocks.find((x) => x.id === id);
    if (!s || !e) continue;
    const yieldPct = DIVIDEND_YIELD[s.sector];
    if (!yieldPct) continue;
    const payout = round2(e.shares * s.price * yieldPct);
    total += payout;
  }
  if (total > 0) {
    game.cash = round2(game.cash + total);
    game.totalDividendsEarned = round2((game.totalDividendsEarned || 0) + total);
  }
  return total;
}
