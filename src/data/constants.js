export const CATEGORIES = [
  { key: 'Tech', label: 'Tech', css: 'cat-tech' },
  { key: 'Energy', label: 'Energy', css: 'cat-energy' },
  { key: 'Retail', label: 'Retail', css: 'cat-retail' },
  { key: 'Finance', label: 'Finance', css: 'cat-finance' },
  { key: 'Transport', label: 'Transport', css: 'cat-transport' },
  { key: 'Biotech', label: 'Biotech', css: 'cat-biotech' },
];

export const STOCKS_PER_CATEGORY = 10;
export const POPUP_AUTO_ACK_MS = 10000;
export const NOTIF_DURATION_MS = 8000;
export const NOTIF_COOLDOWN_MS = 12000;
export const STANDARD = { volatilityMultiplier: 0.7, startingMoney: 10000 };
export const TREND_DAILY_BIAS = 0.004;
export const SHOCK_PROB_SURGE = 0.006;
export const SHOCK_PROB_FALL = 0.004;
export const SPEED_OPTIONS = [1, 2, 4];
export const DIVIDEND_YIELD = { Finance: 0.015, Energy: 0.012, Retail: 0.01 };
export const LOAN_DAILY_INTEREST = 0.005;
