/**
 * Dev-only cheat helpers. Never attached in production builds.
 */
export function attachDevTools(ctx) {
  if (!import.meta.env.DEV) return;
  const api = {
    unlock: (password) => {
      if (password !== 'opensesame12345678910') return false;
      console.log('DevTools unlocked');
      return true;
    },
    addCash: (amount = 10000) => {
      ctx.game.cash += amount;
      ctx.queueRender?.();
      ctx.autoSave?.();
    },
    setDay: (d) => {
      ctx.game.day = d;
      ctx.queueRender?.();
    },
  };
  window.devTools = api;
  window.Devtools = api;
  console.info('[DEV] window.devTools available');
}
