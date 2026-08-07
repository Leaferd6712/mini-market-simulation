import { round2 } from '../utils/format.js';
import { LOAN_DAILY_INTEREST } from '../data/constants.js';
import { netWorth, portfolioValue } from '../state.js';

export function buyShares(game, stockId, shares) {
  const s = game.stocks.find((x) => x.id === stockId);
  const qty = Math.floor(shares);
  if (!s || qty <= 0) return { ok: false, error: 'Invalid trade' };
  const cost = round2(qty * s.price);
  if (cost > game.cash) return { ok: false, error: 'Not enough cash' };
  const prev = game.portfolio[s.id] || { shares: 0, avgPrice: 0, boughtDay: game.day };
  const newTotal = prev.shares + qty;
  const newAvg = newTotal > 0 ? round2((prev.shares * prev.avgPrice + qty * s.price) / newTotal) : s.price;
  game.portfolio[s.id] = {
    shares: newTotal,
    avgPrice: newAvg,
    boughtDay: prev.shares > 0 ? prev.boughtDay ?? game.day : game.day,
  };
  game.cash = round2(game.cash - cost);
  game.lastDaySharesBought = (game.lastDaySharesBought || 0) + qty;
  game.totalTrades++;
  return { ok: true, cost };
}

export function sellShares(game, stockId, shares) {
  const s = game.stocks.find((x) => x.id === stockId);
  const qty = Math.floor(shares);
  if (!s || qty <= 0) return { ok: false, error: 'Invalid trade' };
  const owned = game.portfolio[s.id]?.shares || 0;
  if (owned <= 0) return { ok: false, error: "You don't own shares" };
  if (qty > owned) return { ok: false, error: 'Not that many shares' };
  const avgPrice = game.portfolio[s.id].avgPrice;
  const proceeds = round2(qty * s.price);
  const pnl = round2(qty * (s.price - avgPrice));
  const profitPct = avgPrice > 0 ? (s.price - avgPrice) / avgPrice : 0;
  game.cash = round2(game.cash + proceeds);
  const remaining = owned - qty;
  if (remaining === 0) delete game.portfolio[s.id];
  else game.portfolio[s.id] = { ...game.portfolio[s.id], shares: remaining };
  game.lastSaleProfitPct = Math.max(game.lastSaleProfitPct || 0, profitPct);
  game.totalProfit = round2((game.totalProfit || 0) + pnl);
  game.totalTrades++;
  return { ok: true, proceeds, pnl, profitPct };
}

export function openShort(game, stockId, shares) {
  const s = game.stocks.find((x) => x.id === stockId);
  const qty = Math.floor(shares);
  if (!s || qty <= 0) return { ok: false, error: 'Invalid short' };
  const existing = game.shorts[s.id];
  if (existing) {
    const total = existing.shares + qty;
    const entry = round2((existing.shares * existing.entryPrice + qty * s.price) / total);
    game.shorts[s.id] = { shares: total, entryPrice: entry };
  } else {
    game.shorts[s.id] = { shares: qty, entryPrice: s.price };
  }
  game.totalTrades++;
  return { ok: true };
}

export function coverShort(game, stockId, shares) {
  const s = game.stocks.find((x) => x.id === stockId);
  const pos = game.shorts[stockId];
  if (!s || !pos) return { ok: false, error: 'No short position' };
  const qty = shares == null ? pos.shares : Math.floor(shares);
  if (qty <= 0 || qty > pos.shares) return { ok: false, error: 'Invalid cover amount' };
  const pnl = round2(qty * (pos.entryPrice - s.price));
  game.cash = round2(game.cash + pnl);
  const remaining = pos.shares - qty;
  if (remaining === 0) delete game.shorts[stockId];
  else game.shorts[stockId] = { ...pos, shares: remaining };
  game.totalTrades++;
  game.totalProfit = round2((game.totalProfit || 0) + pnl);
  return { ok: true, pnl };
}

export function borrowLoan(game, amount) {
  const amt = Math.floor(Number(amount) || 0);
  if (amt < 1000) return { ok: false, error: 'Minimum borrow is $1,000' };
  const maxLoan = Math.max(0, Math.floor(netWorth(game) * 0.5 - (game.loan || 0)));
  if (amt > maxLoan) return { ok: false, error: 'Exceeds max borrow' };
  game.loan = round2((game.loan || 0) + amt);
  game.cash = round2(game.cash + amt);
  return { ok: true };
}

export function repayLoan(game, amount) {
  const owed = game.loan || 0;
  if (owed <= 0) return { ok: false, error: 'No loan' };
  const amt = Math.min(owed, Math.floor(Number(amount) || owed), game.cash);
  if (amt <= 0) return { ok: false, error: 'Cannot repay' };
  game.loan = round2(owed - amt);
  game.cash = round2(game.cash - amt);
  return { ok: true, repaid: amt };
}

export function applyLoanInterest(game) {
  if ((game.loan || 0) <= 0) return 0;
  const interest = round2(game.loan * LOAN_DAILY_INTEREST);
  game.loan = round2(game.loan + interest);
  return interest;
}

/** Force-sell portfolio to cover loan when NW < loan. */
export function marginCallLiquidate(game) {
  const nw = netWorth(game);
  if ((game.loan || 0) <= 0 || nw >= game.loan) return { triggered: false };
  for (const id of Object.keys(game.portfolio)) {
    sellShares(game, id, game.portfolio[id].shares);
  }
  for (const id of Object.keys(game.shorts)) {
    coverShort(game, id);
  }
  const repay = Math.min(game.cash, game.loan);
  game.cash = round2(game.cash - repay);
  game.loan = round2(game.loan - repay);
  return { triggered: true, repaid: repay };
}

export function maxBorrowable(game) {
  return Math.max(0, Math.floor(netWorth(game) * 0.5 - (game.loan || 0)));
}

export { portfolioValue, netWorth };
