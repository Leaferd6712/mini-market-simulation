/**
 * Mini Market Simulation — UI + game loop (ported from monolith with production fixes).
 */
import {
  STORAGE_KEY,
  LEADERBOARD_KEY,
  LEADERBOARD_PROMPT_PROFIT,
  INITIAL_TOTAL_DAYS,
  EXTENDED_TOTAL_DAYS,
  isLeaderboardConfigured,
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
import { SPECIAL_EVENTS } from '../data/news.js';
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
import { trapFocus, setAriaSelected } from '../ui/a11y.js';
import { shouldPromptEndgame } from './loop.js';

let _globalPlayerName = null;
let lastNotifTime = 0;
let notifQueue = [];


let totalDays = INITIAL_TOTAL_DAYS;
let totalWeeks = Math.ceil(totalDays / 7);

let game = {
  stocks:[], day:0, cash:STANDARD.startingMoney, portfolio:{}, events:[], history:[], cyclesCompleted:0, marketState:'Sideways', bonusGiven:false, level:1, levelUpUnlocked:{}, playerName:'Trader',
  achievements:{}, totalTrades:0, bestDayProfit:0, streakDays:0, totalProfit:0, completedQuests:{}, lastDaySharesBought:0, lastSaleProfitPct:0,
  // NEW: Economic indicators
  interestRate: 3.5,   // percent (1–9)
  inflation: 2.1,      // percent (0.5–7)
  // NEW: Short positions { stockId: { shares, entryPrice } }
  shorts: {},
  // NEW: Margin / Loan
  loan: 0,
  totalDividendsEarned: 0,
  leaderboardPromptShown: false,
  luckyGainDays: 0,
  pendingComeback: false,
  comebackReady: false,
  yearPromptShown: false,
};
let currentWeek = 0, runningYear = false, paused = false;
let disableUI = false;
let pendingWeeklyNews = null;
let weekTimer = null, daysAppliedInWeek = 0, currentWeekStartNet = 0;
let selectedCategory = CATEGORIES[0].key;
let currentRenderedCategory = null;
let stockRowMap = new Map();
let renderQueued = false;

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderPortfolio();
    updateStocksForCategory();
    renderAchievements();
    renderQuests();
  });
}
let speedIndex = 0, speedMultiplier = SPEED_OPTIONS[speedIndex];
let perDayMsBase = 900 * 3;

const categoryGrid = document.getElementById('categoryGrid');
const stocksBody = document.getElementById('stocksBody');
const newsPanel = document.getElementById('newsPanel');
const dayNumEl = document.getElementById('dayNum'), cashEl = document.getElementById('cash'), networthEl = document.getElementById('networth');
const levelDisplay = document.getElementById('levelDisplay');
const portfolioValueEl = document.getElementById('portfolioValue'), cashPanelEl = document.getElementById('cashPanel');
const progressBarEl = document.getElementById('progressBar'), progressTextEl = document.getElementById('progressText');
const marketStateEl = document.getElementById('marketState'), eventsLogEl = document.getElementById('eventsLog');
const speedLabel = document.getElementById('speedLabel');

const weekSummaryOverlay = document.getElementById('weekSummaryOverlay'), weekSummaryHeadline = document.getElementById('weekSummaryHeadline'), weekSummaryBody = document.getElementById('weekSummaryBody');
const viewNewsAfterSummary = document.getElementById('viewNewsAfterSummary'), continueAfterSummary = document.getElementById('continueAfterSummary');

const modalOverlay = document.getElementById('modalOverlay'), modalHeadline = document.getElementById('modalHeadline'), modalImpact = document.getElementById('modalImpact'), modalSectors = document.getElementById('modalSectors'), explainBox = document.getElementById('explainBox'), explainBtn = document.getElementById('explainBtn'), ackBtn = document.getElementById('ackBtn');

const chartOverlay = document.getElementById('chartOverlay'), chartCanvas = document.getElementById('chartCanvas'), chartHeadline = document.getElementById('chartHeadline'), chartSub = document.getElementById('chartSub'), chartMode = document.getElementById('chartMode'), chartClose = document.getElementById('chartClose');

const tradeOverlay = document.getElementById('tradeOverlay'), tradeHeadline = document.getElementById('tradeHeadline'), tradeInfo = document.getElementById('tradeInfo'), tradeMeta = document.getElementById('tradeMeta'), tradeShares = document.getElementById('tradeShares'), tradeCost = document.getElementById('tradeCost'), tradeConfirm = document.getElementById('tradeConfirm'), tradeCancel = document.getElementById('tradeCancel'), tradeQuickButtons = document.getElementById('tradeQuickButtons');

const leaderboardOverlay = document.getElementById('leaderboardOverlay'), leaderboardList = document.getElementById('leaderboardList'), leaderboardClose = document.getElementById('leaderboardClose'), leaderboardClear = document.getElementById('leaderboardClear');

const restartBtn = document.getElementById('restart'), pauseResumeBtn = document.getElementById('pauseResume'), saveBtn = document.getElementById('saveBtn'), loadBtn = document.getElementById('loadBtn'), clearSaveBtn = document.getElementById('clearSaveBtn'), leaderboardBtn = document.getElementById('leaderboardBtn'), marketChartBtn = document.getElementById('marketChartBtn'), speedBtn = document.getElementById('speedBtn');

const loadingOverlay = document.getElementById('loadingOverlay');
const introOverlay = document.getElementById('introOverlay');
const letsPlayBtn = document.getElementById('letsPlayBtn');

const endYearOverlay = document.getElementById('endYearOverlay');
const continueExtendBtn = document.getElementById('continueExtendBtn');
const endStopBtn = document.getElementById('endStopBtn');

const notifWrap = document.getElementById('notifWrap');

const letterOverlay = document.getElementById('letterOverlay');
const letterTo = document.getElementById('letterTo');
const letterBody = document.getElementById('letterBody');
const letterSign = document.getElementById('letterSign');
const letterAck = document.getElementById('letterAck');

const contractOverlay = document.getElementById('contractOverlay');
const contractTitle = document.getElementById('contractTitle');
const contractLevel = document.getElementById('contractLevel');
const contractDetails = document.getElementById('contractDetails');
const contractBenefits = document.getElementById('contractBenefits');
const contractSign = document.getElementById('contractSign');
const contractNameInput = document.getElementById('contractNameInput');
const contractPreview = document.getElementById('contractPreview');
let pendingContractLevel = 0;

function resetLiveStocks(){
  game.stocks = STOCKS_MASTER.map(s => ({ id:s.id, name:s.name, sector:s.sector, price:s.price, volatility:s.volatility, changePct:0, history:[round2(s.price)] }));
}

function renderCategoryTiles(){
  categoryGrid.innerHTML = '';
  const availableCategories = getAvailableCategoriesForLevel(game.level);
  const stocksPerCat = getStocksPerCategoryForLevel(game.level);
  for (const c of availableCategories){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', selectedCategory === c.key ? 'true' : 'false');
    btn.className = `cat-tile ${c.css}` + (selectedCategory === c.key ? ' active' : '');
    btn.innerHTML = `<div style="font-size:18px">${c.label}</div><div class="sub">View ${stocksPerCat} stocks</div>`;
    btn.onclick = ()=> {
      selectedCategory = c.key;
      renderCategoryTiles(); renderStocksForCategory();
    };
    categoryGrid.appendChild(btn);
  }
}

// ── SORT & FILTER STATE ─────────────────────────────────
let sortCol = null, sortDir = 1;
let searchQuery = '';

