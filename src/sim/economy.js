/** Lightweight eco helpers for UI display. */
export function sentimentLabel(marketState) {
  if (marketState === 'Bull') return 'Bullish';
  if (marketState === 'Bear') return 'Bearish';
  return 'Neutral';
}

export function driftEconomicIndicators(game) {
  game.interestRate = Math.max(1, Math.min(9, game.interestRate + (Math.random() * 1.4 - 0.7)));
  game.inflation = Math.max(0.5, Math.min(7, game.inflation + (Math.random() * 1.2 - 0.5)));
}
