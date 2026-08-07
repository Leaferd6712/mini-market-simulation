/**
 * Game loop helpers (day tick scheduling utilities).
 * Primary loop lives in game/app.js; these helpers are shared/pure.
 */
export function getDaysPerTick(speedMultiplier) {
  if (speedMultiplier <= 100) return 1;
  return Math.min(2000, Math.max(1, Math.floor(speedMultiplier / 100)));
}

export function getTickMs(speedMultiplier, perDayMsBase = 2700) {
  if (speedMultiplier <= 200) return Math.max(10, Math.floor(perDayMsBase / speedMultiplier));
  return 10;
}

export function shouldPromptEndgame(day, totalDays, alreadyShown) {
  return day >= 365 && totalDays === 365 && !alreadyShown;
}