function renderStocksForCategory(){
  stocksBody.innerHTML = '';
  stockRowMap.clear();
  const stocksPerCat = getStocksPerCategoryForLevel(game.level);
  let list = game.stocks.filter(s => s.sector === selectedCategory).slice(0, stocksPerCat);

  // Filter by search query
  if (searchQuery){
    const q = searchQuery.toLowerCase();
    list = game.stocks.filter(s => s.name.toLowerCase().includes(q) || s.sector.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }

  // Sort
  if (sortCol){
    list = [...list].sort((a,b)=>{
      let va, vb;
      if (sortCol==='name')  { va=a.name; vb=b.name; return sortDir*(va<vb?-1:va>vb?1:0); }
      if (sortCol==='price') { return sortDir*(a.price - b.price); }
      if (sortCol==='change'){ return sortDir*((a.changePct||0) - (b.changePct||0)); }
      if (sortCol==='sector'){ va=a.sector; vb=b.sector; return sortDir*(va<vb?-1:va>vb?1:0); }
      return 0;
    });
  }

  // Update sort indicators on headers
  document.querySelectorAll('#stocksTable th.sortable').forEach(th=>{
    th.classList.remove('sort-asc','sort-desc');
    if (th.dataset.col === sortCol) th.classList.add(sortDir===1?'sort-asc':'sort-desc');
  });

  for (const s of list){
    const prev = (s.history.length >= 2) ? s.history[s.history.length-2] : s.history[s.history.length-1];
    const pct = s.changePct || 0;
    const hasDividend = !!DIVIDEND_YIELD[s.sector];
    const isShorted = !!game.shorts[s.id];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${s.name}</strong>${hasDividend ? `<span class="div-badge">DIV</span>` : ''}${isShorted ? `<span class="short-badge">SHORT</span>` : ''}<div class="small muted">${s.id}</div></td>
      <td><div style="font-weight:800">${money(s.price)}</div><div class="small muted">Prev: ${money(prev)}</div></td>
      <td class="center">${pct>0.0001?`<span class="price-up">+${(pct*100).toFixed(2)}%</span>`:(pct<-0.0001?`<span class="price-down">${(pct*100).toFixed(2)}%</span>`:`<span class="small muted">0.00%</span>`)}</td>
      <td class="center"><div class="sector-badge">${s.sector}</div></td>
      <td class="market-col"></td>
    `;
    const actionTd = tr.querySelector('.market-col');
    const buy   = document.createElement('button'); buy.className='btn-buy';   buy.textContent='Buy';   buy.onclick = () => openTradeModal('buy', s.id);
    const sell  = document.createElement('button'); sell.className='btn-sell';  sell.textContent='Sell';  sell.onclick = () => openTradeModal('sell', s.id);
    const short = document.createElement('button'); short.className='btn-short'; short.textContent= isShorted ? 'Cover' : 'Short'; short.onclick = () => isShorted ? coverShort(s.id) : openShortModal(s.id);
    const chart = document.createElement('button'); chart.className='btn-chart'; chart.textContent='Chart'; chart.onclick = () => openChart(s.id);
    actionTd.append(buy, sell, short, chart);
    stocksBody.appendChild(tr);
    stockRowMap.set(s.id, { priceTd: tr.children[1], changeTd: tr.children[2] });
  }
  currentRenderedCategory = selectedCategory;
}

function updateStocksForCategory(){
  if (currentRenderedCategory !== selectedCategory) return;
  for (const s of game.stocks.filter(s=>s.sector===selectedCategory)){
    const row = stockRowMap.get(s.id);
    if (!row) continue;
    const prev = (s.history.length >= 2) ? s.history[s.history.length-2] : s.history[s.history.length-1];
    const pct = s.changePct || 0;
    row.priceTd.innerHTML = `<div style="font-weight:800">${money(s.price)}</div><div class="small muted">Prev: ${money(prev)}</div>`;
    row.changeTd.innerHTML = pct>0.0001?`<span class="price-up">+${(pct*100).toFixed(2)}%</span>`:(pct<-0.0001?`<span class="price-down">${(pct*100).toFixed(2)}%</span>`:`<span class="small muted">0.00%</span>`);
  }
}

function unlockAchievement(achievementId){
  if (game.achievements[achievementId] || !ACHIEVEMENTS[achievementId]) return;
  game.achievements[achievementId] = true;
  const ach = ACHIEVEMENTS[achievementId];
  showNotification(`🏆 Achievement Unlocked: ${ach.name}`, 6000);
  logEvent(`Achievement: ${ach.name}`);
  playAchievementSound();
  renderAchievements();
  autoSave();
}

function checkAchievements(){
  checkAchievementsPure(game, {
    onUnlock: (ach) => {
      showNotification(`🏆 Achievement Unlocked: ${ach.name}`, 6000);
      logEvent(`Achievement: ${ach.name}`);
      playAchievementSound();
      renderAchievements();
      autoSave();
    }
  });
}

function renderAchievements(){
  const display = document.getElementById('achievementsDisplay');
  display.innerHTML = '';
  const unlocked = Object.keys(ACHIEVEMENTS).filter(id => game.achievements[id]);
  if (!unlocked.length) {
    display.innerHTML = '<div class="small muted" style="text-align:center;padding:8px;">Earn achievements as you play!</div>';
    return;
  }
  unlocked.forEach(id => {
    const ach = ACHIEVEMENTS[id];
    const badge = document.createElement('div');
    badge.className = 'achievement-badge';
    badge.innerHTML = `<span class="achievement-icon">${ach.icon}</span>${ach.name}`;
    display.appendChild(badge);
  });
}

function checkAndCompleteQuests(){
  DAILY_QUESTS.forEach(quest => {
    if (game.completedQuests[quest.id]) return;
    if (quest.check(game)) {
      game.completedQuests[quest.id] = true;
      game.cash = round2(game.cash + quest.reward);
      showNotification(`🎉 Quest Complete: ${quest.title}\n+${money(quest.reward)}`, 5000);
      logEvent(`✅ ${quest.title} — earned ${money(quest.reward)}`);
    }
  });
}

function triggerSpecialEvent(){
  if (Math.random() > 0.05) return; // 5% chance per day
  const event = pick(SPECIAL_EVENTS);
  const stock = pick(game.stocks.filter(s => game.portfolio[s.id]?.shares > 0) || game.stocks);
  if (!stock) return;
  
  const title = event.title.replace('{{stock}}', stock.name);
  const desc = event.desc.replace('{{stock}}', stock.name);
  
  event.effect(stock);
  stock.history.push(round2(stock.price));
  capArray(stock.history, 200);
  
  showNotification(`${title}\n${desc}`, 4000);
  logEvent(desc);
}

function renderQuests(){
  const display = document.getElementById('questsDisplay');
  display.innerHTML = '';
  const incomplete = DAILY_QUESTS.filter(q => !game.completedQuests[q.id]);
  if (!incomplete.length) {
    display.innerHTML = '<div class="small muted" style="text-align:center;padding:8px;">All quests completed for today!</div>';
    return;
  }
  incomplete.forEach(quest => {
    const item = document.createElement('div');
    item.className = 'quest-item';
    const icon = quest.title.charAt(0);
    item.innerHTML = `
      <div class="quest-icon">${icon}</div>
      <div class="quest-info">
        <div class="quest-title">${quest.title}</div>
        <div class="quest-desc">${quest.description}</div>
      </div>
    `;
    display.appendChild(item);
  });
}

function renderPortfolio(){
  const listEl = document.getElementById('portfolioList'); listEl.innerHTML = '';
  const holdings = Object.keys(game.portfolio);
  if (!holdings.length){ listEl.innerHTML = `<div class="center small">You don't own any stocks yet.</div>`; }
  else {
    for (const id of holdings){
      const e = game.portfolio[id]; const s = game.stocks.find(x=>x.id===id); if (!s) continue;
      const shares = e.shares, avg = e.avgPrice, cost = round2(shares * avg), value = round2(shares * s.price), profit = round2(value - cost), profitPct = cost > 0 ? (profit / cost) : 0;
      const hasDividend = !!DIVIDEND_YIELD[s.sector];
      const row = document.createElement('div'); row.className = 'portfolio-row';
      row.innerHTML = `
        <div>
          <div style="font-weight:800">${s.name}${hasDividend?'<span class="div-badge">DIV</span>':''} <span class="small muted">(${s.sector})</span></div>
          <div class="small muted">${shares} shares · Buy ${money(avg)} · Now ${money(s.price)}</div>
          <div class="small muted">Cost ${money(cost)} · Value ${money(value)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;">
          <div class="${profit>=0?'profit-pos':'profit-neg'}">${profit>=0?'+':''}${money(profit)} (${(profitPct*100).toFixed(2)}%)</div>
          <div style="display:flex;gap:4px;">
            <button class="btn-sell-half" onclick="batchSell('${s.id}',0.5)">−50%</button>
            <button class="btn-sell-all-q" onclick="batchSell('${s.id}',1.0)">Sell All</button>
          </div>
          <button class="btn-sell" style="padding:5px 10px;font-size:12px;" onclick="openTradeModal('sell','${s.id}')">Custom</button>
        </div>`;
      listEl.appendChild(row);
    }
  }
  
  // Render short positions
  const shortsSection = document.getElementById('shortsSection');
  const shortsList = document.getElementById('shortsList');
  const shortIds = Object.keys(game.shorts);
  if (shortIds.length){
    shortsSection.style.display = 'block';
    shortsList.innerHTML = '';
    for (const id of shortIds){
      const pos = game.shorts[id]; const s = game.stocks.find(x=>x.id===id); if (!s) continue;
      const pnl = round2(pos.shares * (pos.entryPrice - s.price));
      const pnlPct = pos.entryPrice > 0 ? (pos.entryPrice - s.price) / pos.entryPrice : 0;
      const div = document.createElement('div'); div.className = 'portfolio-row';
      div.innerHTML = `
        <div>
          <div style="font-weight:800;color:#a78bfa">${s.name} <span class="short-badge">SHORT</span></div>
          <div class="small muted">${pos.shares} shares · Entry ${money(pos.entryPrice)} · Now ${money(s.price)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;">
          <div class="${pnl>=0?'profit-pos':'profit-neg'}">${pnl>=0?'+':''}${money(pnl)} (${(pnlPct*100).toFixed(2)}%)</div>
          <button class="btn-short" style="padding:5px 10px;font-size:12px;" onclick="coverShort('${s.id}')">Cover</button>
        </div>`;
      shortsList.appendChild(div);
    }
  } else {
    shortsSection.style.display = 'none';
  }

  const portfolioVal = Object.keys(game.portfolio).reduce((acc,id)=>{ const e=game.portfolio[id]; const s=game.stocks.find(x=>x.id===id); return acc + (s? s.price * e.shares : 0); },0);
  portfolioValueEl.textContent = money(portfolioVal);
  cashPanelEl.textContent = money(game.cash);
  networthEl.textContent = money(round2(game.cash + portfolioVal));
  
  updateMarginPanel();
}

let currentTradeStock = null, currentTradeMode = null;

function renderTradeQuickButtons(){
  tradeQuickButtons.innerHTML = '';
  const s = game.stocks.find(x=>x.id===currentTradeStock);
  if (!s) return;

  if (currentTradeMode === 'buy'){
    const max = Math.max(1, Math.floor(game.cash / s.price));
    const defs = [
      { label:'Max', value:max, cls:'buyq' },
      { label:'+1', value:1, cls:'buyq' },
      { label:'+5', value:5, cls:'buyq' },
      { label:'+10', value:10, cls:'buyq' }
    ];
    defs.forEach(d => {
      const b = document.createElement('button');
      b.className = d.cls;
      b.textContent = d.label;
      b.onclick = () => { tradeShares.value = Math.max(1, d.value); updateTradeCost(); };
      tradeQuickButtons.appendChild(b);
    });
  } else {
    const owned = (game.portfolio[s.id] || {shares:0}).shares;
    const defs = [
      { label:'-1', value:1, cls:'sellq' },
      { label:'-5', value:5, cls:'sellq' },
      { label:'-10', value:10, cls:'sellq' },
      { label:'All', value:owned || 1, cls:'sellq' }
    ];
    defs.forEach(d => {
      const b = document.createElement('button');
      b.className = d.cls;
      b.textContent = d.label;
      b.onclick = () => {
        if (d.label === 'All') tradeShares.value = owned || 1;
        else tradeShares.value = Math.min(owned || 1, d.value);
        updateTradeCost();
      };
      tradeQuickButtons.appendChild(b);
    });
  }
}

function updateTradeMeta(){
  const s = game.stocks.find(x=>x.id===currentTradeStock);
  if (!s) { tradeMeta.innerHTML = ''; return; }
  const avg = (game.portfolio[s.id] && game.portfolio[s.id].avgPrice) ? game.portfolio[s.id].avgPrice : s.price;
  const diff = s.price - avg;
  const pct = avg > 0 ? diff / avg : 0;
  const cls = diff >= 0 ? 'profit-pos' : 'profit-neg';
  tradeMeta.innerHTML = `
    <div class="row"><span>Buy price</span><strong>${money(avg)}</strong></div>
    <div class="row"><span>Current price</span><strong>${money(s.price)}</strong></div>
    <div class="row"><span>Move</span><strong class="${cls}">${diff>=0?'+':''}${money(diff)} (${pctText(pct)})</strong></div>
  `;
}

function openTradeModal(mode, stockId){
  const s = game.stocks.find(x=>x.id===stockId); if(!s) return;
  currentTradeMode = mode; currentTradeStock = s.id;
  tradeHeadline.textContent = `${mode==='buy'?'Buy':'Sell'} ${s.name}`;
  tradeInfo.textContent = mode==='buy' ? `Price: ${money(s.price)} — You have ${money(game.cash)} cash` : `Price: ${money(s.price)} — You own ${(game.portfolio[s.id]||{shares:0}).shares} shares`;
  tradeShares.value = mode === 'buy' ? 1 : 1;
  updateTradeCost();
  updateTradeMeta();
  renderTradeQuickButtons();
  tradeOverlay.style.display = 'flex'; tradeOverlay.setAttribute('aria-hidden','false'); tradeOverlay.querySelector('.modal').classList.add(mode==='buy'?'pos':'neg','show');
  tradeShares.focus();
}

function updateTradeCost(){
  const s=game.stocks.find(x=>x.id===currentTradeStock);
  const shares=Math.max(0,Math.floor(Number(tradeShares.value)||0));
  tradeCost.textContent = currentTradeMode === 'sell'
    ? `Sell: ${money(round2((s? s.price:0) * shares))}`
    : `Cost: ${money(round2((s? s.price:0) * shares))}`;
}

tradeShares.addEventListener('input', updateTradeCost);

tradeCancel.addEventListener('click', ()=>{
  tradeOverlay.style.display='none'; tradeOverlay.setAttribute('aria-hidden','true'); tradeOverlay.querySelector('.modal').classList.remove('pos','neg','show'); currentTradeStock=null;
});

tradeConfirm.addEventListener('click', ()=>{ 
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
    logEvent(`Opened short: ${shares}× ${s.name} @ ${money(s.price)}. Collateral held: ${money(collateral)}.`);
    showNotification(`📉 Short opened: ${shares}× ${s.name} @ ${money(s.price)}`, 3000);
  } else if (currentTradeMode === 'buy'){
    const max = Math.floor(game.cash / s.price);
    if (shares > max){ alert('Not enough cash'); return; }
    const prev = game.portfolio[s.id]||{shares:0, avgPrice:0};
    const newTotal = prev.shares + shares;
    const newAvg = newTotal>0 ? round2(((prev.shares*prev.avgPrice)+(shares*s.price))/newTotal) : s.price;
    game.portfolio[s.id] = { shares:newTotal, avgPrice:newAvg, boughtDay: prev.shares > 0 ? (prev.boughtDay ?? game.day) : game.day };
    game.cash = round2(game.cash - shares*s.price);
    logEvent(`Bought ${shares} × ${s.name}.`);
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
    logEvent(`Sold ${shares} × ${s.name}.`);
    game.lastSaleProfitPct = Math.max(game.lastSaleProfitPct || 0, profitPct);
    game.totalProfit = round2((game.totalProfit||0) + pnl);
    game.totalTrades++;
    if (pnl >= 0) playSellProfitSound(); else playSellLossSound();
    const cashDisp = document.getElementById('cash');
    if (cashDisp && typeof showFloat === 'function'){
      const r = cashDisp.getBoundingClientRect();
      showFloat(r.left + 20, r.top - 20, `${pnl >= 0 ? '+' : ''}${money(pnl)}`, pnl >= 0 ? '#00ff88' : '#ff6b6b');
    }
  }
  tradeOverlay.style.display='none'; tradeOverlay.setAttribute('aria-hidden','true'); tradeOverlay.querySelector('.modal').classList.remove('pos','neg','show');
  currentTradeStock = null; queueRender(); autoSave(); checkAchievements();
});

function logEvent(text){
  const line = document.createElement('div'); line.style.padding='6px 0';
  line.innerHTML = `<strong style="color:#2b9cf5">Day ${game.day}:</strong> <span class="small muted">${text}</span>`;
  eventsLogEl.prepend(line);
  while (eventsLogEl.children.length > 120) eventsLogEl.removeChild(eventsLogEl.lastChild);
  game.events.unshift({day:game.day, text});
  capArray(game.events, 120);
}

function evaluateMarketState(){
  const days=7; let sum=0,count=0;
  for (const s of game.stocks){
    if (s.history.length<2) continue;
    const N = Math.min(days, s.history.length-1);
    let local=0;
    for (let i=1;i<=N;i++){ const prev=s.history[s.history.length-1-i], cur=s.history[s.history.length-i]; if (prev>0) local += (cur-prev)/prev; }
    if (N>0){ sum += local / N; count++; }
  }
  const avg = count>0 ? sum/count : 0;
  if (avg > 0.002) game.marketState = 'Bull'; else if (avg < -0.002) game.marketState = 'Bear'; else game.marketState = 'Sideways';
  marketStateEl.textContent = game.marketState;
}

function processNotifQueue(){
  if (!notifQueue.length) return;
  const now = Date.now();
  if (now - lastNotifTime < NOTIF_COOLDOWN_MS) {
    setTimeout(processNotifQueue, Math.max(200, NOTIF_COOLDOWN_MS - (now - lastNotifTime)));
    return;
  }
  const item = notifQueue.shift();
  showNotifImmediate(item.text, item.ms);
}

function showNotifImmediate(text, ms){
  if(disableUI) return;
  lastNotifTime = Date.now();
  const n = document.createElement('div'); n.className = 'notif small';
  n.textContent = text;
  notifWrap.appendChild(n);
  setTimeout(()=> {
    try { notifWrap.removeChild(n); } catch(e) {}
  }, ms || NOTIF_DURATION_MS);
  setTimeout(processNotifQueue, NOTIF_COOLDOWN_MS);
}

function showNotification(text, ms = NOTIF_DURATION_MS){
  notifQueue.push({ text, ms });
  processNotifQueue();
}

function showQuickTipFromNews(news){
  if (!news || !news.impactMap) return;
  const posSectors = Object.keys(news.impactMap).filter(k => k !== 'market' && news.impactMap[k] > 0);
  if (!posSectors.length) return;
  const sector = pick(posSectors);
  const candidates = game.stocks.filter(s=>s.sector===sector);
  if (!candidates.length) return;
  const comp = pick(candidates);
  showNotification(`Tip: ${comp.name} may rise this week — you could buy soon!`, NOTIF_DURATION_MS);
}

function applySingleDay(weeklyNews){
  const previousNetworth = game.history.length > 0 ? game.history[game.history.length - 1].networth : game.cash;
  
  game.day++;
  evaluateMarketState();

  // ── ECONOMIC INDICATOR DRIFT (weekly) ──────────────────
  if (game.day % 7 === 0) {
    game.interestRate = Math.max(1, Math.min(9, game.interestRate + (Math.random()*1.4 - 0.7)));
    game.inflation    = Math.max(0.5, Math.min(7, game.inflation    + (Math.random()*1.2 - 0.5)));
    updateEcoBar();
  }

  // ── SECTOR ECONOMIC MODIFIERS ──────────────────────────
  function getEcoMod(sector){
    let mod = 0;
    const ir = game.interestRate, inf = game.inflation;
    if (sector === 'Tech')     { if (ir > 5) mod -= 0.004; if (ir < 3) mod += 0.003; }
    if (sector === 'Finance')  { if (ir > 5) mod += 0.005; if (ir < 3) mod -= 0.002; }
    if (sector === 'Biotech')  { if (ir > 6) mod -= 0.003; }
    if (sector === 'Retail')   { if (inf > 4) mod -= 0.004; if (inf < 2) mod += 0.002; }
    if (sector === 'Transport'){ if (inf > 4) mod -= 0.003; }
    if (sector === 'Energy')   { if (inf > 4) mod += 0.004; }
    return mod;
  }

  for (const s of game.stocks){
    const sectorMult = (s.sector && {Tech:1.05,Energy:1.05,Retail:0.95,Finance:0.9,Transport:1.0,Biotech:1.15}[s.sector]) || 1;
    const baseVol = s.volatility * STANDARD.volatilityMultiplier * sectorMult;
    const basePct = (Math.random()*2 - 1) * baseVol * 0.02;
    let totalPct = basePct + getEcoMod(s.sector);
    if (game.marketState === 'Bull') totalPct += TREND_DAILY_BIAS;
    else if (game.marketState === 'Bear') totalPct -= TREND_DAILY_BIAS;
    if (weeklyNews && weeklyNews.impactMap){
      if (weeklyNews.impactMap.market) totalPct += (weeklyNews.impactMap.market / 7);
      if (weeklyNews.impactMap[s.sector]) totalPct += (weeklyNews.impactMap[s.sector] / 7);
    }
    s.changePct = totalPct;
    s.price = Math.max(0.01, round2(s.price * (1 + totalPct)));
    s.history.push(round2(s.price));
    capArray(s.history, 200);
  }

  if (Math.random() < SHOCK_PROB_SURGE){ const t = pick(game.stocks); const g = rand(0.25,0.9); t.changePct += g; t.price = round2(t.price * (1 + g)); t.history.push(round2(t.price)); capArray(t.history, 200); logEvent(`⚡ ${t.name} had a sudden positive surprise!`); showNotification(`📈 ${t.name} jumped +${(g*100).toFixed(1)}% — great opportunity!`); }
  if (Math.random() < SHOCK_PROB_FALL){ const t = pick(game.stocks); const l = rand(0.2,0.7); t.changePct -= l; t.price = Math.max(0.01, round2(t.price * (1 - l))); t.history.push(round2(t.price)); capArray(t.history, 200); logEvent(`⚠️ ${t.name} experienced a sudden drop.`); showNotification(`📉 ${t.name} dropped ${(l*100).toFixed(1)}% — watch out!`);
    // Screen shake on major crash
    if (l > 0.4) { document.body.classList.add('market-crash'); setTimeout(()=>document.body.classList.remove('market-crash'), 700); playCrashSound(); }
  }

  // ── DIVIDENDS (every 7 days) ───────────────────────────
  let dividendTotal = 0;
  if (game.day % 7 === 0){
    for (const [id, pos] of Object.entries(game.portfolio)){
      if (!pos.shares) continue;
      const s = game.stocks.find(x=>x.id===id);
      if (!s) continue;
      const yld = DIVIDEND_YIELD[s.sector];
      if (!yld) continue;
      const payout = round2(pos.shares * s.price * yld);
      if (payout > 0){
        game.cash = round2(game.cash + payout);
        dividendTotal += payout;
      }
    }
    if (dividendTotal > 0){
      game.totalDividendsEarned = round2((game.totalDividendsEarned||0) + dividendTotal);
      logEvent(`💰 Dividend payout received: ${money(dividendTotal)}`);
      showNotification(`💰 Dividend: +${money(dividendTotal)} earned from holdings!`);
      document.getElementById('ecoDividend').textContent = '+' + money(dividendTotal);
      // Float animation near cash display
      const cashEl2 = document.getElementById('cash');
      if (cashEl2){ const r = cashEl2.getBoundingClientRect(); showFloat(r.left + 40, r.top - 10, `+${money(dividendTotal)}`, '#ffb020'); }
      setTimeout(()=>{ document.getElementById('ecoDividend').textContent = '—'; }, 4000);
    }
  }

  // ── LOAN DAILY INTEREST ────────────────────────────────
  if (game.loan > 0){
    const interest = round2(game.loan * 0.005); // 0.5% per day
    game.cash = round2(game.cash - interest);
    logEvent(`💳 Loan interest paid: ${money(interest)}`);
    // Margin call check
    const pv = Object.keys(game.portfolio).reduce((a,id)=>{ const e=game.portfolio[id]; const s=game.stocks.find(x=>x.id===id); return a+(s?s.price*e.shares:0); },0);
    const nw = round2(game.cash + pv);
    if (nw < game.loan){
      logEvent(`⚠️ MARGIN CALL! Selling portfolio to cover loan.`);
      showNotification(`🚨 MARGIN CALL! Your net worth fell below your loan. Portfolio is being liquidated!`, 8000);
      document.body.classList.add('market-crash');
      setTimeout(()=>document.body.classList.remove('market-crash'),700);
      // Force sell all
      for (const id of Object.keys(game.portfolio)){
        const s = game.stocks.find(x=>x.id===id);
        if (!s) continue;
        const val = round2(s.price * game.portfolio[id].shares);
        game.cash = round2(game.cash + val);
        delete game.portfolio[id];
      }
      // Repay what we can
      const repay = Math.min(game.cash, game.loan);
      game.cash = round2(game.cash - repay);
      game.loan = round2(game.loan - repay);
    }
    updateMarginPanel();
  }

  // ── SHORT POSITION TRACKING ────────────────────────────
  for (const [id, short] of Object.entries(game.shorts)){
    const s = game.stocks.find(x=>x.id===id);
    if (!s) continue;
    // Shorts checked live; P&L calculated at cover time
  }

  const portfolioVal = Object.keys(game.portfolio).reduce((acc,id)=>{ const e=game.portfolio[id]; const s=game.stocks.find(x=>x.id===id); return acc + (s? s.price * e.shares : 0); },0);
  const networth = round2(game.cash + portfolioVal);
  const dayProfit = round2(networth - previousNetworth);
  
  if (dayProfit > game.bestDayProfit) game.bestDayProfit = dayProfit;

  if (dayProfit <= -1000) game.pendingComeback = true;
  if (game.pendingComeback && dayProfit >= 1000) { game.comebackReady = true; game.pendingComeback = false; }
  if (previousNetworth > 0 && (dayProfit / previousNetworth) >= 0.05) game.luckyGainDays = (game.luckyGainDays || 0) + 1;
  
  game.history.push({ day:game.day, networth, portfolioVal, cash: game.cash });
  capArray(game.history, 200);
  
  triggerSpecialEvent();
  checkAndCompleteQuests();
  game.lastDaySharesBought = 0;

  if (shouldPromptEndgame(game.day, totalDays, game.yearPromptShown)) {
    game.yearPromptShown = true;
    clearWeekTimer();
    showEndOfYearPrompt();
  }
  
  queueRender();

  if (game.day > 0 && game.day % 30 === 0){
    giveSalary(500);
  }
}

function generateWeeklyNews(){
  return generateWeeklyNewsPure(game);
}

function populateNewsModal(news){
  modalHeadline.textContent = news.headline;
  const winners = [], losers = [];
  if (news.impactMap){
    for (const k of Object.keys(news.impactMap)){
      if (k === 'market') continue;
      const v = news.impactMap[k];
      if (v > 0) winners.push(k);
      else if (v < 0) losers.push(k);
    }
  }
  const wins = winners.length ? `Likely to go up: ${winners.join(', ')}.` : '';
  const loss = losers.length ? `Likely to go down: ${losers.join(', ')}.` : '';
  modalImpact.textContent = `${wins} ${loss}`.trim() || 'Mixed effects expected across market.';
  modalSectors.textContent = news.sectors && news.sectors.length ? news.sectors.join(', ') : 'Various';
  explainBox.textContent = news.explain || 'This news will move different companies differently — some up, some down. Think about what each company does to guess which way it moves.';
  explainBox.style.display = 'none';
  explainBtn.textContent = 'Explain';
}

function showLetter(toText, bodyText, signText, autoAckMs = POPUP_AUTO_ACK_MS){
  if(disableUI) return;
  letterTo.textContent = toText;
  letterBody.textContent = bodyText;
  letterSign.textContent = signText;
  letterOverlay.style.display = 'flex';
  letterOverlay.querySelector('.modal').classList.add('show');
  const t = setTimeout(()=> {
    if (letterOverlay.style.display !== 'none'){
      hideLetter();
    }
  }, autoAckMs);
  const ackHandler = ()=> { clearTimeout(t); hideLetter(); letterAck.removeEventListener('click', ackHandler); };
  letterAck.addEventListener('click', ackHandler);
}
function hideLetter(){
  letterOverlay.querySelector('.modal').classList.remove('show');
  letterOverlay.style.display = 'none';
}

function getAvailableCategoriesForLevel(level){
  const contract = LEVEL_CONTRACTS[level];
  if (!contract) return CATEGORIES;
  const count = contract.categories;
  return CATEGORIES.slice(0, count);
}

function getStocksPerCategoryForLevel(level){
  const contract = LEVEL_CONTRACTS[level];
  if (!contract) return 10;
  return contract.stocksPerCategory;
}

function showContract(levelNum){
  if(disableUI) return;
  const contract = LEVEL_CONTRACTS[levelNum];
  if (!contract) return;
  
  pendingContractLevel = levelNum;
  contractLevel.textContent = levelNum;
  contractDetails.innerHTML = `
    <div style="font-weight:800;color:#00ff88;margin-bottom:6px;">${contract.title}</div>
    <div style="color:#e0e8f0;">${contract.description}</div>
    <hr style="margin:10px 0;border:none;border-top:1px dashed rgba(0,212,255,0.1);">
    <div class="small" style="color:var(--muted);">${contract.requirements}</div>
  `;
  
  contractBenefits.innerHTML = '';
  const benefits = [
    `Monthly Bonus: ${money(contract.monthlyBonus)}`,
    `Available Categories: ${contract.categories}`,
    `Stocks Per Category: ${contract.stocksPerCategory}`,
    `Level Rank: ${contract.title}`
  ];
  benefits.forEach(b => {
    const li = document.createElement('li');
    li.style.marginBottom = '6px';
    li.textContent = b;
    contractBenefits.appendChild(li);
  });
  
  // Generate contract preview
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const currentWeekNum = Math.floor(game.day / 7);
  contractPreview.innerHTML = `
    <div style="font-weight:bold;text-align:center;margin-bottom:8px;color:#00d4ff;">EMPLOYMENT AGREEMENT</div>
    <div style="text-align:center;margin-bottom:10px;">___________________________</div>
    <div style="margin-bottom:2px;color:#e0e8f0;"><span style="font-weight:bold;color:#00ff88;">Trader Name:</span> <span id="previewName" style="color:#00d4ff;">_________________</span></div>
    <div style="margin-bottom:2px;color:#e0e8f0;"><span style="font-weight:bold;color:#00ff88;">Position:</span> <span style="color:#00d4ff;">${contract.title}</span></div>
    <div style="margin-bottom:2px;color:#e0e8f0;"><span style="font-weight:bold;color:#00ff88;">Level:</span> <span style="color:#00d4ff;">${levelNum}</span></div>
    <div style="margin-bottom:2px;color:#e0e8f0;"><span style="font-weight:bold;color:#00ff88;">Week:</span> <span style="color:#00d4ff;">${currentWeekNum}</span></div>
    <div style="margin-bottom:2px;color:#e0e8f0;"><span style="font-weight:bold;color:#00ff88;">Date:</span> <span style="color:#00d4ff;">${dateStr}</span></div>
    <div style="margin-top:8px;border-top:1px dashed rgba(0,212,255,0.2);padding-top:8px;text-align:center;font-style:italic;color:#a0a8b0;">This contract grants trading privileges...</div>
  `;
  
  contractNameInput.value = game.playerName || '';
  contractNameInput.focus();
  
  // Update preview name in real-time
  const updatePreviewName = () => {
    document.getElementById('previewName').textContent = contractNameInput.value || '_________________';
  };
  contractNameInput.oninput = updatePreviewName;
  updatePreviewName();
  
  contractOverlay.style.display = 'flex';
  contractOverlay.setAttribute('aria-hidden','false');
  contractOverlay.querySelector('.modal').classList.add('show');
}

function hideContract(){
  contractOverlay.querySelector('.modal').classList.remove('show');
  contractOverlay.style.display = 'none';
}

contractSign.addEventListener('click', ()=> {
  if (pendingContractLevel <= 0) return;
  const contract = LEVEL_CONTRACTS[pendingContractLevel];
  const playerName = (contractNameInput.value || 'Trader').trim();
  game.playerName = playerName;
  game.level = pendingContractLevel;
  hideContract();
  if (pendingContractLevel === 1) {
    logEvent(`Signed Level 1 contract - Junior Trader. Welcome, ${playerName}!`);
  } else {
    logEvent(`Promoted to Level ${pendingContractLevel} - ${contract.title}!`);
    showNotification(`🎉 Level ${pendingContractLevel} - ${contract.title}! Welcome, ${playerName}!`);
    playLevelUpSound();
  }
  renderCategoryTiles();
  renderStocksForCategory();
  queueRender();
  autoSave();
  if (pendingContractLevel === 1 && !runningYear) {
    setTimeout(() => { startYearRun(); }, 300);
  }
});

function giveSalary(amount){
  // Use level-based bonus if available
  const levelBonus = LEVEL_CONTRACTS[game.level] ? LEVEL_CONTRACTS[game.level].monthlyBonus : amount;
  game.cash = round2(game.cash + levelBonus);
  logEvent(`Salary received: ${money(levelBonus)}.`);
  showLetter('Dear Player,', `Good news — your monthly paycheck has arrived. We've deposited ${money(levelBonus)} into your account. Keep learning and having fun!`, '— HR Department', POPUP_AUTO_ACK_MS * 1.2);
  queueRender();
  updateProgress();
  checkLevelUp();
}

function giveBossBonus(amount){
  game.cash = round2(game.cash + amount);
  logEvent(`Boss bonus: ${money(amount)} received.`);
  showLetter('Dear Player,', `You've done really well! As a reward, your boss has given you a bonus of ${money(amount)}. Keep up the great work!`, '— Your Boss', POPUP_AUTO_ACK_MS * 1.5);
  queueRender();
  updateProgress();
  checkLevelUp();
}

function checkLevelUp(){
  const portfolioVal = Object.keys(game.portfolio).reduce((acc,id)=>{ const e=game.portfolio[id]; const s=game.stocks.find(x=>x.id===id); return acc + (s? s.price * e.shares : 0); },0);
  const networth = round2(game.cash + portfolioVal);
  
  // Check if player qualifies for next level
  for (let level = 4; level >= 2; level--) {
    const contract = LEVEL_CONTRACTS[level];
    if (game.level < level && networth >= contract.unlockAt && !game.levelUpUnlocked[level]) {
      game.levelUpUnlocked[level] = true;
      setTimeout(() => {
        showContract(level);
      }, 500);
      return;
    }
  }
}

function getDaysPerTick(){
  if (speedMultiplier <= 100) return 1;
  return Math.min(2000, Math.max(1, Math.floor(speedMultiplier / 100)));
}
function getTickMs(){
  if (speedMultiplier <= 200) return Math.max(10, Math.floor(perDayMsBase / speedMultiplier));
  return 10;
}

let weekTimerRAF = false;
let weekTimerNews = null;

function scheduleNextTick(){
  if (weekTimer) clearWeekTimer();
  const ms = getTickMs();
  if (ms <= 16) {
    weekTimerRAF = true;
    weekTimer = requestAnimationFrame(() => runTick());
  } else {
    weekTimerRAF = false;
    weekTimer = setTimeout(() => runTick(), ms);
  }
}

function runTick(){
  if (paused){
    scheduleNextTick();
    return;
  }

  const start = performance.now();
  const maxMs = 8;
  const maxDays = getDaysPerTick();
  let daysProcessed = 0;

  while (daysProcessed < maxDays) {
    if (daysAppliedInWeek >= 7) {
      daysAppliedInWeek = 0;
      currentWeek++;
      pendingWeeklyNews = generateWeeklyNews();
      weekTimerNews = pendingWeeklyNews;
      if (!disableUI) {
        clearWeekTimer();
        setTimeout(()=> showWeekSummary(), 0);
        return;
      }
    }

    applySingleDay(weekTimerNews);
    daysAppliedInWeek++;
    daysProcessed++;

    if (performance.now() - start > maxMs) break;
  }

  updateProgress();
  scheduleNextTick();
}

function startWeekTimer(news){
  weekTimerNews = news;
  scheduleNextTick();
}

function clearWeekTimer(){
  if (!weekTimer) return;
  if (weekTimerRAF) cancelAnimationFrame(weekTimer);
  else clearTimeout(weekTimer);
  weekTimer = null;
  weekTimerRAF = false;
}

function adjustSpeedImmediate(){
  speedLabel.textContent = speedMultiplier + 'x';
  if (weekTimer && daysAppliedInWeek > 0 && daysAppliedInWeek < 7){
    const currentNews = pendingWeeklyNews;
    clearWeekTimer();
    startWeekTimer(currentNews);
  }
}

function startYearRun(){
  if (runningYear) return;
  runningYear = true; paused = false; currentWeek = 0; pauseResumeBtn.textContent = 'Pause';
  pendingWeeklyNews = pendingWeeklyNews || generateWeeklyNews();
  runNextWeek();
}

function runNextWeek(){
  if (!runningYear) return;
  if (paused) return;
  currentWeek++;
  daysAppliedInWeek = 0;
  currentWeekStartNet = Number((networthEl.textContent || '$0').replace(/[$,]/g,'')) || game.cash;
  startWeekTimer(pendingWeeklyNews);
}

function showWeekSummary(){
  if(disableUI) {
    pendingWeeklyNews = generateWeeklyNews();
    daysAppliedInWeek = 0;
    currentWeekStartNet = Number((networthEl.textContent || '$0').replace(/[$,]/g,'')) || game.cash;
    return;
  }
  const afterNet = Number((networthEl.textContent || '$0').replace(/[$,]/g,'')) || game.cash;
  const diff = round2(afterNet - currentWeekStartNet);
  const weekNum = Math.floor(game.day / 7);
  weekSummaryHeadline.textContent = `Week ${weekNum} results`;
  weekSummaryBody.textContent = `You now have ${money(afterNet)}. This week you ${diff>=0 ? 'gained' : 'lost'} ${money(Math.abs(diff))}.`;
  weekSummaryOverlay.style.display = 'flex'; weekSummaryOverlay.querySelector('.modal').classList.add('show');

  pendingWeeklyNews = generateWeeklyNews();
  setTimeout(()=> { showQuickTipFromNews(pendingWeeklyNews); }, 300);

  if (Math.random() < 0.05){
    const bonus = Math.round(rand(400, 1600));
    setTimeout(()=> giveBossBonus(bonus), Math.max(1000, POPUP_AUTO_ACK_MS / 2));
  }
}

const viewBtn = document.getElementById('viewNewsAfterSummary'), contBtn = document.getElementById('continueAfterSummary');
viewBtn.addEventListener('click', ()=>{
  weekSummaryOverlay.style.display='none'; weekSummaryOverlay.querySelector('.modal').classList.remove('show');
  populateNewsModal(pendingWeeklyNews);
  modalOverlay.style.display='flex'; modalOverlay.querySelector('.modal').classList.add('show');
});
contBtn.addEventListener('click', ()=>{
  weekSummaryOverlay.style.display='none'; weekSummaryOverlay.querySelector('.modal').classList.remove('show');
  populateNewsModal(pendingWeeklyNews);
  modalOverlay.style.display='flex'; modalOverlay.querySelector('.modal').classList.add('show');
  setTimeout(()=> { ackBtn.click(); }, POPUP_AUTO_ACK_MS);
});

explainBtn.addEventListener('click', ()=>{ if (explainBox.style.display === 'none' || explainBox.style.display === '') { explainBox.style.display = 'block'; explainBtn.textContent = 'Hide'; } else { explainBox.style.display = 'none'; explainBtn.textContent = 'Explain'; } });
ackBtn.addEventListener('click', ()=>{
  modalOverlay.style.display='none'; modalOverlay.querySelector('.modal').classList.remove('show');
  if (runningYear) runNextWeek(); else { runningYear = true; runNextWeek(); }
});

function openChart(stockId){
  if (stockId === 'market_networth'){
    chartHeadline.textContent = 'Net Worth';
    chartSub.textContent = `Points: ${game.history.length}`;
    chartMode.value = 'networth';
  } else {
    const s = game.stocks.find(x=>x.id===stockId);
    if (!s) return;
    chartHeadline.textContent = `${s.name} — ${s.sector}`;
    chartSub.textContent = `Current: ${money(s.price)}`;
    chartMode.value = 'price';
  }
  chartOverlay.style.display = 'flex'; chartOverlay.querySelector('.modal').classList.add('show');
  setTimeout(()=> renderChart(stockId), 40);
}
chartClose.addEventListener('click', ()=>{ chartOverlay.style.display='none'; chartOverlay.querySelector('.modal').classList.remove('show'); });

function renderChart(stockId){
  const canvas = chartCanvas; const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * (window.devicePixelRatio || 1)); canvas.height = Math.floor(rect.height * (window.devicePixelRatio || 1));
  const ctx = canvas.getContext('2d'); ctx.setTransform(window.devicePixelRatio||1,0,0,window.devicePixelRatio||1,0,0); ctx.clearRect(0,0,rect.width,rect.height);
  const pad = { l:50, r:12, t:22, b:36 }; const W = rect.width, H = rect.height; const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
  const mode = chartMode.value; let series = [], label = '';
  if (mode === 'networth') { series = game.history.map(h=>h.networth); label = 'Net Worth'; }
  else if (stockId) { const s = game.stocks.find(x=>x.id===stockId); if (!s) return; series = s.history.slice(); label = `${s.name} · ${s.sector}`; }
  if (!series.length) return;
  let min = Math.min(...series), max = Math.max(...series); if (min === max) { min *= 0.98; max *= 1.02; }
  const yMargin = (max-min)*0.08; min -= yMargin; max += yMargin;
  ctx.strokeStyle = 'rgba(7,34,40,0.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.l,pad.t); ctx.lineTo(pad.l,pad.t+plotH); ctx.lineTo(pad.l+plotW,pad.t+plotH); ctx.stroke();
  ctx.fillStyle = 'rgba(7,34,40,0.8)'; ctx.font = '12px system-ui, Arial';
  for (let i=0;i<=4;i++){ const y = pad.t + (plotH * i / 4); const val = (max - ((max - min) * i / 4)); ctx.fillText(money(round2(val)), 6, y + 4); ctx.strokeStyle = 'rgba(7,34,40,0.04)'; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + plotW, y); ctx.stroke(); }
  const n = series.length;
  function xOf(i){ return pad.l + (plotW * i / Math.max(1,n-1)); }
  function yOf(v){ return pad.t + ((max - v) / (max - min) * plotH); }
  ctx.beginPath(); for (let i=0;i<n;i++){ const x = xOf(i), y = yOf(series[i]); if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  ctx.strokeStyle = '#2b9cf5'; ctx.lineWidth = 2; ctx.stroke();
  ctx.lineTo(pad.l + plotW, pad.t + plotH); ctx.lineTo(pad.l, pad.t + plotH); ctx.closePath(); ctx.fillStyle = 'rgba(43,156,245,0.06)'; ctx.fill();
  const lastX = xOf(n-1), lastY = yOf(series[n-1]); ctx.beginPath(); ctx.fillStyle = '#08303b'; ctx.arc(lastX, lastY, 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#0b2a3a'; ctx.font = '14px system-ui, Arial'; ctx.fillText(label, pad.l, 16); ctx.fillText(`Latest: ${money(series[n-1])}`, pad.l + 200, 16);
}

function getLeaderboard(){ try { return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]'); } catch(e){ return []; } }
function setLeaderboard(list){ localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list)); }

