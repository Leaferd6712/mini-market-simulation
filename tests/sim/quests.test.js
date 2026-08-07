import { describe, it, expect } from 'vitest';
import { DAILY_QUESTS } from '../../src/data/quests.js';
import { createInitialGame } from '../../src/state.js';
import { STOCKS_MASTER } from '../../src/data/stocks.js';

describe('hold_week quest', () => {
  it('completes when a position is held 7+ days', () => {
    const quest = DAILY_QUESTS.find((q) => q.id === 'hold_week');
    const game = createInitialGame();
    game.stocks = STOCKS_MASTER.slice(0, 3).map((m) => ({ ...m, history: [m.price], changePct: 0 }));
    game.day = 10;
    game.portfolio = {
      [game.stocks[0].id]: { shares: 5, avgPrice: 100, boughtDay: 2 },
    };
    expect(quest.check(game)).toBe(true);
  });

  it('fails when held fewer than 7 days', () => {
    const quest = DAILY_QUESTS.find((q) => q.id === 'hold_week');
    const game = createInitialGame();
    game.stocks = STOCKS_MASTER.slice(0, 3).map((m) => ({ ...m, history: [m.price], changePct: 0 }));
    game.day = 5;
    game.portfolio = {
      [game.stocks[0].id]: { shares: 5, avgPrice: 100, boughtDay: 3 },
    };
    expect(quest.check(game)).toBe(false);
  });
});
