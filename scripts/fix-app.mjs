import fs from 'fs';

let src = fs.readFileSync('src/game/app.js', 'utf8');

// Remove duplicate data block between imports and `let game =`
const markerStart = '\nconst CATEGORIES = [';
const markerEnd = 'let game = {';
const i0 = src.indexOf(markerStart);
const i1 = src.indexOf(markerEnd);
if (i0 < 0 || i1 < 0 || i1 <= i0) {
  console.error('Could not find duplicate block', i0, i1);
  process.exit(1);
}
src = src.slice(0, i0) + '\n\nlet totalDays = INITIAL_TOTAL_DAYS;\nlet totalWeeks = Math.ceil(totalDays / 7);\n\n' + src.slice(i1);

// Fix game object fields
src = src.replace(
  /leaderboardPromptShown: false,\n\};/,
  `leaderboardPromptShown: false,
  luckyGainDays: 0,
  pendingComeback: false,
  comebackReady: false,
  yearPromptShown: false,
};`
);

// Fix duplicate lastNotifTime if still present after header
src = src.replace(
  /let _globalPlayerName = null;\nlet lastNotifTime = 0;\nlet notifQueue = \[\];\n\nlet totalDays/,
  `let _globalPlayerName = null;\nlet lastNotifTime = 0;\nlet notifQueue = [];\n\nlet totalDays`
);

// checkAchievements
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

// hold_week is in imported DAILY_QUESTS - good once duplicates removed

// initGame totalDays
src = src.replace(/totalDays = 10000;/, 'totalDays = INITIAL_TOTAL_DAYS;');

// Ensure initGame resets new fields
if (!src.includes('game.yearPromptShown = false;')) {
  src = src.replace(
    /game\.leaderboardPromptShown = false;\n  pendingWeeklyNews = null;/,
    `game.leaderboardPromptShown = false;
  game.achievements = {}; game.completedQuests = {}; game.totalTrades = 0; game.bestDayProfit = 0;
  game.totalProfit = 0; game.shorts = {}; game.loan = 0; game.interestRate = 3.5; game.inflation = 2.1;
  game.totalDividendsEarned = 0; game.luckyGainDays = 0; game.pendingComeback = false; game.comebackReady = false; game.yearPromptShown = false;
  pendingWeeklyNews = null;`
  );
}

// unrealised top in updateProgress
if (!src.includes('unrealisedTop')) {
  src = src.replace(
    /marketStateEl\.textContent = game\.marketState;/,
    `marketStateEl.textContent = game.marketState;
  const unrealEl = document.getElementById('unrealisedTop');
  if (unrealEl) {
    const unreal = Object.keys(game.portfolio).reduce((acc,id)=>{ const e=game.portfolio[id]; const s=game.stocks.find(x=>x.id===id); return acc + (s ? (s.price - e.avgPrice) * e.shares : 0); }, 0);
    unrealEl.textContent = money(round2(unreal));
    unrealEl.className = unreal >= 0 ? 'profit-pos' : 'profit-neg';
  }`
  );
}

// year prompt in applySingleDay
if (!src.includes('yearPromptShown')) {
  src = src.replace(
    /triggerSpecialEvent\(\);\n  checkAndCompleteQuests\(\);\n  game\.lastDaySharesBought = 0;\n  \n  queueRender\(\);/,
    `if (dayProfit <= -1000) game.pendingComeback = true;
  if (game.pendingComeback && dayProfit >= 1000) { game.comebackReady = true; game.pendingComeback = false; }
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
}

// Fix openShortModal if still using prompt
if (src.includes('parseInt(prompt(`Short')) {
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
  [1,5,10,maxShares].filter((v,i,a)=>a.indexOf(v)===i).forEach(v => {
    const b = document.createElement('button'); b.className = 'buyq'; b.textContent = v === maxShares ? 'Max' : '+'+v;
    b.onclick = () => { tradeShares.value = Math.min(maxShares, v); updateTradeCost(); const col = document.getElementById('shortCollateral'); if (col) col.textContent = money(round2(Number(tradeShares.value)*s.price)); };
    tradeQuickButtons.appendChild(b);
  });
  tradeOverlay.style.display = 'flex'; tradeOverlay.querySelector('.modal').classList.add('show');
  tradeShares.focus();
}`
  );
}

// Ensure tradeConfirm handles short - check if already patched
if (!src.includes("currentTradeMode === 'short'")) {
  console.warn('tradeConfirm short mode not patched — manual check needed');
}

// autoSave clean
src = src.replace(
  /function autoSave\(\)\{ try \{ const save = \{ v:6[\s\S]*?localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(save\)\); \} catch\(e\)\{\} \}/,
  `function autoSave(){
  try {
    saveGameToStorage(game, { currentWeek, totalWeeks, totalDays, pendingWeeklyNews });
  } catch(e){}
}`
);

// loadSaved clean if still old
if (src.includes("alert('No saved data')") && src.includes('const byId = {}')) {
  src = src.replace(
    /function loadSaved\(\)\{ const raw = localStorage\.getItem\(STORAGE_KEY\);[\s\S]*?alert\('Failed to load'\); \} \}/,
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
}

// XSS local leaderboard
if (src.includes('${item.name}</span><span class="lb-score">')) {
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
    const meta = document.createElement('span'); meta.className = 'lb-meta'; meta.textContent = 'Day '+(item.day||'?')+' · Lv'+(item.level||'?');
    div.append(rank, name, score, meta);
    el.appendChild(div);
  });
}`
  );
}

// bootApp
if (!src.includes('function bootApp')) {
  src = src.replace(
    /document\.addEventListener\('DOMContentLoaded', \(\)=>\{[\s\S]*?\}\);/,
    `function bootApp(){
  document.getElementById('lbTabLocal')?.addEventListener('click', () => switchLbTab('local'));
  document.getElementById('lbTabGlobal')?.addEventListener('click', () => switchLbTab('global'));
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
}`
  );
}

// Remove monkey patches at end
src = src.replace(/\/\/ =+\n\/\/ PATCH autoSave[\s\S]*$/, '');
src = src.replace(/\(function patchSaveLoad\(\)\{[\s\S]*$/, '');

// Ensure exports
if (!src.includes('export { bootApp')) {
  src += `

export { bootApp, openTradeModal, batchSell, coverShort, openShortModal };
window.openTradeModal = openTradeModal;
window.batchSell = batchSell;
window.coverShort = coverShort;
window.openShortModal = openShortModal;
window.switchLbTab = switchLbTab;
`;
}

// Fix isSupabaseConfigured usage
src = src.replace(
  /if \(SUPABASE_URL === 'YOUR_SUPABASE_URL' \|\| SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY'\)\{/,
  'if (!isSupabaseConfigured()){'
);

// Sync _globalPlayerName when submitting
src = src.replace(
  /_globalPlayerName = cleanName;/,
  `_globalPlayerName = cleanName;`
);

fs.writeFileSync('src/game/app.js', src);
console.log('Fixed app.js', src.length);

// syntax check via dynamic import won't work for browser modules with import.meta
// use acorn-free: strip imports and check — or just vite build