function openSubmitScoreModal(){
  const net = round2(game.cash + Object.keys(game.portfolio).reduce((a,id)=>{ const e=game.portfolio[id]; const s=game.stocks.find(x=>x.id===id); return a+(s?s.price*e.shares:0); },0));
  const nameInput = document.getElementById('submitScoreName');
  nameInput.value = game.playerName && game.playerName !== 'Trader' ? game.playerName : (_globalPlayerName || '');
  document.getElementById('submitScoreAmount').textContent = money(net);
  const overlay = document.getElementById('submitScoreOverlay');
  overlay.style.display = 'flex';
  overlay.querySelector('.modal').classList.add('show');
  setTimeout(()=> nameInput.focus(), 200);
}

function saveScoreToLeaderboard(nameOverride){
  const nameInput = document.getElementById('submitScoreName');
  const rawName = nameOverride !== undefined ? nameOverride : (nameInput ? nameInput.value : (game.playerName || 'Player'));
  const cleanName = sanitizePlayerName(rawName) || 'Player';
  const net = round2(game.cash + Object.keys(game.portfolio).reduce((a,id)=>{ const e=game.portfolio[id]; const s=game.stocks.find(x=>x.id===id); return a+(s?s.price*e.shares:0); },0));

  // Close submit modal if open
  const submitOverlay = document.getElementById('submitScoreOverlay');
  if (submitOverlay) { submitOverlay.style.display='none'; submitOverlay.querySelector('.modal').classList.remove('show'); }

  // Save locally (one entry per player name)
  const board = getLeaderboard();
  const key = cleanName.toLowerCase();
  const existingIndex = board.findIndex(entry => (entry.name || '').trim().toLowerCase() === key);
  let keptExistingLocalBest = false;
  if (existingIndex >= 0){
    if (net > Number(board[existingIndex].score || 0)){
      board[existingIndex] = { ...board[existingIndex], name: cleanName, score: net, day: game.day, level: game.level, date: new Date().toISOString() };
    } else {
      keptExistingLocalBest = true;
    }
  } else {
    board.push({ name: cleanName, score: net, day: game.day, level: game.level, date: new Date().toISOString() });
  }
  board.sort((a,b)=>b.score - a.score);
  setLeaderboard(board.slice(0, 50));

  // Update player name in game state
  if (cleanName && cleanName !== 'Player') game.playerName = cleanName;

  // Set player name for rank lookup before opening leaderboard
  _globalPlayerName = cleanName;

  // Open leaderboard on global tab immediately
  showLeaderboard();
  switchLbTab('global');

  // Submit globally (async)
  submitGlobalScore(cleanName, net, game.day, game.level)
    .then(rank => {
      const msg = keptExistingLocalBest
        ? (rank ? `Your all-time best was kept. Global rank: #${rank} 🌍` : 'Your local best score was kept.')
        : (rank ? `Score saved! Global rank: #${rank} 🌍` : 'Score saved locally.');
      showNotification('🏆 ' + msg, 5000);
      // Fire confetti for top-10 finishes
      if (rank && rank <= 10) showConfetti();
      // Refresh global leaderboard pane if still open
      const globalPane = document.getElementById('lbPaneGlobal');
      if (globalPane && globalPane.style.display !== 'none') renderGlobalLeaderboard();
    })
    .catch(()=> showNotification('Score saved locally. Global submit failed.', 4000));
}

