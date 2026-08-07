import { NEWS_TEMPLATES, MAJOR_EVENTS } from '../data/news.js';
import { CATEGORIES } from '../data/constants.js';
import { pick, rand } from '../utils/format.js';

/**
 * Generate weekly news. Only references sectors/stocks that exist in game.stocks.
 * Applies MAJOR_EVENTS.effects.market when a major event fires.
 */
export function generateWeeklyNews(game) {
  const liveSectors = new Set(game.stocks.map((s) => s.sector));
  const templates = NEWS_TEMPLATES.filter(
    (t) =>
      t.pos.some((s) => liveSectors.has(s)) ||
      t.neg.some((s) => liveSectors.has(s)) ||
      t.pos.length === 0
  );
  const template = pick(templates.length ? templates : NEWS_TEMPLATES);

  const impactMap = {};
  for (const cat of CATEGORIES) {
    if (!liveSectors.has(cat.key)) continue;
    if (template.pos.includes(cat.key)) impactMap[cat.key] = rand(0.02, 0.08);
    else if (template.neg.includes(cat.key)) impactMap[cat.key] = -rand(0.02, 0.08);
    else impactMap[cat.key] = rand(-0.01, 0.01);
  }

  let headline = template.headline;
  let explain = template.explain;
  let isMajor = false;

  if (Math.random() < 0.08) {
    const major = pick(MAJOR_EVENTS);
    isMajor = true;
    headline = major.title;
    explain = major.desc;
    if (typeof major.effects?.market === 'number') {
      impactMap.market = major.effects.market;
    }
  }

  const featured = pick(game.stocks.length ? game.stocks : [{ name: 'the market' }]);

  return {
    headline,
    explain,
    impactMap,
    isMajor,
    major: isMajor,
    featuredStock: featured?.name || null,
    sectors: Object.keys(impactMap).filter((k) => k !== 'market'),
  };
}
