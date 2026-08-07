import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialGame } from '../../src/state.js';
import { buyShares, sellShares, openShort, coverShort } from '../../src/sim/trading.js';
import { STOCKS_MASTER } from '../../src/data/stocks.js';

function seed() {
  const game = createInitialGame();
  game.stocks = STOCKS_MASTER.slice(0, 5).map((s) => ({
    id: s.id,
    name: s.name,
    sector: s.sector,
    price: 100,
    volatility: 1,
    changePct: 0,
    history: [100],
  }));
  game.cash = 10000;
  return game;
}

describe('trading', () => {
  let game;
  beforeEach(() => {
    game = seed();
  });

  it('buys shares and tracks boughtDay', () => {
    game.day = 10;
    const id = game.stocks[0].id;
    const r = buyShares(game, id, 3);
    expect(r.ok).toBe(true);
    expect(game.portfolio[id].shares).toBe(3);
    expect(game.portfolio[id].boughtDay).toBe(10);
    expect(game.cash).toBe(9700);
    expect(game.totalTrades).toBe(1);
  });

  it('rejects buy when cash insufficient', () => {
    game.cash = 50;
    expect(buyShares(game, game.stocks[0].id, 1).ok).toBe(false);
  });

  it('sells shares and records profit pct', () => {
    const id = game.stocks[0].id;
    buyShares(game, id, 2);
    game.stocks[0].price = 150;
    const r = sellShares(game, id, 2);
    expect(r.ok).toBe(true);
    expect(r.profitPct).toBeCloseTo(0.5);
    expect(game.portfolio[id]).toBeUndefined();
  });

  it('opens and covers a short', () => {
    const id = game.stocks[0].id;
    const open = openShort(game, id, 2);
    expect(open.ok).toBe(true);
    expect(game.shorts[id].shares).toBe(2);
    game.stocks[0].price = 80;
    const cover = coverShort(game, id);
    expect(cover.ok).toBe(true);
    expect(cover.pnl).toBe(40);
    expect(game.shorts[id]).toBeUndefined();
  });
});