function showLeaderboard(){
  leaderboardOverlay.style.display='flex';
  leaderboardOverlay.querySelector('.modal').classList.add('show');
  renderLocalLeaderboard();
}

function renderLocalLeaderboard(){
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
    const meta = document.createElement('span'); meta.className = 'lb-meta'; meta.textContent = `Day ${item.day||'?'} · Lv${item.level||'?'}`;
    div.append(rank, name, score, meta);
    el.appendChild(div);
  });
}

async function renderGlobalLeaderboard(){
  const pane = document.getElementById('lbPaneGlobal');
  const listEl = document.getElementById('lbGlobalList');
  const rankEl = document.getElementById('lbYourRank');
  if (!listEl) return;
  // Check config
  if (!isLeaderboardConfigured()){
    listEl.innerHTML = '<div class="lb-config-warn">⚠️ Global leaderboard is offline or not configured.<br>Start the laptop API (port 8788) + Cloudflare tunnel, set VITE_LB_API_BASE, and redeploy. See DEPLOY.md.</div>';
    rankEl.style.display = 'none';
    return;
  }
  listEl.innerHTML = '<div class="lb-loading">Loading global scores<span class="lb-spinner"></span></div>';
  rankEl.style.display = 'none';
  try {
    const data = await fetchGlobalLeaderboard();
    if (!data || !data.top10){ listEl.innerHTML = '<div class="lb-error">Could not load scores. Check your connection.</div>'; return; }
    const medals = ['🥇','🥈','🥉'];
    listEl.innerHTML = '';
    if (!data.top10.length){ listEl.innerHTML = '<div class="small muted" style="padding:16px;">No global scores yet — be the first!</div>'; }
    data.top10.forEach((item, i)=>{
      const div = document.createElement('div'); div.className = 'lb-entry';
      const pname = getGlobalPlayerName() || _globalPlayerName;
      const isYou = pname && (item.player_name || '').trim().toLowerCase() === pname.trim().toLowerCase();
      if (isYou) div.classList.add('lb-you');
      const rank = document.createElement('span'); rank.className = 'lb-rank'; rank.textContent = medals[i] || '#'+(i+1);
      const name = document.createElement('span'); name.className = 'lb-name'; name.textContent = item.player_name || 'Player';
      if (isYou) {
        const you = document.createElement('span');
        you.style.cssText = 'font-size:10px;color:#00d4ff;font-weight:700;margin-left:4px';
        you.textContent = '(you)';
        name.appendChild(you);
      }
      const score = document.createElement('span'); score.className = 'lb-score'; score.textContent = money(item.score);
      const meta = document.createElement('span'); meta.className = 'lb-meta'; meta.textContent = `Day ${item.day||'?'} · Lv${item.level||'?'}`;
      div.append(rank, name, score, meta);
      listEl.appendChild(div);
    });
    if (data.playerRank){
      rankEl.style.display = 'block';
      rankEl.textContent = '';
      const badge = document.createElement('div');
      badge.className = 'lb-rank-badge';
      badge.textContent = `Your Global Rank: #${data.playerRank} of ${data.total}`;
      rankEl.appendChild(badge);
    }
  } catch(e){
    listEl.innerHTML = '<div class="lb-error">Failed to load global scores. Check console for details.</div>';
    console.error('Global leaderboard error:', e);
  }
}

