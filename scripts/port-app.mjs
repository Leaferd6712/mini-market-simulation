/**
 * Ports _extract/script.js → src/game/app.js with production fixes.
 * Run: node scripts/port-app.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
let src = fs.readFileSync(path.join(root, '_extract', 'script.js'), 'utf8');

// Remove leading config / supabase / submit / fetch that we replace with imports
src = src.replace(/^[\s\S]*?(?=const CATEGORIES = \[)/, '');

// Remove data blocks now in modules (keep CATEGORIES usage via import)
src = src.replace(/const CATEGORIES = \[[\s\S]*?\];\nconst STOCKS_PER_CATEGORY = 10;\n\n/, '');
src = src.replace(/const POPUP_AUTO_ACK_MS = 10000;\nconst NOTIF_DURATION_MS = 8000;\nconst NOTIF_COOLDOWN_MS = 12000;\n/, '');
src = src.replace(/const STANDARD = \{[\s\S]*?\};\nconst TREND_DAILY_BIAS[\s\S]*?const SPEED_OPTIONS = \[1,2,4\];\n\n/, '');
src = src.replace(/\/\/ Level system\nconst LEVEL_CONTRACTS = \{[\s\S]*?\};\n\n/, '');
src = src.replace(/\/\/ Achievements system\nconst ACHIEVEMENTS = \{[\s\S]*?\};\n\n/, '');
src = src.replace(/const REAL_TECH[\s\S]*?const STOCKS_MASTER = generateStocksMaster\(\);\n\n/, '');
src = src.replace(/function money\(v\)\{[\s\S]*?function pctText\(v\)\{[\s\S]*?\}\n\n/, '');
src = src.replace(/const NEWS_TEMPLATES = \[[\s\S]*?\];\n\n/, '');
src = src.replace(/const MAJOR_EVENTS = \[[\s\S]*?\];\n\n/, '');
src = src.replace(/const SPECIAL_EVENTS = \[[\s\S]*?\];\n\n/, '');
src = src.replace(/const DAILY_QUESTS = \[[\s\S]*?\];\n\n/, '');
src = src.replace(/let totalDays = 10000;\nlet totalWeeks = Math\.ceil\(totalDays \/ 7\);\n\n\/\/ ── DIVIDEND DATA ────────────────────────────────────────\nconst DIVIDEND_YIELD = \{ Finance:0\.015, Energy:0\.012, Retail:0\.010 \}; \/\/ % per 7-day cycle\n\n/, '');

// Fix game init object — add new fields
src = src.replace(
  /leaderboardPromptShown: false,\n\};/,
  `leaderboardPromptShown: false,
  luckyGainDays: 0,
  pendingComeback: false,
  comebackReady: false,
  yearPromptShown: false,
};
let totalDays = INITIAL_TOTAL_DAYS;
let totalWeeks = Math.ceil(totalDays / 7);
`
);

// Fix hold_week is already in quests module - but DAILY_QUESTS was removed, need import usage
// Replace checkAchievements body
src = src.replace(
  /function checkAchievements\(\)\{[\s\S]*?\n\}/,
  `function checkAchievements(){
  checkAchievementsPure(game, {
    onUnlock: (ach) => {
      showNotification(\`🏆 Achievement Unlocked: \${ach.name}\`, 6000);
      logEvent(\`Achievement: \${ach.name}\`);
      playAchievementSound();
      renderAchievements();
      autoSave();
    }
  });
}`
);

// Fix unlockAchievement to not double-set (checkAchievementsPure sets it)
src = src.replace(
  /function unlockAchievement\(achievementId\)\{[\s\S]*?\n\}/,
  `function unlockAchievement(achievementId){
  if (game.achievements[achievementId] || !ACHIEVEMENTS[achievementId]) return;
  game.achievements[achievementId] = true;
  const ach = ACHIEVEMENTS[achievementId];
  showNotification(\`🏆 Achievement Unlocked: \${ach.name}\`, 6000);
  logEvent(\`Achievement: \${ach.name}\`);
  playAchievementSound();
  renderAchievements();
  autoSave();
}`
);

// Fix generateWeeklyNews to use module
src = src.replace(
  /function generateWeeklyNews\(\)\{[\s\S]*?\n\}/,
  `function generateWeeklyNews(){
  return generateWeeklyNewsPure(game);
}`
);

// Wire end-of-year in applySingleDay before queueRender
src = src.replace(
  /triggerSpecialEvent\(\);\n  checkAndCompleteQuests\(\);\n  game\.lastDaySharesBought = 0;\n  \n  queueRender\(\);/,
  `// Achievement tracking
  if (dayProfit <= -1000) game.pendingComeback = true;
  if (game.pendingComeback && dayProfit >= 1000) { game.comebackReady = true; game.pendingComeback = false; }
  const prevNw = previousNetworth || 1;
  if (previousNetworth > 0 && (dayProfit / previousNetworth) >= 0.05) game.luckyGainDays = (game.luckyGainDays || 0) + 1;

  triggerSpecialEvent();
  checkAndCompleteQuests();
  game.lastDaySharesBought = 0;

  if (game.day >= 365 && totalDays === 365 && !game.yearPromptShown) {
    game.yearPromptShown = true;
    clearWeekTimer();
    showEndOfYearPrompt();
  }

  queueRender();`
);

// Buy: track boughtDay
src = src.replace(
  /game\.portfolio\[s\.id\] = \{ shares:newTotal, avgPrice:newAvg \};/,
  `game.portfolio[s.id] = { shares:newTotal, avgPrice:newAvg, boughtDay: prev.shares > 0 ? (prev.boughtDay ?? game.day) : game.day };`
);

// initGame: 365 days + full reset
src = src.replace(
  /function initGame\(autoStart=true\)\{\n  totalDays = 10000;\n  totalWeeks = Math\.ceil\(totalDays \/ 7\);\n\n  resetLiveStocks\(\);\n  game\.portfolio = \{\};\n  game\.day = 0; game\.cash = STANDARD\.startingMoney; game\.events = \[\]; game\.history = \[\]; game\.cyclesCompleted = 0; game\.marketState = 'Sideways'; game\.bonusGiven = false;\n  game\.level = 1; game\.levelUpUnlocked = \{\}; game\.playerName = 'Trader';\n  game\.leaderboardPromptShown = false;\n  pendingWeeklyNews = null; currentWeek = 0; runningYear = false; paused = false; daysAppliedInWeek = 0;/,
  `function initGame(autoStart=true){
  totalDays = INITIAL_TOTAL_DAYS;
  totalWeeks = Math.ceil(totalDays / 7);

  resetLiveStocks();
  game.portfolio = {};
  game.day = 0; game.cash = STANDARD.startingMoney; game.events = []; game.history = []; game.cyclesCompleted = 0; game.marketState = 'Sideways'; game.bonusGiven = false;
  game.level = 1; game.levelUpUnlocked = {}; game.playerName = 'Trader';
  game.leaderboardPromptShown = false;
  game.achievements = {}; game.completedQuests = {}; game.totalTrades = 0; game.bestDayProfit = 0;
  game.totalProfit = 0; game.shorts = {}; game.loan = 0; game.interestRate = 3.5; game.inflation = 2.1;
  game.totalDividendsEarned = 0; game.luckyGainDays = 0; game.pendingComeback = false; game.comebackReady = false; game.yearPromptShown = false;
  pendingWeeklyNews = null; currentWeek = 0; runningYear = false; paused = false; daysAppliedInWeek = 0;`
);

// updateProgress: unrealised P&L
src = src.replace(
  /networthEl\.textContent = money\(round2\(game\.cash \+ portfolioVal\)\);\n  cashPanelEl\.textContent = money\(game\.cash\);\n  marketStateEl\.textContent = game\.marketState;/,
  `networthEl.textContent = money(round2(game.cash + portfolioVal));
  cashPanelEl.textContent = money(game.cash);
  marketStateEl.textContent = game.marketState;
  const unrealEl = document.getElementById('unrealisedTop');
  if (unrealEl) {
    const unreal = Object.keys(game.portfolio).reduce((acc,id)=>{ const e=game.portfolio[id]; const s=game.stocks.find(x=>x.id===id); return acc + (s ? (s.price - e.avgPrice) * e.shares : 0); }, 0);
    unrealEl.textContent = money(round2(unreal));
    unrealEl.className = unreal >= 0 ? 'profit-pos' : 'profit-neg';
  }`
);

// XSS-safe leaderboards
src = src.replace(
  /function renderLocalLeaderboard\(\)\{[\s\S]*?\n\}/,
  `function renderLocalLeaderboard(){
  const list = getLeaderboard();
  const el = document.getElementById('leaderboardList'); if (!el) return;
  el.textContent = '';
  if (!list.length){ const empty = document.createElement('div'); empty.className = 'small muted'; empty.textContent = 'No local scores yet. Play and submit your score!'; el.appendChild(empty); return; }
  const medals = ['🥇','🥈','🥉'];
  list.forEach((item, i)=>{
    const div = document.createElement('div'); div.className = 'lb-entry';
    const rank = document.createElement('span'); rank.className = 'lb-rank'; rank.textContent = medals[i] || '#'+(i+1);
    const name = document.createElement('span'); name.className = 'lb-name'; name.textContent = item.name || 'Player';
    const score = document.createElement('span'); score.className = 'lb-score'; score.textContent = money(item.score);
    const meta = document.createElement('span'); meta.className = 'lb-meta'; meta.textContent = \`Day \${item.day||'?'} · Lv\${item.level||'?'}\`;
    div.append(rank, name, score, meta);
    el.appendChild(div);
  });
}`
);

src = src.replace(
  /data\.top10\.forEach\(\(item, i\)=>\{\n      const div = document\.createElement\('div'\); div\.className = 'lb-entry';\n      const isYou = _globalPlayerName && item\.player_name\.trim\(\)\.toLowerCase\(\) === _globalPlayerName\.trim\(\)\.toLowerCase\(\);\n      if \(isYou\) div\.classList\.add\('lb-you'\);\n      div\.innerHTML = \`<span class="lb-rank">\$\{medals\[i\] \|\| '#'\+\(i\+1\)\}<\/span><span class="lb-name">\$\{item\.player_name\}\$\{isYou \? ' <span style="font-size:10px;color:#00d4ff;font-weight:700;">\(you\)<\/span>' : ''\}<\/span><span class="lb-score">\$\{money\(item\.score\)\}<\/span><span class="lb-meta">Day \$\{item\.day\|\|'?'\} · Lv\$\{item\.level\|\|'?'\}<\/span>\`;\n      listEl\.appendChild\(div\);\n    \}\);/,
  `data.top10.forEach((item, i)=>{
      const div = document.createElement('div'); div.className = 'lb-entry';
      const pname = getGlobalPlayerName();
      const isYou = pname && (item.player_name||'').trim().toLowerCase() === pname.trim().toLowerCase();
      if (isYou) div.classList.add('lb-you');
      const rank = document.createElement('span'); rank.className = 'lb-rank'; rank.textContent = medals[i] || '#'+(i+1);
      const name = document.createElement('span'); name.className = 'lb-name'; name.textContent = item.player_name || 'Player';
      if (isYou) { const you = document.createElement('span'); you.style.cssText='font-size:10px;color:#00d4ff;font-weight:700;margin-left:4px'; you.textContent='(you)'; name.appendChild(you); }
      const score = document.createElement('span'); score.className = 'lb-score'; score.textContent = money(item.score);
      const meta = document.createElement('span'); meta.className = 'lb-meta'; meta.textContent = \`Day \${item.day||'?'} · Lv\${item.level||'?'}\`;
      div.append(rank, name, score, meta);
      listEl.appendChild(div);
    });`
);

// Config check for global LB
src = src.replace(
  /if \(SUPABASE_URL === 'YOUR_SUPABASE_URL' \|\| SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY'\)\{/,
  `if (!isSupabaseConfigured()){`
);

// Clean save/load — replace both autoSave defs and patch block
src = src.replace(
  /function autoSave\(\)\{ try \{ const save = \{ v:6[\s\S]*?localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(save\)\); \} catch\(e\)\{\} \}/,
  `function autoSave(){
  try {
    saveGameToStorage(game, { currentWeek, totalWeeks, totalDays, pendingWeeklyNews });
  } catch(e){}
}`
);

src = src.replace(
  /function loadSaved\(\)\{ const raw = localStorage\.getItem\(STORAGE_KEY\); if \(!raw\)\{ alert\('No saved data'\); return; \} try \{ const saved = JSON\.parse\(raw\);[\s\S]*?alert\('Loaded saved game\.'\); \} catch\(e\)\{ alert\('Failed to load'\); \} \}/,
  `function loadSaved(){
  const loaded = loadGameFromStorage();
  if (!loaded){ alert('No saved data'); return; }
  Object.assign(game, loaded.game);
  currentWeek = loaded.meta.currentWeek;
  totalDays = loaded.meta.totalDays;
  totalWeeks = loaded.meta.totalWeeks;
  pendingWeeklyNews = loaded.meta.pendingWeeklyNews;
  renderCategoryTiles(); renderStocksForCategory(); renderPortfolio(); updateProgress();
  updateEcoBar(); updateMarginPanel(); renderAchievements(); renderQuests();
  alert('Loaded saved game.');
}`
);

src = src.replace(
  /function clearSave\(\)\{ if \(!confirm\('Clear saved game\?'\)\) return; localStorage\.removeItem\(STORAGE_KEY\); alert\('Saved cleared\.'\); \}/,
  `function clearSave(){ if (!confirm('Clear saved game?')) return; clearSaveStorage(); alert('Saved cleared.'); }`
);

// Remove monkey patches
src = src.replace(/\/\/ =+\n\/\/ PATCH autoSave[\s\S]*?\}\)\(\);\n\n\/\/ Patch initGame[\s\S]*?\}\)\(\);\n\n\/\/ Wire chart open[\s\S]*?\}\)\(\);\n/, '');

// Replace openShortModal prompt with modal flow
src = src.replace(
  /function openShortModal\(stockId\)\{[\s\S]*?queueRender\(\); autoSave\(\);\n\}/,
  `function openShortModal(stockId){
  const s = game.stocks.find(x=>x.id===stockId); if (!s) return;
  if (game.portfolio[stockId] && game.portfolio[stockId].shares > 0){
    showNotification('You own this stock — sell your position first before going short.', 3500); return;
  }
  const maxShares = game.cash > 0 ? Math.floor(game.cash / s.price) : 0;
  if (maxShares < 1){ showNotification('Not enough cash to open a short position.', 3500); return; }
  currentTradeMode = 'short'; currentTradeStock = s.id;
  tradeHeadline.textContent = \`Short \${s.name}\`;
  tradeInfo.textContent = \`Price: \${money(s.price)} — Max short: \${maxShares} shares (collateral held)\`;
  tradeShares.value = 1;
  updateTradeCost();
  tradeMeta.innerHTML = \`<div class="row"><span>Collateral</span><strong id="shortCollateral">\${money(s.price)}</strong></div>\`;
  tradeQuickButtons.innerHTML = '';
  [1,5,10,maxShares].forEach(v => {
    const b = document.createElement('button'); b.className = 'buyq'; b.textContent = v === maxShares ? 'Max' : '+'+v;
    b.onclick = () => { tradeShares.value = Math.min(maxShares, v); updateTradeCost(); const col = document.getElementById('shortCollateral'); if (col) col.textContent = money(round2(Number(tradeShares.value)*s.price)); };
    tradeQuickButtons.appendChild(b);
  });
  tradeOverlay.style.display = 'flex'; tradeOverlay.querySelector('.modal').classList.add('show');
  tradeShares.focus();
}`
);

// Extend tradeConfirm for short mode
src = src.replace(
  /tradeConfirm\.addEventListener\('click', \(\)=>\{[\s\S]*?currentTradeStock = null; queueRender\(\); autoSave\(\); checkAchievements\(\);\n\}\);/,
  `tradeConfirm.addEventListener('click', ()=>{
  const shares = Math.max(0,Math.floor(Number(tradeShares.value)||0));
  if (shares <= 0){ alert('Enter a positive number of shares.'); return; }
  const s = game.stocks.find(x=>x.id===currentTradeStock); if(!s) return;
  if (currentTradeMode === 'short'){
    const maxShares = Math.floor(game.cash / s.price);
    if (shares > maxShares){ alert('Not enough cash for that short.'); return; }
    const collateral = round2(shares * s.price);
    game.cash = round2(game.cash - collateral);
    const existing = game.shorts[s.id];
    if (existing) {
      const total = existing.shares + shares;
      game.shorts[s.id] = { shares: total, entryPrice: round2((existing.shares * existing.entryPrice + shares * s.price) / total) };
    } else {
      game.shorts[s.id] = { shares, entryPrice: s.price };
    }
    game.totalTrades++;
    logEvent(\`Opened short: \${shares}× \${s.name} @ \${money(s.price)}. Collateral held: \${money(collateral)}.\`);
    showNotification(\`📉 Short opened: \${shares}× \${s.name} @ \${money(s.price)}\`, 3000);
  } else if (currentTradeMode === 'buy'){
    const max = Math.floor(game.cash / s.price);
    if (shares > max){ alert('Not enough cash'); return; }
    const prev = game.portfolio[s.id]||{shares:0, avgPrice:0};
    const newTotal = prev.shares + shares;
    const newAvg = newTotal>0 ? round2(((prev.shares*prev.avgPrice)+(shares*s.price))/newTotal) : s.price;
    game.portfolio[s.id] = { shares:newTotal, avgPrice:newAvg, boughtDay: prev.shares > 0 ? (prev.boughtDay ?? game.day) : game.day };
    game.cash = round2(game.cash - shares*s.price);
    logEvent(\`Bought \${shares} × \${s.name}.\`);
    game.lastDaySharesBought = (game.lastDaySharesBought||0) + shares;
    game.totalTrades++;
    playBuySound();
  } else {
    const owned = (game.portfolio[s.id]||{shares:0}).shares;
    if (owned <= 0){ alert("You don't own shares"); return; }
    if (shares > owned){ alert('Not that many shares'); return; }
    const avgPrice = game.portfolio[s.id].avgPrice;
    const sellPrice = s.price;
    const profitPct = avgPrice > 0 ? (sellPrice - avgPrice) / avgPrice : 0;
    game.cash = round2(game.cash + shares*s.price);
    const pnl = round2(shares * (sellPrice - avgPrice));
    const remaining = owned - shares;
    if (remaining === 0) delete game.portfolio[s.id]; else game.portfolio[s.id] = { shares:remaining, avgPrice: game.portfolio[s.id].avgPrice, boughtDay: game.portfolio[s.id].boughtDay };
    logEvent(\`Sold \${shares} × \${s.name}.\`);
    game.lastSaleProfitPct = Math.max(game.lastSaleProfitPct || 0, profitPct);
    game.totalProfit = round2((game.totalProfit||0) + pnl);
    game.totalTrades++;
    if (pnl >= 0) playSellProfitSound(); else playSellLossSound();
    const cashDisp = document.getElementById('cash');
    if (cashDisp && typeof showFloat === 'function'){
      const r = cashDisp.getBoundingClientRect();
      showFloat(r.left + 20, r.top - 20, \`\${pnl >= 0 ? '+' : ''}\${money(pnl)}\`, pnl >= 0 ? '#00ff88' : '#ff6b6b');
    }
  }
  tradeOverlay.style.display='none'; tradeOverlay.setAttribute('aria-hidden','true'); tradeOverlay.querySelector('.modal').classList.remove('pos','neg','show');
  currentTradeStock = null; queueRender(); autoSave(); checkAchievements();
});`
);

// Sanitize score name
src = src.replace(
  /const cleanName = rawName\.trim\(\)\.slice\(0, 30\) \|\| 'Player';/,
  `const cleanName = sanitizePlayerName(rawName) || 'Player';`
);

// Expose batchSell/openTradeModal/coverShort on window for button handlers (we'll fix to addEventListener in render)
src = src.replace(
  /row\.innerHTML = `\n        <div>\n          <div style="font-weight:800">\$\{s\.name\}/,
  `row.innerHTML = \`
        <div>
          <div style="font-weight:800">\${s.name}`
);

// Fix DOMContentLoaded - wrap as boot, remove auto DOMContentLoaded
src = src.replace(
  /document\.addEventListener\('DOMContentLoaded', \(\)=>\{\n  initGame\(false\);\n  showLoadingThenIntro\(\);\n  speedLabel\.textContent = speedMultiplier \+ 'x';\n  document\.getElementById\('newsPanel'\)\.innerHTML = `<div class="pill">Ready<\/div><div class="small muted">Click a category tile to view that group's stocks\. Press Start \/ Restart to begin or press Let's play\.<\/div>`;\n  initNewFeatures\(\);\n\}\);/,
  `function bootApp(){
  // Leaderboard tabs without inline onclick
  document.getElementById('lbTabLocal')?.addEventListener('click', () => switchLbTab('local'));
  document.getElementById('lbTabGlobal')?.addEventListener('click', () => switchLbTab('global'));
  initGame(false);
  showLoadingThenIntro();
  speedLabel.textContent = speedMultiplier + 'x';
  const newsPanelEl = document.getElementById('newsPanel');
  if (newsPanelEl) {
    newsPanelEl.textContent = '';
    const pill = document.createElement('div'); pill.className = 'pill'; pill.textContent = 'Ready';
    const msg = document.createElement('div'); msg.className = 'small muted'; msg.textContent = 'Click a category tile to view that group\\'s stocks. Press Start / Restart to begin or press Let\\'s play.';
    newsPanelEl.append(pill, msg);
  }
  initNewFeatures();
  if (import.meta.env.DEV) {
    import('../devtools.js').then(m => m.attachDevTools({ game, get totalDays(){return totalDays}, set totalDays(v){totalDays=v}, applySingleDay, queueRender, autoSave })).catch(()=>{});
  }
}`
);

// continueExtendBtn should use EXTENDED_TOTAL_DAYS
src = src.replace(
  /totalDays = 700;/,
  `totalDays = EXTENDED_TOTAL_DAYS;`
);

// Remove trailing orphaned patches if any remain
src = src.replace(/\(function patchSaveLoad\(\)\{[\s\S]*$/, '');

const header = `/**
 * Mini Market Simulation — UI + game loop (ported from monolith with production fixes).
 */
