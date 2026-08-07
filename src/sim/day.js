import {
  TREND_DAILY_BIAS,
  SHOCK_PROB_SURGE,
  SHOCK_PROB_FALL,
  STANDARD,
} from '../data/constants.js';
import { round2, rand, capArray } from '../utils/format.js';
import { netWorth } from '../state.js';
import { applyLoanInterest, marginCallLiquidate } from './trading.js';
import { applyDividends } from './dividends.js';

function getEcoMod(game, sector) {
  let mod = 0;
  const ir = game.interestRate;
  const inf = game.inflation;
  if (sector === 'Tech') {
    if (ir > 5) mod -= 0.004;
    if (ir < 3) mod += 0.003;
  }
  if (sector === 'Finance') {
    if (ir > 5) mod += 0.005;
    if (ir < 3) mod -= 0.002;
  }
  if (sector === 'Biotech') {
    if (ir > 6) mod -= 0.003;
  }
  if (sector === 'Retail') {
    if (inf > 4) mod -= 0.004;
    if (inf < 2) mod += 0.002;
  }
  if (sector === 'Transport') {
    if (inf > 4) mod -= 0.003;
  }
  if (sector === 'Energy') {
    if (inf > 4) mod += 0.004;
  }
  return mod;
}

function evaluateMarketState(game) {
  const days = 7;
  let sum = 0;
  let count = 0;
  for (const s of game.stocks) {
    if (s.history.length < 2) continue;
    const N = Math.min(days, s.history.length - 1);
    let local = 0;
    for (let i = 1; i <= N; i++) {
      const prev = s.history[s.history.length - 1 - i];
      const cur = s.history[s.history.length - i];
      if (prev > 0) local += (cur - prev) / prev;
    }
    if (N > 0) {
      sum += local / N;
      count++;
    }
  }
  const avg = count > 0 ? sum / count : 0;
  if (avg > 0.002) game.marketState = 'Bull';
  else if (avg < -0.002) game.marketState = 'Bear';
  else game.marketState = 'Sideways';
}

/**
 * Advance one simulation day. Mutates game.
 */
export function applySingleDay(game, weeklyNews) {
  const previousNetworth =
    game.history.length > 0 ? game.history[game.history.length - 1].networth : game.cash;

  game.day++;
  evaluateMarketState(game);

  if (game.day % 7 === 0) {
    game.interestRate = Math.max(1, Math.min(9, game.interestRate + (Math.random() * 1.4 - 0.7)));
    game.inflation = Math.max(0.5, Math.min(7, game.inflation + (Math.random() * 1.2 - 0.5)));
  }

  const sectorMultMap = {
    Tech: 1.05,
    Energy: 1.05,
    Retail: 0.95,
    Finance: 0.9,
    Transport: 1.0,
    Biotech: 1.15,
  };
  const marketShock = weeklyNews?.impactMap?.market || 0;

  for (const s of game.stocks) {
    const sectorMult = (s.sector && sectorMultMap[s.sector]) || 1;
    const vol = (s.volatility || 1) * STANDARD.volatilityMultiplier * sectorMult;
    let drift =
      TREND_DAILY_BIAS * (game.marketState === 'Bull' ? 1 : game.marketState === 'Bear' ? -1 : 0);
    drift += getEcoMod(game, s.sector);

    if (weeklyNews?.impactMap) {
      const sectorImpact = weeklyNews.impactMap[s.sector] || 0;
      drift += sectorImpact / 7;
    }
    if (marketShock) drift += marketShock / 7;

    let shock = 0;
    if (Math.random() < SHOCK_PROB_SURGE) shock += rand(0.03, 0.08);
    if (Math.random() < SHOCK_PROB_FALL) shock -= rand(0.03, 0.08);

    const noise = rand(-1, 1) * vol * 0.02;
    const change = drift + noise + shock;
    s.price = Math.max(0.5, round2(s.price * (1 + change)));
    s.changePct = change;
    s.history.push(s.price);
    capArray(s.history, 200);
  }

  applyLoanInterest(game);
  const divPaid = applyDividends(game);
  const margin = marginCallLiquidate(game);

  const nw = netWorth(game);
  const dayProfit = round2(nw - previousNetworth);
  const dayReturn = previousNetworth > 0 ? dayProfit / previousNetworth : 0;

  if (dayProfit > (game.bestDayProfit || 0)) game.bestDayProfit = dayProfit;

  if (dayProfit <= -1000) game.pendingComeback = true;
  if (game.pendingComeback && dayProfit >= 1000) {
    game.comebackReady = true;
    game.pendingComeback = false;
  }

  if (dayReturn >= 0.05) game.luckyGainDays = (game.luckyGainDays || 0) + 1;

  game.history.push({ day: game.day, networth: nw, cash: game.cash, dividend: divPaid });
  capArray(game.history, 400);
  game.lastDaySharesBought = 0;

  return { dayProfit, dayReturn, marginCall: margin.triggered, dividend: divPaid };
}