function switchLbTab(tab){
  const localPane = document.getElementById('lbPaneLocal');
  const globalPane = document.getElementById('lbPaneGlobal');
  const localTab = document.getElementById('lbTabLocal');
  const globalTab = document.getElementById('lbTabGlobal');
  if (tab === 'local'){
    localPane.style.display = 'block'; globalPane.style.display = 'none';
    setAriaSelected([localTab, globalTab], localTab);
    renderLocalLeaderboard();
  } else {
    localPane.style.display = 'none'; globalPane.style.display = 'block';
    setAriaSelected([localTab, globalTab], globalTab);
    renderGlobalLeaderboard();
  }
}

leaderboardClose.addEventListener('click', ()=>{ leaderboardOverlay.style.display='none'; leaderboardOverlay.querySelector('.modal').classList.remove('show'); });
leaderboardClear.addEventListener('click', ()=>{ if (confirm('Clear local leaderboard?')){ setLeaderboard([]); renderLocalLeaderboard(); } });
document.getElementById('lbSubmitBtn').addEventListener('click', openSubmitScoreModal);

// Submit score modal handlers
document.getElementById('submitScoreCancel').addEventListener('click', ()=>{
  const overlay = document.getElementById('submitScoreOverlay');
  overlay.style.display = 'none'; overlay.querySelector('.modal').classList.remove('show');
});
document.getElementById('submitScoreConfirm').addEventListener('click', ()=>{
  const nameVal = document.getElementById('submitScoreName').value.trim();
  if (!nameVal){ document.getElementById('submitScoreName').focus(); return; }
  playSubmitSound();
  saveScoreToLeaderboard();
});
document.getElementById('submitScoreName').addEventListener('keydown', (e)=>{
  if (e.key === 'Enter') document.getElementById('submitScoreConfirm').click();
});

