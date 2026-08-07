/** Daily quests. hold_week uses portfolio boughtDay tracking. */
export const DAILY_QUESTS = [
  {
    id: 'earn_5k',
    title: '💰 Earn $5,000',
    description: 'Make a daily profit of at least $5,000',
    check: (game) => {
      const n = game.history.length;
      if (n < 2) return false;
      return game.history[n - 1].networth - game.history[n - 2].networth >= 5000;
    },
    reward: 500,
  },
  {
    id: 'buy_stocks',
    title: '📈 Buy 50 Shares',
    description: 'Purchase exactly 50 shares in a single day',
    check: (game) => game.lastDaySharesBought >= 50,
    reward: 300,
  },
  {
    id: 'diversify',
    title: '🌍 Own 5 Categories',
    description: 'Hold stocks in 5 different sectors',
    check: (game) => {
      const cats = new Set(
        Object.keys(game.portfolio).map((id) => game.stocks.find((s) => s.id === id)?.sector)
      );
      return cats.size >= 5;
    },
    reward: 400,
  },
  {
    id: 'hold_week',
    title: '📅 Hold for 7 Days',
    description: 'Keep a stock for 7 consecutive days',
    check: (game) => {
      for (const id of Object.keys(game.portfolio)) {
        const e = game.portfolio[id];
        const boughtDay = e.boughtDay ?? game.day;
        if (game.day - boughtDay >= 7) return true;
      }
      return false;
    },
    reward: 350,
  },
  {
    id: 'sell_profit',
    title: '✅ Sell for 20% Profit',
    description: 'Sell a stock for 20% or more profit',
    check: (game) => game.lastSaleProfitPct >= 0.2,
    reward: 380,
  },
  {
    id: 'avoid_loss',
    title: '🛡️ No Losses Today',
    description: 'Finish the day without losing money',
    check: (game) => {
      const n = game.history.length;
      if (n < 2) return false;
      return game.history[n - 1].networth >= game.history[n - 2].networth;
    },
    reward: 450,
  },
  {
    id: 'gain_goal',
    title: '🎯 Reach $50k Net Worth',
    description: 'Build your net worth to $50,000',
    check: (game) => {
      const n = game.history.length;
      return n > 0 && game.history[n - 1].networth >= 50000;
    },
    reward: 600,
  },
];