import {
  STORAGE_KEY,
  LEADERBOARD_KEY,
  LEADERBOARD_PROMPT_PROFIT,
  INITIAL_TOTAL_DAYS,
  EXTENDED_TOTAL_DAYS,
  isSupabaseConfigured,
} from '../config.js';
import { money, round2, pick, rand, capArray, pctText } from '../utils/format.js';
import { sanitizePlayerName } from '../utils/sanitize.js';
import {
  CATEGORIES,
  STOCKS_PER_CATEGORY,
  POPUP_AUTO_ACK_MS,
  NOTIF_DURATION_MS,
  NOTIF_COOLDOWN_MS,
  STANDARD,
  TREND_DAILY_BIAS,
  SHOCK_PROB_SURGE,
  SHOCK_PROB_FALL,
  SPEED_OPTIONS,
  DIVIDEND_YIELD,
} from '../data/constants.js';
import { LEVEL_CONTRACTS } from '../data/levels.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { STOCKS_MASTER } from '../data/stocks.js';
import { NEWS_TEMPLATES, MAJOR_EVENTS, SPECIAL_EVENTS } from '../data/news.js';
import { DAILY_QUESTS } from '../data/quests.js';
import { generateWeeklyNews as generateWeeklyNewsPure } from '../sim/news.js';
import { checkAchievements as checkAchievementsPure } from '../sim/achievements.js';
import {
  saveGame as saveGameToStorage,
  loadGame as loadGameFromStorage,
  clearSave as clearSaveStorage,
} from '../persist/save.js';
import {
  submitGlobalScore,
  fetchGlobalLeaderboard,
  getGlobalPlayerName,
} from '../api/leaderboard.js';

let _globalPlayerName = null;
let lastNotifTime = 0;
let notifQueue = [];

`;

const footer = `

export { bootApp, openTradeModal, batchSell, coverShort, openShortModal };

// Bind helpers used by dynamically created buttons
window.openTradeModal = openTradeModal;
window.batchSell = batchSell;
window.coverShort = coverShort;
window.openShortModal = openShortModal;
window.switchLbTab = switchLbTab;
`;

const outDir = path.join(root, 'src', 'game');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'app.js'), header + src + footer);
console.log('Wrote src/game/app.js', (header + src + footer).length);