function autoSave(){
  try {
    saveGameToStorage(game, { currentWeek, totalWeeks, totalDays, pendingWeeklyNews });
  } catch(e){}
}
function manualSave(){ autoSave(); alert('Saved locally.'); }
function loadSaved(){
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
}
function clearSave(){ if (!confirm('Clear saved game?')) return; clearSaveStorage(); alert('Saved cleared.'); }

setInterval(()=>{ if (runningYear) autoSave(); }, 60000);

document.getElementById('restart').addEventListener('click', ()=>{ if (!confirm('Start a new game? This will reset current progress unless saved.')) return; clearWeekTimer(); initGame(true); });
pauseResumeBtn.addEventListener('click', ()=>{ paused = !paused; pauseResumeBtn.textContent = paused ? 'Resume' : 'Pause'; if (!paused && runningYear && weekTimer==null && daysAppliedInWeek>0 && daysAppliedInWeek<7) startWeekTimer(pendingWeeklyNews); });
saveBtn.addEventListener('click', manualSave);
loadBtn.addEventListener('click', loadSaved);
clearSaveBtn.addEventListener('click', clearSave);
leaderboardBtn.addEventListener('click', showLeaderboard);
marketChartBtn.addEventListener('click', ()=> openChart('market_networth'));

speedBtn.addEventListener('click', ()=>{
  speedIndex = (speedIndex + 1) % SPEED_OPTIONS.length;
  speedMultiplier = SPEED_OPTIONS[speedIndex];
  speedLabel.textContent = speedMultiplier + 'x';
  adjustSpeedImmediate();
});

document.addEventListener('click', (e)=>{
  if (e.target === chartOverlay) chartOverlay.style.display = 'none';
  if (e.target === tradeOverlay) { tradeOverlay.style.display = 'none'; tradeOverlay.querySelector('.modal').classList.remove('pos','neg','show'); }
  if (e.target === leaderboardOverlay) { leaderboardOverlay.style.display = 'none'; leaderboardOverlay.querySelector('.modal').classList.remove('show'); }
  if (e.target === contractOverlay && runningYear) { hideContract(); }
});

function initGame(autoStart=true){
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
  pendingWeeklyNews = null; currentWeek = 0; runningYear = false; paused = false; daysAppliedInWeek = 0;
  renderCategoryTiles(); renderStocksForCategory(); renderPortfolio(); updateProgress();
  updateEcoBar(); updateMarginPanel();
  logEvent(`Simulation started. ${totalDays} days. Starting cash ${money(game.cash)}.`);
  if (autoStart) {
    setTimeout(() => {
      showContract(1);
    }, 300);
  }
}

function updateProgress(){
  const daysSoFar = Math.min(game.day, totalDays);
  const daysTotal = totalDays;
  const pct = Math.min(100, Math.round((daysSoFar / daysTotal) * 100));
  progressBarEl.style.width = pct + '%';
  progressTextEl.textContent = `${daysSoFar}/${daysTotal} days`;
  dayNumEl.textContent = game.day;
  levelDisplay.textContent = game.level;
  cashEl.textContent = money(game.cash);
  const portfolioVal = Object.keys(game.portfolio).reduce((acc,id)=>{ const e=game.portfolio[id]; const s=game.stocks.find(x=>x.id===id); return acc + (s? s.price * e.shares : 0); },0);
  portfolioValueEl.textContent = money(portfolioVal);
  networthEl.textContent = money(round2(game.cash + portfolioVal));
  cashPanelEl.textContent = money(game.cash);
  marketStateEl.textContent = game.marketState;
  const unrealEl = document.getElementById('unrealisedTop');
  if (unrealEl) {
    const unreal = Object.keys(game.portfolio).reduce((acc, id) => {
      const e = game.portfolio[id];
      const s = game.stocks.find((x) => x.id === id);
      return acc + (s ? (s.price - e.avgPrice) * e.shares : 0);
    }, 0);
    unrealEl.textContent = money(round2(unreal));
    unrealEl.className = unreal >= 0 ? 'profit-pos' : 'profit-neg';
  }
  
  // Update stats display
  document.getElementById('bestDayProfit').textContent = money(game.bestDayProfit);
  document.getElementById('totalTrades').textContent = game.totalTrades;

  const networth = round2(game.cash + portfolioVal);
  const profit = round2(networth - STANDARD.startingMoney);
  if (!game.leaderboardPromptShown && profit >= LEADERBOARD_PROMPT_PROFIT){
    game.leaderboardPromptShown = true;
    showNotification(`🚀 You're up ${money(profit)}! Submit your score to the global leaderboard?`, 8000);
    setTimeout(()=> openSubmitScoreModal(), 800);
  }
  if (networth < 5000 && !game.bonusGiven){
    const bonus = 3000;
    game.cash = round2(game.cash + bonus);
    game.bonusGiven = true;
    logEvent(`Your boss noticed and gave you a bonus of ${money(bonus)}!`);
    showNotification(`💰 Boss bonus! You received ${money(bonus)} to help out.`, NOTIF_DURATION_MS);
    queueRender();
    updateProgress();
  }
  checkLevelUp();
  checkAchievements();
}

function showEndOfYearPrompt(){
  endYearOverlay.style.display = 'flex';
  endYearOverlay.setAttribute('aria-hidden', 'false');
  endYearOverlay.querySelector('.modal').classList.add('show');
  trapFocus(endYearOverlay);
}

continueExtendBtn.addEventListener('click', ()=>{
  const prevTotal = totalDays;
  totalDays = EXTENDED_TOTAL_DAYS;
  totalWeeks = Math.ceil(totalDays / 7);
  endYearOverlay.querySelector('.modal').classList.remove('show');
  endYearOverlay.style.display = 'none';
  updateProgress();
  logEvent(`Simulation extended from ${prevTotal} to ${totalDays} days.`);
  showNotification(`Great! Simulation extended to ${totalDays} days.`);
  runningYear = true;
  pendingWeeklyNews = pendingWeeklyNews || generateWeeklyNews();
  if (daysAppliedInWeek > 0 && daysAppliedInWeek < 7){
    startWeekTimer(pendingWeeklyNews);
  } else {
    runNextWeek();
  }
});

endStopBtn.addEventListener('click', ()=>{
  endYearOverlay.querySelector('.modal').classList.remove('show');
  endYearOverlay.style.display = 'none';
  runningYear = false;
  clearWeekTimer();
  logEvent(`Simulation paused at day ${game.day}.`);
});

window._game = game;

function showLoadingThenIntro(){
  loadingOverlay.style.display = 'flex';
  setTimeout(()=>{
    loadingOverlay.style.display = 'none';
    introOverlay.style.display = 'flex';
    introOverlay.querySelector('.modal').classList.add('show');
  }, 900);
}

letsPlayBtn.addEventListener('click', ()=>{
  introOverlay.querySelector('.modal').classList.remove('show');
  introOverlay.style.display = 'none';
  initGame(true);
});

letterAck.addEventListener('click', hideLetter);

function bootApp(){
  document.getElementById('lbTabLocal')?.addEventListener('click', () => switchLbTab('local'));
  document.getElementById('lbTabGlobal')?.addEventListener('click', () => switchLbTab('global'));
  document.getElementById('shortCancel')?.addEventListener('click', () => {
    const o = document.getElementById('shortOverlay');
    if (!o) return;
    o.style.display = 'none';
    o.setAttribute('aria-hidden', 'true');
    o.querySelector('.modal')?.classList.remove('show');
  });
  document.getElementById('shortConfirm')?.addEventListener('click', confirmShortFromModal);
  initGame(false);
  showLoadingThenIntro();
  speedLabel.textContent = speedMultiplier + 'x';
  const newsPanelEl = document.getElementById('newsPanel');
  if (newsPanelEl) {
    newsPanelEl.textContent = '';
    const pill = document.createElement('div'); pill.className = 'pill'; pill.textContent = 'Ready';
    const msg = document.createElement('div'); msg.className = 'small muted'; msg.textContent = "Click a category tile to view that group's stocks. Press Start / Restart to begin or press Let's play.";
    newsPanelEl.append(pill, msg);
  }
  initNewFeatures();
  if (import.meta.env.DEV) {
    import('../devtools.js').then(m => m.attachDevTools({ game, queueRender, autoSave })).catch(()=>{});
  }
}

// ============================================================
// FLOATING PROFIT/LOSS ANIMATION
// ============================================================
function showFloat(x, y, text, color){
  const el = document.createElement('div');
  el.className = 'float-profit';
  el.style.cssText = `left:${x}px;top:${y}px;color:${color};`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 1500);
}

// ============================================================
// ECONOMIC INDICATORS BAR UPDATE
// ============================================================
function updateEcoBar(){
  const irEl = document.getElementById('ecoInterestRate');
  const infEl = document.getElementById('ecoInflation');
  const sentEl = document.getElementById('ecoSentiment');
  const marginItem = document.getElementById('ecoMarginItem');
  const loanDisplay = document.getElementById('ecoLoanDisplay');
  if (!irEl) return;   const ir = game.interestRate;
  irEl.textContent = ir.toFixed(1) + '%';
  irEl.className = 'eco-val ' + (ir > 6 ? 'eco-red' : ir < 4 ? 'eco-green' : 'eco-gold');
  const inf = game.inflation;
  infEl.textContent = inf.toFixed(1) + '%';
  infEl.className = 'eco-val ' + (inf > 4 ? 'eco-red' : inf < 2 ? 'eco-green' : 'eco-gold');
  const avgChange = game.stocks.length
    ? (game.stocks.reduce((a,s)=> a + (s.changePct||0), 0) / game.stocks.length)
    : 0;
  sentEl.textContent = avgChange > 0.01 ? 'Bullish 📈' : avgChange < -0.01 ? 'Bearish 📉' : 'Neutral';
  sentEl.className = 'eco-val ' + (avgChange > 0.01 ? 'eco-green' : avgChange < -0.01 ? 'eco-red' : 'eco-gold');
  if (game.loan > 0){
    marginItem.style.display = 'flex';
    loanDisplay.textContent = money(game.loan);
  } else {
    marginItem.style.display = 'none';
  }
}

// ============================================================
// MARGIN / LOAN PANEL (SIDEBAR)
// ============================================================
function updateMarginPanel(){
  const panel = document.getElementById('marginPanel');
  if (!panel) return;
  const portfolioVal = Object.keys(game.portfolio).reduce((acc,id)=>{
    const e = game.portfolio[id]; const s = game.stocks.find(x=>x.id===id);
    return acc + (s ? s.price * e.shares : 0);
  }, 0);
  const networth = round2(game.cash + portfolioVal);
  const maxLoan = Math.min(500000, round2(networth * 2));
  const dailyInterest = round2(game.loan * 0.005);
  const loanPct = maxLoan > 0 ? Math.min(100, (game.loan / maxLoan) * 100) : 0;

  if (game.loan > 0){
    panel.style.display = 'block';
    const lbEl = document.getElementById('loanBalance');
    const mlEl = document.getElementById('maxLoanDisplay');
    const diEl = document.getElementById('dailyInterestDisplay');
    const meterEl = document.getElementById('loanMeterBar');
    const warnEl = document.getElementById('marginCallBadge');
    if (lbEl) lbEl.textContent = money(game.loan);
    if (mlEl) mlEl.textContent = money(maxLoan);
    if (diEl) diEl.textContent = money(dailyInterest) + '/day';
    if (meterEl) meterEl.style.width = loanPct + '%';
    if (warnEl) warnEl.style.display = networth < game.loan ? 'block' : 'none';
  } else {
    panel.style.display = 'none';
  }
}

