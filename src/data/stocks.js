import { CATEGORIES, STOCKS_PER_CATEGORY } from './constants.js';

const REAL_TECH = ['NVIDIA', 'AMD', 'Intel', 'Apple', 'Microsoft', 'Alphabet', 'Amazon', 'Meta', 'Qualcomm', 'Broadcom'];
const REAL_TRANSPORT = ['Tesla', 'Ford Motor Company', 'General Motors', 'Toyota', 'Uber', 'Boeing', 'Airbus', 'DHL', 'Maersk', 'Volvo'];
const REAL_ENERGY = ['ExxonMobil', 'Chevron', 'BP', 'Shell', 'TotalEnergies', 'NextEra Energy', 'Enel', 'Ørsted', 'Origin Energy', 'Sempra'];
const REAL_RETAIL = ['Walmart', 'Target', 'Costco', 'Alibaba', 'IKEA', 'H&M', 'Zara', 'Woolworths', 'Coles', 'BestBuy'];
const REAL_FINANCE = ['JPMorgan', 'Goldman Sachs', 'Bank of America', 'HSBC', 'Commonwealth Bank', 'ANZ', 'Westpac', 'Barclays', 'Citigroup', 'UBS'];
const REAL_BIOTECH = ['Pfizer', 'Moderna', 'Roche', 'Johnson & Johnson', 'Novartis', 'AstraZeneca', 'Gilead', 'Biogen', 'Regeneron', 'CSL'];

const REAL_LISTS = {
  Tech: REAL_TECH,
  Transport: REAL_TRANSPORT,
  Energy: REAL_ENERGY,
  Retail: REAL_RETAIL,
  Finance: REAL_FINANCE,
  Biotech: REAL_BIOTECH,
};

export function generateStocksMaster(rng = Math.random) {
  const master = [];
  const volBase = { Tech: 1.4, Energy: 1.2, Retail: 1.0, Finance: 0.9, Transport: 1.1, Biotech: 1.6 };
  const prices = { Tech: 120, Energy: 60, Retail: 40, Finance: 90, Transport: 70, Biotech: 140 };

  for (const cat of CATEGORIES) {
    const names = REAL_LISTS[cat.key] || [];
    for (let i = 0; i < STOCKS_PER_CATEGORY; i++) {
      const cname = names[i % names.length] || `${cat.key}${i + 1}`;
      const id = `${cat.key.toLowerCase()}_${cname.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '')}`;
      const price = Math.round(prices[cat.key] * (0.6 + rng() * 1.6) * 100) / 100;
      const volatility = volBase[cat.key] * (0.8 + rng() * 0.6);
      master.push({ id, name: cname, sector: cat.key, price, volatility });
    }
  }
  return master;
}

/** Fixed master list for a session — call once at boot. */
export const STOCKS_MASTER = generateStocksMaster();
