import {
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  SAVE_VERSION,
} from '../config.js';
import { createInitialGame } from '../state.js';
import { STANDARD } from '../data/constants.js';
import { STOCKS_MASTER } from '../data/stocks.js';

export function buildSavePayload(game, meta) {
  return {
    v: SAVE_VERSION,
    day: game.day,
    cash: game.cash,
    portfolio: game.portfolio,
    shorts: game.shorts,
    loan: game.loan,
    stocks: game.stocks.map((s) => ({
      id: s.id,
      price: s.price,
      history: s.history.slice(-120),
    })),
    currentWeek: meta.currentWeek,
    totalWeeks: meta.totalWeeks,
    totalDays: meta.totalDays,
    pendingWeeklyNews: meta.pendingWeeklyNews,
    bonusGiven: game.bonusGiven,
    level: game.level,
    levelUpUnlocked: game.levelUpUnlocked,
    playerName: game.playerName,
    leaderboardPromptShown: game.leaderboardPromptShown,
    achievements: game.achievements,
    completedQuests: game.completedQuests,
    totalTrades: game.totalTrades,
    bestDayProfit: game.bestDayProfit,
    totalProfit: game.totalProfit,
    interestRate: game.interestRate,
    inflation: game.inflation,
    totalDividendsEarned: game.totalDividendsEarned,
    luckyGainDays: game.luckyGainDays || 0,
    pendingComeback: !!game.pendingComeback,
    yearPromptShown: !!game.yearPromptShown,
    history: game.history.slice(-120),
    events: game.events.slice(0, 60),
  };
}

export function saveGame(game, meta) {
  const payload = buildSavePayload(game, meta);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function clearSave() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

function hydrateStocks(savedStocks) {
  const byId = new Map((savedStocks || []).map((s) => [s.id, s]));
  return STOCKS_MASTER.map((m) => {
    const saved = byId.get(m.id);
    const price = saved?.price ?? m.price;
    const history = saved?.history?.length ? saved.history.slice() : [price];
    return {
      ...m,
      price,
      history,
      changePct: 0,
    };
  });
}

function migratePortfolio(portfolio) {
  const out = {};
  for (const [id, e] of Object.entries(portfolio || {})) {
    out[id] = {
      shares: e.shares || 0,
      avgPrice: e.avgPrice || 0,
      boughtDay: e.boughtDay ?? 0,
    };
  }
  return out;
}

export function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const game = createInitialGame(STANDARD.startingMoney);
  game.day = data.day || 0;
  game.cash = data.cash ?? STANDARD.startingMoney;
  game.portfolio = migratePortfolio(data.portfolio);
  game.shorts = data.shorts || {};
  game.loan = data.loan || 0;
  game.stocks = hydrateStocks(data.stocks);
  game.bonusGiven = !!data.bonusGiven;
  game.level = data.level || 1;
  game.levelUpUnlocked = data.levelUpUnlocked || {};
  game.playerName = data.playerName || 'Trader';
  game.leaderboardPromptShown = !!data.leaderboardPromptShown;
  game.achievements = data.achievements || {};
  game.completedQuests = data.completedQuests || {};
  game.totalTrades = data.totalTrades || 0;
  game.bestDayProfit = data.bestDayProfit || 0;
  game.totalProfit = data.totalProfit || 0;
  game.interestRate = data.interestRate ?? 3.5;
  game.inflation = data.inflation ?? 2.1;
  game.totalDividendsEarned = data.totalDividendsEarned || 0;
  game.luckyGainDays = data.luckyGainDays || 0;
  game.pendingComeback = !!data.pendingComeback;
  game.yearPromptShown = !!data.yearPromptShown || !!data.endgamePromptShown;
  game.history = Array.isArray(data.history) ? data.history : [];
  game.events = Array.isArray(data.events) ? data.events : [];

  return {
    game,
    meta: {
      currentWeek: data.currentWeek || 0,
      totalDays: data.totalDays || 365,
      totalWeeks: data.totalWeeks || Math.ceil((data.totalDays || 365) / 7),
      pendingWeeklyNews: data.pendingWeeklyNews || null,
    },
  };
}

export function exportSaveJson(game, meta) {
  return JSON.stringify(buildSavePayload(game, meta), null, 2);
}

export function importSaveJson(text) {
  const data = JSON.parse(text);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, v: SAVE_VERSION }));
  return loadGame();
}