// ============================================================
// SHORT SELLING
// ============================================================
function openShortModal(stockId){
  const s = game.stocks.find(x=>x.id===stockId); if (!s) return;
  if (game.portfolio[stockId] && game.portfolio[stockId].shares > 0){
    showNotification('You own this stock — sell your position first before going short.', 3500); return;
  }
  const maxShares = game.cash > 0 ? Math.floor(game.cash / s.price) : 0;
  if (maxShares < 1){ showNotification('Not enough cash to open a short position.', 3500); return; }
  const overlay = document.getElementById('shortOverlay');
  if (!overlay) {
    // Fallback: reuse trade modal in short mode
    currentTradeMode = 'short'; currentTradeStock = s.id;
    tradeHeadline.textContent = `Short ${s.name}`;
    tradeInfo.textContent = `Price: ${money(s.price)} — Max short: ${maxShares} shares (collateral held)`;
    tradeShares.value = 1;
    updateTradeCost();
    tradeOverlay.style.display = 'flex';
    tradeOverlay.querySelector('.modal').classList.add('show');
    tradeShares.focus();
    return;
  }
  document.getElementById('shortHeadline').textContent = `Short ${s.name}`;
  document.getElementById('shortInfo').textContent =
    `Price: ${money(s.price)} — You can short up to ${maxShares} shares (collateral held from cash).`;
  const sharesInput = document.getElementById('shortShares');
  sharesInput.value = 1;
  sharesInput.max = maxShares;
  const updateCost = () => {
    const shares = Math.max(0, Math.floor(Number(sharesInput.value) || 0));
    document.getElementById('shortCost').textContent = `Collateral: ${money(round2(shares * s.price))}`;
  };
  sharesInput.oninput = updateCost;
  updateCost();
  overlay.dataset.stockId = s.id;
  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden', 'false');
  overlay.querySelector('.modal').classList.add('show');
  sharesInput.focus();
}

function confirmShortFromModal(){
  const overlay = document.getElementById('shortOverlay');
  if (!overlay) return;
  const stockId = overlay.dataset.stockId;
  const s = game.stocks.find(x=>x.id===stockId); if (!s) return;
  const shares = Math.max(0, Math.floor(Number(document.getElementById('shortShares').value)||0));
  const maxShares = game.cash > 0 ? Math.floor(game.cash / s.price) : 0;
  if (!shares || shares < 1){ return; }
  if (shares > maxShares){ showNotification('Not enough cash for that short.', 3000); return; }
  const collateral = round2(shares * s.price);
  game.cash = round2(game.cash - collateral);
  game.shorts[stockId] = { shares, entryPrice: s.price };
  logEvent(`Opened short: ${shares}× ${s.name} @ ${money(s.price)}. Collateral held: ${money(collateral)}.`);
  showNotification(`📉 Short opened: ${shares}× ${s.name} @ ${money(s.price)}`, 3000);
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.querySelector('.modal').classList.remove('show');
  queueRender(); autoSave();
}

function coverShort(stockId){
  const pos = game.shorts[stockId]; if (!pos) return;
  const s = game.stocks.find(x=>x.id===stockId); if (!s) return;
  const collateral = round2(pos.shares * pos.entryPrice);
  const current = round2(pos.shares * s.price);
  const pnl = round2(collateral - current);   // profit when price fell
  game.cash = round2(game.cash + collateral + pnl);
  delete game.shorts[stockId];
  if (pnl < 0) game.totalProfit += pnl;
  logEvent(`Covered short: ${pos.shares}× ${s.name}. P&L: ${pnl >= 0 ? '+' : ''}${money(pnl)}`);
  showNotification(`${pnl >= 0 ? '📈 Short profit' : '📉 Short loss'}: ${pnl >= 0 ? '+' : ''}${money(pnl)}`, 3500);
  const el = document.getElementById('networth');
  if (el){ const r = el.getBoundingClientRect(); showFloat(r.left + 20, r.top - 10, `${pnl >= 0 ? '+' : ''}${money(pnl)}`, pnl >= 0 ? '#00ff88' : '#ff6b6b'); }
  queueRender(); autoSave();
}

// ============================================================
// BATCH SELL
// ============================================================
function batchSell(stockId, fraction){
  const pos = game.portfolio[stockId]; if (!pos || pos.shares < 1) return;
  const s = game.stocks.find(x=>x.id===stockId); if (!s) return;
  const sharesToSell = fraction >= 1 ? pos.shares : Math.max(1, Math.floor(pos.shares * fraction));
  const proceeds = round2(sharesToSell * s.price);
  const cost = round2(sharesToSell * pos.avgPrice);
  const profit = round2(proceeds - cost);
  game.cash = round2(game.cash + proceeds);
  game.totalProfit += profit;
  game.totalTrades++;
  game.lastSaleProfitPct = pos.avgPrice > 0 ? (s.price - pos.avgPrice) / pos.avgPrice : 0;
  pos.shares -= sharesToSell;
  if (pos.shares <= 0) delete game.portfolio[stockId];
  logEvent(`Sold ${sharesToSell}× ${s.name} @ ${money(s.price)}. Proceeds: ${money(proceeds)}. P&L: ${profit >= 0 ? '+' : ''}${money(profit)}`);
  showNotification(`${profit >= 0 ? '💰' : '📉'} Sold ${sharesToSell}× ${s.name} for ${money(proceeds)}`, 3000);
  const cashEl2 = document.getElementById('cash');
  if (cashEl2){ const r = cashEl2.getBoundingClientRect(); showFloat(r.left + 20, r.top - 20, `${profit >= 0 ? '+' : ''}${money(profit)}`, profit >= 0 ? '#00ff88' : '#ff6b6b'); }
  queueRender(); autoSave(); checkAchievements();
}

// ============================================================
// GLOSSARY
// ============================================================
const GLOSSARY_TERMS = [
  { term:'Stock (Share)', def:'A unit of ownership in a company. When you buy a share, you own a small piece of that business and can profit if its value rises.' },
  { term:'Portfolio', def:'Your total collection of investments — all the stocks you currently own, plus your uninvested cash.' },
  { term:'Dividend', def:'A payment companies make to shareholders from profits. Finance, Energy, and Retail stocks in this game pay dividends every 7 days.' },
  { term:'Short Selling', def:'Betting that a stock will go down. You borrow shares, sell them, and buy them back later at a lower price to profit from the fall.' },
  { term:'Margin / Leverage', def:'Borrowing money to invest more than you actually have. Amplifies both gains and losses. A loan fee is charged daily.' },
  { term:'Margin Call', def:'When your net worth falls below your outstanding loan, the broker forces you to sell assets to repay the debt immediately.' },
  { term:'Bull Market', def:'A period when stock prices are rising and investor confidence is high. Good time to hold stocks.' },
  { term:'Bear Market', def:'A period of falling stock prices, often by 20% or more. Experienced traders may short stocks during this period.' },
  { term:'Volatility', def:'How much a stock\'s price moves up and down. High-volatility stocks (Biotech, Tech) can bring big profits or big losses.' },
  { term:'Sector', def:'A category of businesses that do similar things — e.g. Tech, Energy, Finance. News events often affect entire sectors at once.' },
  { term:'Interest Rate', def:'The rate set by central banks. High rates make borrowing expensive and can hurt Tech/Biotech while helping Finance stocks.' },
  { term:'Inflation', def:'The rate at which prices rise. High inflation hurts Retail and Transport stocks but can benefit Energy companies.' },
  { term:'Net Worth', def:'Your total wealth: cash + current value of all stock holdings. The main measure of your progress in this game.' },
  { term:'Buy & Hold', def:'Buying stocks and keeping them for a long time, ignoring short-term price swings. Works well for stable, dividend-paying stocks.' },
  { term:'P&L (Profit & Loss)', def:'The difference between what you paid for something and what it\'s worth (or sold for) now. Positive = profit; negative = loss.' },
  { term:'Market Sentiment', def:'The overall mood of investors — Bullish (optimistic) or Bearish (pessimistic). Shown in the economic bar at the top.' },
  { term:'IPO', def:'Initial Public Offering — when a company first sells shares to the public. Often comes with high volatility early on.' },
  { term:'Diversification', def:'Spreading investments across different sectors so a bad event in one area doesn\'t wipe out your whole portfolio.' },
  { term:'Averaging Down', def:'Buying more shares when the price has dropped to lower your average price per share. Risky if the stock keeps falling.' },
  { term:'Take Profit / Stop Loss', def:'Setting a target price to automatically sell — either to lock in gains (take profit) or limit losses (stop loss).' },
];

function renderGlossary(){
  const grid = document.getElementById('glossaryGrid'); if (!grid) return;
  grid.innerHTML = GLOSSARY_TERMS.map(t=>`
    <div class="glossary-term">
      <div class="term">${t.term}</div>
      <div class="def">${t.def}</div>
    </div>`).join('');
}

// ============================================================
// CHART HOVER TOOLTIP
// ============================================================
let chartStockId = null;
function attachChartTooltip(){
  const canvas = document.getElementById('chartCanvas'); if (!canvas) return;
  const wrap = canvas.parentElement;
  let tip = document.getElementById('chartTooltipEl');
  if (!tip){
    tip = document.createElement('div'); tip.id = 'chartTooltipEl'; tip.className = 'chart-tooltip';
    wrap.style.position = 'relative'; wrap.appendChild(tip);
  }
  canvas.addEventListener('mousemove', (e)=>{
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const mode = document.getElementById('chartMode') ? document.getElementById('chartMode').value : 'stock';
    let series = [];
    if (mode === 'networth'){ series = game.history.map(h=>h.networth); }
    else if (chartStockId){ const s = game.stocks.find(x=>x.id===chartStockId); if (s) series = s.history.slice(); }
    if (!series.length){ tip.style.display='none'; return; }
    const pad = { l:50, r:12 }; const plotW = rect.width - pad.l - pad.r;
    const idx = Math.min(Math.max(0, Math.round(((mx - pad.l) / plotW) * (series.length - 1))), series.length - 1);
    const val = series[idx];
    tip.textContent = `Day ${idx+1}: ${money(round2(val))}`;
    tip.style.display = 'block';
    tip.style.left = Math.min(mx + 12, rect.width - 140) + 'px';
    tip.style.top = '12px';
  });
  canvas.addEventListener('mouseleave', ()=>{ tip.style.display='none'; });
}

// ============================================================
// LOAN / MARGIN MODAL LOGIC
// ============================================================
function openLoanModal(){
  const portfolioVal = Object.keys(game.portfolio).reduce((acc,id)=>{
    const e = game.portfolio[id]; const s = game.stocks.find(x=>x.id===id);
    return acc + (s ? s.price * e.shares : 0);
  }, 0);
  const networth = round2(game.cash + portfolioVal);
  const maxLoan = Math.min(500000, round2(networth * 2));
  const available = Math.max(0, maxLoan - game.loan);
  const dailyInterest = round2(game.loan * 0.005);
  const cur = document.getElementById('loanModalCurrent');
  const nw  = document.getElementById('loanModalNetworth');
  const mx  = document.getElementById('loanModalMax');
  const di  = document.getElementById('loanModalInterest');
  if (cur) cur.textContent = money(game.loan);
  if (nw)  nw.textContent  = money(networth);
  if (mx)  mx.textContent  = money(available);
  if (di)  di.textContent  = money(dailyInterest) + '/day';
  const amtInput = document.getElementById('loanAmount');
  if (amtInput) amtInput.value = Math.min(10000, available);
  const overlay = document.getElementById('loanOverlay');
  overlay.style.display = 'flex'; overlay.querySelector('.modal').classList.add('show');
}

