import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialGame } from '../../src/state.js';
import {
  buildSavePayload,
  loadGame,
  SAVE_VERSION as _sv,
} from '../../src/persist/save.js';
import { SAVE_VERSION, STORAGE_KEY, LEGACY_STORAGE_KEY } from '../../src/config.js';
import { STOCKS_MASTER } from '../../src/data/stocks.js';

// localStorage polyfill for node tests
function installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  return store;
}

describe('save schema v7', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it('serializes complete v7 fields', () => {
    const game = createInitialGame();
    game.day = 42;
    game.cash = 12345.67;
    game.stocks = STOCKS_MASTER.slice(0, 2).map((m) => ({
      ...m,
      history: [m.price],
      changePct: 0,
    }));
    game.portfolio[game.stocks[0].id] = {
      shares: 5,
      avgPrice: 100,
      boughtDay: 35,
    };
    game.achievements = { first_trade: true };
    game.completedQuests = { hold_week: true };
    game.totalTrades = 12;
    game.bestDayProfit = 500;
    game.leaderboardPromptShown = true;
    game.shorts = { [game.stocks[1].id]: { shares: 2, entryPrice: 50 } };
    game.loan = 1000;
    game.interestRate = 4.2;
    game.inflation = 2.5;

    const obj = buildSavePayload(game, {
      currentWeek: 6,
      totalWeeks: 52,
      totalDays: 365,
      pendingWeeklyNews: null,
    });
    expect(obj.v).toBe(SAVE_VERSION);
    expect(obj.achievements.first_trade).toBe(true);
    expect(obj.completedQuests.hold_week).toBe(true);
    expect(obj.totalTrades).toBe(12);
    expect(obj.bestDayProfit).toBe(500);
    expect(obj.leaderboardPromptShown).toBe(true);
    expect(obj.shorts).toBeTruthy();
    expect(obj.loan).toBe(1000);
    expect(obj.interestRate).toBe(4.2);
    expect(obj.portfolio[game.stocks[0].id].boughtDay).toBe(35);
  });

  it('loads legacy v6-shaped save and migrates', () => {
    const v6 = {
      v: 6,
      day: 10,
      cash: 9000,
      portfolio: { [STOCKS_MASTER[0].id]: { shares: 2, avgPrice: 50 } },
      stocks: [{ id: STOCKS_MASTER[0].id, price: 55, history: [50, 55] }],
      currentWeek: 1,
      totalDays: 365,
      level: 1,
      playerName: 'Legacy',
    };
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(v6));
    const loaded = loadGame();
    expect(loaded).toBeTruthy();
    expect(loaded.game.day).toBe(10);
    expect(loaded.game.playerName).toBe('Legacy');
    expect(loaded.game.portfolio[STOCKS_MASTER[0].id].boughtDay).toBe(0);
    expect(loaded.game.achievements).toEqual({});
    expect(loaded.meta.totalDays).toBe(365);
  });

  it('round-trips via localStorage v7 key', () => {
    const game = createInitialGame();
    game.day = 7;
    game.stocks = STOCKS_MASTER.slice(0, 1).map((m) => ({
      ...m,
      history: [m.price],
      changePct: 0,
    }));
    const payload = buildSavePayload(game, {
      currentWeek: 1,
      totalWeeks: 52,
      totalDays: 365,
      pendingWeeklyNews: null,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const loaded = loadGame();
    expect(loaded.game.day).toBe(7);
    expect(loaded.meta.totalDays).toBe(365);
  });
});
