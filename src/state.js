import { STANDARD } from './data/constants.js';
import { INITIAL_TOTAL_DAYS } from './config.js';

export function createInitialGame(startingMoney = STANDARD.startingMoney) {
  return {
    stocks: [],
    day: 0,
    cash: startingMoney,
    portfolio: {},
    events: [],
    history: [],
    cyclesCompleted: 0,
    marketState: 'Sideways',
    bonusGiven: false,
    level: 1,
    levelUpUnlocked: {},
    playerName: 'Trader',
    achievements: {},
    totalTrades: 0,
    bestDayProfit: 0,
    streakDays: 0,
    totalProfit: 0,
    completedQuests: {},
    lastDaySharesBought: 0,
    lastSaleProfitPct: 0,
    interestRate: 3.5,
    inflation: 2.1,
    shorts: {},
    loan: 0,
    totalDividendsEarned: 0,
    leaderboardPromptShown: false,
    luckyGainDays: 0,
    pendingComeback: false,
    comebackReady: false,
    yearPromptShown: false,
    hadLargeDrawdown: false,
    endgamePromptShown: false,
  };
}

/** Shared mutable game used by pure sim helpers / tests. UI app.js keeps its own copy. */
export const game = createInitialGame();

export const runtime = {
  totalDays: INITIAL_TOTAL_DAYS,
  totalWeeks: Math.ceil(INITIAL_TOTAL_DAYS / 7),
  currentWeek: 0,
  pendingWeeklyNews: null,
};

export function resetGameFields() {
  const fresh = createInitialGame();
  Object.keys(fresh).forEach((k) => {
    game[k] = fresh[k];
  });
}

export function portfolioValue(g = game) {
  return Object.keys(g.portfolio).reduce((acc, id) => {
    const e = g.portfolio[id];
    const s = g.stocks.find((x) => x.id === id);
    return acc + (s ? s.price * e.shares : 0);
  }, 0);
}

export function shortPnL(g = game) {
  return Object.keys(g.shorts || {}).reduce((acc, id) => {
    const pos = g.shorts[id];
    const s = g.stocks.find((x) => x.id === id);
    if (!s || !pos) return acc;
    return acc + pos.shares * (pos.entryPrice - s.price);
  }, 0);
}

export function netWorth(g = game) {
  return Math.round((g.cash + portfolioValue(g) + shortPnL(g) - (g.loan || 0)) * 100) / 100;
}

export function unrealisedPnL(g = game) {
  return Object.keys(g.portfolio).reduce((acc, id) => {
    const e = g.portfolio[id];
    const s = g.stocks.find((x) => x.id === id);
    if (!s || !e) return acc;
    return acc + (s.price - e.avgPrice) * e.shares;
  }, 0);
}