document.getElementById('loanBorrow').addEventListener('click', ()=>{
  const amount = parseFloat(document.getElementById('loanAmount').value) || 0;
  if (amount < 1000){ alert('Minimum loan is $1,000.'); return; }
  const portfolioVal = Object.keys(game.portfolio).reduce((acc,id)=>{
    const e = game.portfolio[id]; const s = game.stocks.find(x=>x.id===id);
    return acc + (s ? s.price * e.shares : 0);
  }, 0);
  const networth = round2(game.cash + portfolioVal);
  const maxLoan = Math.min(500000, round2(networth * 2));
  const available = Math.max(0, maxLoan - game.loan);
  if (amount > available){ alert(`You can only borrow up to ${money(available)}.`); return; }
  game.loan = round2(game.loan + amount);
  game.cash = round2(game.cash + amount);
  logEvent(`Borrowed ${money(amount)}. Total loan: ${money(game.loan)}. Daily interest: ${money(round2(game.loan * 0.005))}.`);
  showNotification(`💳 Borrowed ${money(amount)}. Daily interest: ${money(round2(game.loan * 0.005))}`, 4000);
  const overlay = document.getElementById('loanOverlay');
  overlay.querySelector('.modal').classList.remove('show'); overlay.style.display = 'none';
  queueRender(); updateMarginPanel(); updateEcoBar(); autoSave();
});

document.getElementById('loanRepay').addEventListener('click', ()=>{
  if (game.loan <= 0){ alert('No outstanding loan.'); return; }
  const amount = Math.min(parseFloat(document.getElementById('loanAmount').value) || 0, game.loan);
  if (amount < 1){ alert('Enter a repayment amount.'); return; }
  if (game.cash < amount){ alert('Not enough cash to repay that amount.'); return; }
  game.loan = round2(game.loan - amount);
  game.cash = round2(game.cash - amount);
  logEvent(`Repaid ${money(amount)}. Remaining loan: ${money(game.loan)}.`);
  showNotification(`✅ Repaid ${money(amount)}. Remaining: ${money(game.loan)}`, 3000);
  const overlay = document.getElementById('loanOverlay');
  overlay.querySelector('.modal').classList.remove('show'); overlay.style.display = 'none';
  queueRender(); updateMarginPanel(); updateEcoBar(); autoSave();
});

document.getElementById('loanCancel').addEventListener('click', ()=>{
  const overlay = document.getElementById('loanOverlay');
  overlay.querySelector('.modal').classList.remove('show'); overlay.style.display = 'none';
});

// ============================================================
// THEME TOGGLE
// ============================================================
function applyTheme(light){
  document.body.classList.toggle('light-mode', light);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = light ? '☀️' : '🌙';
  try { localStorage.setItem('mms_theme', light ? 'light' : 'dark'); } catch(e){}
}

document.getElementById('themeToggleBtn').addEventListener('click', ()=>{
  applyTheme(!document.body.classList.contains('light-mode'));
});

// ============================================================
// EXPORT / IMPORT SAVE
// ============================================================
document.getElementById('exportSaveBtn').addEventListener('click', ()=>{
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw){ alert('No saved game to export.'); return; }
    const blob = new Blob([raw], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'minimarket-save.json'; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1000);
  } catch(er){ alert('Export failed.'); }
});

document.getElementById('importSaveBtn').addEventListener('click', ()=>{
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = (e)=>{
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev)=>{
      try {
        JSON.parse(ev.target.result); // validate JSON
        localStorage.setItem(STORAGE_KEY, ev.target.result);
        alert('Save imported! The page will reload to apply it.');
        location.reload();
      } catch(er){ alert('Invalid save file. Please use a file exported from this game.'); }
    };
    reader.readAsText(file);
  };
  input.click();
});

// ============================================================
// GLOSSARY & SHORTCUTS MODAL OPEN/CLOSE
// ============================================================
document.getElementById('glossaryBtn').addEventListener('click', ()=>{
  renderGlossary();
  const o = document.getElementById('glossaryOverlay');
  o.style.display = 'flex'; o.querySelector('.modal').classList.add('show');
});
document.getElementById('glossaryClose').addEventListener('click', ()=>{
  const o = document.getElementById('glossaryOverlay');
  o.querySelector('.modal').classList.remove('show'); o.style.display = 'none';
});

document.getElementById('shortcutsBtn').addEventListener('click', ()=>{
  const o = document.getElementById('shortcutsOverlay');
  o.style.display = 'flex'; o.querySelector('.modal').classList.add('show');
});
document.getElementById('shortcutsClose').addEventListener('click', ()=>{
  const o = document.getElementById('shortcutsOverlay');
  o.querySelector('.modal').classList.remove('show'); o.style.display = 'none';
});

document.getElementById('loanBtn').addEventListener('click', openLoanModal);

// ============================================================
// SEARCH + SORTABLE TABLE EVENT WIRING
// ============================================================
function wireSearchSort(){
  const searchEl = document.getElementById('stockSearch');
  if (searchEl){
    searchEl.addEventListener('input', (e)=>{
      searchQuery = e.target.value.trim();
      renderStocksForCategory();
    });
  }
  document.querySelectorAll('#stocksTable th.sortable').forEach(th=>{
    th.addEventListener('click', ()=>{
      const col = th.dataset.col;
      if (sortCol === col){ sortDir *= -1; }
      else { sortCol = col; sortDir = 1; }
      renderStocksForCategory();
    });
  });
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', (e)=>{
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toUpperCase();
  // Close any open overlay with Escape
  if (e.key === 'Escape'){
    document.querySelectorAll('.modal-overlay').forEach(o=>{
      if (o.style.display !== 'none'){ o.querySelector('.modal')?.classList.remove('show','pos','neg'); o.style.display='none'; }
    });
    return;
  }
  if (!runningYear && key !== 'P') return; // only pause works before game starts
  switch(key){
    case 'P': pauseResumeBtn?.click(); break;
    case '1': if(speedBtn){ speedMultiplier=1; speedLabel.textContent='1x'; clearWeekTimer(); if(runningYear&&!paused) startWeekTimer(pendingWeeklyNews); } break;
    case '2': if(speedBtn){ speedMultiplier=2; speedLabel.textContent='2x'; clearWeekTimer(); if(runningYear&&!paused) startWeekTimer(pendingWeeklyNews); } break;
    case '3': if(speedBtn){ speedMultiplier=4; speedLabel.textContent='4x'; clearWeekTimer(); if(runningYear&&!paused) startWeekTimer(pendingWeeklyNews); } break;
    case 'G':
      document.getElementById('glossaryBtn')?.click(); break;
    case 'C':
      document.getElementById('marketChartBtn')?.click(); break;
    case 'M':
      openLoanModal(); break;
    case 'T':
      applyTheme(!document.body.classList.contains('light-mode')); break;
    case 'B':{
      // Quick-buy first stock in current category
      const visible = game.stocks.filter(s=> s.sector === selectedCategory);
      if (visible.length) openTradeModal('buy', visible[0].id);
      break;
    }
    case 'S':{
      // Quick-sell most-held stock (by value)
      const ids = Object.keys(game.portfolio);
      if (!ids.length) break;
      const best = ids.reduce((a,b)=>{
        const va = (game.portfolio[a].shares||0) * ((game.stocks.find(x=>x.id===a)||{price:0}).price);
        const vb = (game.portfolio[b].shares||0) * ((game.stocks.find(x=>x.id===b)||{price:0}).price);
        return va >= vb ? a : b;
      });
      openTradeModal('sell', best); break;
    }
  }
});

// ============================================================
// SOUND SYSTEM (Web Audio API)
// ============================================================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let _audioCtx = null;
let _soundEnabled = true;
try { _soundEnabled = localStorage.getItem('mms_sound') !== 'false'; } catch(e){}

function _getAudioCtx(){
  if (!_audioCtx){ try { _audioCtx = new AudioCtx(); } catch(e){ return null; } }
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(()=>{});
  return _audioCtx;
}

function _playTone(freq, type, duration, gainVal, startDelay=0){
  if (!_soundEnabled) return;
  try {
    const ctx = _getAudioCtx(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    const t = ctx.currentTime + startDelay;
    gain.gain.setValueAtTime(gainVal, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t); osc.stop(t + duration + 0.01);
  } catch(e){}
}

function playBuySound(){
  _playTone(440,'sine',0.08,0.18,0);
  _playTone(550,'sine',0.08,0.18,0.07);
}
function playSellProfitSound(){
  _playTone(523,'sine',0.10,0.2,0);
  _playTone(659,'sine',0.10,0.2,0.08);
  _playTone(784,'sine',0.14,0.2,0.16);
}
function playSellLossSound(){
  _playTone(330,'sawtooth',0.12,0.2,0);
  _playTone(262,'sawtooth',0.16,0.15,0.10);
}
function playAchievementSound(){
  [880,1108,1320].forEach((f,i)=> _playTone(f,'sine',0.14,0.22,i*0.08));
}
function playLevelUpSound(){
  [523,659,784,1047].forEach((f,i)=> _playTone(f,'sine',0.18,0.25,i*0.09));
}
function playCrashSound(){
  [200,150,100].forEach((f,i)=> _playTone(f,'sawtooth',0.22,0.35,i*0.11));
}
function playSubmitSound(){
  [440,554,659,880].forEach((f,i)=> _playTone(f,'sine',0.16,0.28,i*0.10));
}

function _updateMuteBtn(){
  const btn = document.getElementById('soundToggleBtn');
  if (!btn) return;
  btn.textContent = _soundEnabled ? '🔊' : '🔇';
  btn.classList.toggle('muted', !_soundEnabled);
  btn.title = _soundEnabled ? 'Mute Sound' : 'Unmute Sound';
}

// ============================================================
// CONFETTI ANIMATION
// ============================================================
function showConfetti(duration=3000){
  const colors = ['#00d4ff','#00ff88','#ffa500','#ff6b9d','#a78bfa','#ffb020','#ffffff'];
  const count = 70;
  for (let i=0; i<count; i++){
    setTimeout(()=>{
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      const size = 6 + Math.random() * 9;
      const startX = Math.random() * 100;
      const fallDur = 1.8 + Math.random() * 1.8;
      el.style.cssText = `left:${startX}vw;top:-14px;width:${size}px;height:${size * (Math.random()>0.5 ? 1 : 2.5)}px;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${fallDur}s;`;
      document.body.appendChild(el);
      setTimeout(()=> el.remove(), (fallDur + 0.5) * 1000);
    }, Math.random() * Math.min(duration * 0.55, 1200));
  }
}

// ============================================================
// INIT NEW FEATURES AFTER DOMContentLoaded
// ============================================================
function initNewFeatures(){
  wireSearchSort();
  attachChartTooltip();
  // Restore theme preference
  try {
    const t = localStorage.getItem('mms_theme');
    if (t === 'light') applyTheme(true);
  } catch(e){}
  updateEcoBar();
  // Wire mute button
  _updateMuteBtn();
  const soundBtn = document.getElementById('soundToggleBtn');
  if (soundBtn){
    soundBtn.addEventListener('click', ()=>{
      _soundEnabled = !_soundEnabled;
      try { localStorage.setItem('mms_sound', _soundEnabled ? 'true' : 'false'); } catch(e){}
      _updateMuteBtn();
    });
  }
  // Close submit score overlay on backdrop click
  document.getElementById('submitScoreOverlay').addEventListener('click', (e)=>{
    if (e.target === document.getElementById('submitScoreOverlay')){
      document.getElementById('submitScoreOverlay').style.display = 'none';
      document.getElementById('submitScoreOverlay').querySelector('.modal').classList.remove('show');
    }
  });
}

// ============================================================
// PATCH autoSave + loadSaved TO PERSIST NEW FIELDS
// ============================================================


export { bootApp, openTradeModal, batchSell, coverShort, openShortModal };

// Bind helpers used by dynamically created buttons
window.openTradeModal = openTradeModal;
window.batchSell = batchSell;
window.coverShort = coverShort;
window.openShortModal = openShortModal;
window.switchLbTab = switchLbTab;
