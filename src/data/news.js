export const NEWS_TEMPLATES = [
  { headline: 'A new AI model that solves many tasks', pos: ['Tech', 'Finance'], neg: ['Retail', 'Transport'], explain: 'AI product success helps tech & finance; some retailers and transport firms slow down.' },
  { headline: 'Big renewable energy contract signed', pos: ['Energy'], neg: [], explain: 'Renewables get momentum; some older energy firms adjust.' },
  { headline: 'Holiday shopping stronger than expected', pos: ['Retail'], neg: ['Tech'], explain: 'Retailers win as shoppers spend; some tech attention moves elsewhere briefly.' },
  { headline: 'Calm interest-rate news stabilises markets', pos: ['Finance', 'Retail'], neg: ['Tech'], explain: 'Lower uncertainty helps banks and shops.' },
  { headline: 'Promising medical trial announced', pos: ['Biotech'], neg: ['Transport', 'Retail'], explain: 'Health firms gain investor hope; transport & some retail affected.' },
  { headline: 'Shipping delays on a route', pos: ['Transport'], neg: ['Retail'], explain: 'Some logistics adapt; carriers face delays.' },
  { headline: 'Airlines report busy bookings', pos: ['Transport', 'Retail'], neg: [], explain: 'Travel boosts transport and nearby retailers.' },
  { headline: 'Cloud provider breach reported', pos: ['Tech'], neg: ['Tech'], explain: 'Security concerns can move tech share prices around.' },
  { headline: 'Education funding increases', pos: ['Tech', 'Retail'], neg: [], explain: 'Ed-tech and services benefit; some retailers adjust.' },
  { headline: 'A new trade agreement signed', pos: ['Transport'], neg: [], explain: 'Transport expects smoother trade.' },
];

export const MAJOR_EVENTS = [
  { title: 'Global market correction', effects: { market: -0.20 }, desc: 'A broad market correction; many stocks fall.' },
  { title: 'Big stimulus package', effects: { market: 0.18 }, desc: 'A big stimulus pushes many stocks higher.' },
];

export const SPECIAL_EVENTS = [
  { title: '📰 Breaking News: CEO Resignation', desc: 'A major announcement sends {{stock}} down 15%!', effect: (s) => { s.price *= 0.85; }, chance: 0.01, reward: 200 },
  { title: '🚀 Product Launch Success', desc: '{{stock}} launches a hit product! Up 12%!', effect: (s) => { s.price *= 1.12; }, chance: 0.02, reward: 300 },
  { title: '💎 Acquisition Offer', desc: '{{stock}} receives acquisition interest. Up 8%!', effect: (s) => { s.price *= 1.08; }, chance: 0.015, reward: 250 },
  { title: '⚖️ Regulatory Fine', desc: '{{stock}} fined $500M. Down 10%!', effect: (s) => { s.price *= 0.90; }, chance: 0.01, reward: 150 },
  { title: '🏆 Best in Industry Award', desc: '{{stock}} wins major award. Up 7%!', effect: (s) => { s.price *= 1.07; }, chance: 0.02, reward: 200 },
  { title: '📊 Better Than Expected Earnings', desc: '{{stock}} crushes earnings! Up 15%!', effect: (s) => { s.price *= 1.15; }, chance: 0.025, reward: 400 },
  { title: '⚠️ Supply Chain Issues', desc: '{{stock}} faces supply chain delays. Down 8%!', effect: (s) => { s.price *= 0.92; }, chance: 0.015, reward: 180 },
  { title: '🤝 Partnership Announced', desc: '{{stock}} forms strategic partnership. Up 6%!', effect: (s) => { s.price *= 1.06; }, chance: 0.02, reward: 220 },
];
