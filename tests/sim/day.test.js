import { describe, it, expect } from 'vitest';
import { createInitialGame, netWorth } from '../../src/state.js';
import { applySingleDay } from '../../src/sim/day.js';
import { STOCKS_MASTER } from '../../src/data/stocks.js';
import { generateWeeklyNews } from '../../src/sim/news.js';
import { MAJOR_EVENTS } from '../../src/data/news.js';
import { checkAchievements } from '../../src/sim/achievements.js';

function seedGame() {
  const game = createInitialGame(10000);
  game.stocks = STOCKS_MASTER.slice(0, 12).map((m) => ({
    ...m,
    history: [m.price],
    changePct: 0,
  }));
  return game;
}

describe('applySingleDay', () => {
  it('advances day and keeps prices finite and positive', () => {
    const game = seedGame();
    const before = game.day;
    applySingleDay(game, { impactMap: { Tech: 0.05 } });
    expect(game.day).toBe(before + 1);
    for (const s of game.stocks) {
      expect(Number.isFinite(s.price)).toBe(true);
      expect(s.price).toBeGreaterThan(0);
    }
    expect(game.history.length).toBe(1);
    expect(Number.isFinite(netWorth(game))).toBe(true);
  });

  it('applies market-wide major shock without NaN', () => {
    const game = seedGame();
    applySingleDay(game, { impactMap: { market: -0.2 } });
    for (const s of game.stocks) {
      expect(Number.isNaN(s.price)).toBe(false);
    }
  });
});

describe('news + achievements helpers', () => {
  it('MAJOR_EVENTS define market effects', () => {
    for (const e of MAJOR_EVENTS) {
      expect(typeof e.effects.market).toBe('number');
    }
  });

  it('generateWeeklyNews only references live sectors', () => {
    const game = createInitialGame();
    game.stocks = STOCKS_MASTER.filter((s) => s.sector === 'Tech').map((m) => ({
      ...m,
      history: [m.price],
      changePct: 0,
    }));
    const news = generateWeeklyNews(game);
    expect(news.headline).toBeTruthy();
    for (const sector of news.sectors) {
      expect(game.stocks.some((s) => s.sector === sector)).toBe(true);
    }
  });

  it('wires comeback_kid and lucky_trader', () => {
    const game = createInitialGame();
    game.comebackReady = true;
    game.luckyGainDays = 10;
    checkAchievements(game);
    expect(game.achievements.comeback_kid).toBe(true);
    expect(game.achievements.lucky_trader).toBe(true);
  });
});
