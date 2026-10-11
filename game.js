(() => {
  'use strict';

  const SAVE_KEY = 'qingqi_v2';
  const SAVE_KEY_V1 = 'qingqi_v1';
  const SETTINGS_KEY = 'qingqi_settings_v1';
  const COLS = 6;
  const ROWS = 7;
  const TILE = 52;
  const PLOT_COLS = 6;
  const HOUSE_CELLS = new Set(['1,1', '2,1']);
  const SEASON_CAPTIONS = {
    farm: ['春光滿田', '夏日茂盛', '秋獲將至', '冬雪守田'],
    village: ['春光滿村', '夏日邨景', '秋色入村', '冬雪覆簷'],
    mine: ['礦洞微涼', '礦脈活躍', '岩層穩固', '洞內靜謐'],
    pond: ['塘面春波', '夏日魚躍', '秋水清澈', '冬塘微凍'],
  };
  const SCENE_ART = {
    village: { webp: 'assets/bg_village.webp', jpg: 'assets/bg_village.jpg', alt: '青畦村落' },
    farm: { webp: 'assets/bg_village.webp', jpg: 'assets/bg_village.jpg', alt: '田畦外景' },
    mine: { webp: 'assets/bg_mine.webp', jpg: 'assets/bg_mine.jpg', alt: '礦洞' },
    pond: { webp: 'assets/bg_pond.webp', jpg: 'assets/bg_pond.jpg', alt: '魚塘' },
  };

  const SEASONS = ['春', '夏', '秋', '冬'];
  const CROPS = {
    rice:   { name: '稻', grow: 5, waterNeed: true, sell: 8, food: 6, seedCost: 3, color: '#8bc34a', ripe: '#fdd835' },
    veg:    { name: '菜', grow: 4, waterNeed: true, sell: 10, food: 3, seedCost: 4, color: '#66bb6a', ripe: '#43a047' },
    flower: { name: '花', grow: 3, waterNeed: false, sell: 14, food: 0, seedCost: 5, color: '#ec407a', ripe: '#f48fb1' },
    wheat:  { name: '麥', grow: 4, waterNeed: false, sell: 7, food: 5, seedCost: 3, color: '#dce775', ripe: '#fbc02d' },
  };

  const ORE = {
    ore: { name: '礦石', sell: 6 },
    goldOre: { name: '金礦', sell: 22 },
  };
  const FISH = {
    fish: { name: '普通魚', sell: 5 },
    rareFish: { name: '珍稀大魚', sell: 35 },
  };

  const DIRS = {
    grain:  { label: '多種糧', prefer: ['rice', 'wheat'], sellFoodKeep: 20, expandBias: 0.2 },
    money:  { label: '多賺錢', prefer: ['flower', 'veg'], sellFoodKeep: 8, expandBias: 0.35 },
    expand: { label: '擴田優先', prefer: ['flower', 'veg'], sellFoodKeep: 10, expandBias: 0.95 },
    winter: { label: '存糧過冬', prefer: ['wheat', 'rice'], sellFoodKeep: 40, expandBias: 0.1 },
  };

  const QUEST_DEFS = [
    {
      id: 'harvest_rice',
      title: '稻米初成',
      desc: '收成稻米 5 次',
      target: 5,
      reward: 30,
      track: 'riceHarvested',
    },
    {
      id: 'mine_ore',
      title: '礦洞初探',
      desc: '成功開挖 8 次',
      target: 8,
      reward: 40,
      track: 'minesDone',
    },
    {
      id: 'catch_rare',
      title: '釣上大魚',
      desc: '釣到珍稀大魚 1 條',
      target: 1,
      reward: 60,
      track: 'rareCaught',
    },
  ];

  const canvas = document.getElementById('farm');
  const ctx = canvas.getContext('2d');

  let state = null;
  let settings = loadSettings();
  let selectedCrop = 'rice';
  let selectedPlot = null;
  let lastTs = 0;
  let running = false;
  let toastTimer = 0;
  let hintTimer = 0;
  let dayAcc = 0;
  let autoAcc = 0;
  let mineCd = 0;
  let fishCd = 0;
  let stamRegenAcc = 0;

  function loadSettings() {
    try {
      return Object.assign({
        provider: 'none',
        model: 'deepseek-chat',
        apiKey: '',
      }, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
    } catch { return { provider: 'none', model: 'deepseek-chat', apiKey: '' }; }
  }
  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function defaultQuests() {
    return QUEST_DEFS.map(q => ({
      id: q.id,
      progress: 0,
      claimed: false,
    }));
  }

  function defaultState() {
    const plots = [];
    const unlocked = [
      [1, 3], [2, 3], [3, 3],
      [1, 4], [2, 4], [3, 4],
      [1, 5], [2, 5],
    ];
    const unlockSet = new Set(unlocked.map(([x, y]) => x + ',' + y));
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const key = x + ',' + y;
        let kind = 'grass';
        if (y === 0) kind = 'tree';
        else if (x === 0 && y >= 2) kind = 'water';
        else if (x === 0 && y === 1) kind = 'wheel';
        else if (HOUSE_CELLS.has(key)) kind = 'house';
        else if (y === 2 && x >= 1) kind = 'path';
        else if (unlockSet.has(key)) kind = 'soil';
        else if (y >= 3 && x >= 1) kind = 'locked';

        plots.push({
          x, y, kind,
          crop: null,
          stage: 0,
          progress: 0,
          watered: false,
          wilt: 0,
        });
      }
    }
    return {
      day: 1,
      seasonIdx: 0,
      gold: 80,
      food: 12,
      stamina: 100,
      maxStamina: 100,
      auto: false,
      mode: 'farm',
      directive: 'grain',
      inventory: {
        rice: 0, veg: 0, flower: 0, wheat: 0,
        ore: 0, goldOre: 0, fish: 0, rareFish: 0,
        pickaxe: 1, rod: 1,
      },
      plots,
      expandCost: 45,
      unlockedCount: unlocked.length,
      maxPlots: 18,
      eventCooldown: 8,
      daysSinceEvent: 0,
      log: [],
      stats: { riceHarvested: 0, minesDone: 0, rareCaught: 0, fishCaught: 0 },
      quests: defaultQuests(),
      achievements: {},
      version: 2,
    };
  }

  function migrateV1(raw) {
    const base = defaultState();
    const merged = Object.assign(base, raw, {
      version: 2,
      stamina: raw.stamina != null ? raw.stamina : 100,
      maxStamina: raw.maxStamina || 100,
      mode: raw.mode || 'farm',
      stats: Object.assign(base.stats, raw.stats || {}),
      quests: (raw.quests && raw.quests.length) ? raw.quests : defaultQuests(),
      achievements: raw.achievements || {},
      inventory: Object.assign({
        rice: 0, veg: 0, flower: 0, wheat: 0,
        ore: 0, goldOre: 0, fish: 0, rareFish: 0,
        pickaxe: 1, rod: 1,
      }, raw.inventory || {}),
    });
    // ensure quest entries for all defs
    const qmap = {};
    merged.quests.forEach(q => { qmap[q.id] = q; });
    merged.quests = QUEST_DEFS.map(d => qmap[d.id] || { id: d.id, progress: 0, claimed: false });
    return merged;
  }

  function save() {
    if (!state) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }
  function hasSave() {
    try {
      return !!(localStorage.getItem(SAVE_KEY) || localStorage.getItem(SAVE_KEY_V1));
    } catch { return false; }
  }
  function load() {
    try {
      let raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!raw) {
        const v1 = JSON.parse(localStorage.getItem(SAVE_KEY_V1) || 'null');
        if (v1 && v1.plots) {
          raw = migrateV1(v1);
          localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
        }
      }
      if (!raw || !raw.plots) return null;
      if ((raw.version || 1) < 2) raw = migrateV1(raw);
      // fill missing inventory keys
      raw.inventory = Object.assign({
        rice: 0, veg: 0, flower: 0, wheat: 0,
        ore: 0, goldOre: 0, fish: 0, rareFish: 0,
        pickaxe: 1, rod: 1,
      }, raw.inventory || {});
      raw.stats = Object.assign({ riceHarvested: 0, minesDone: 0, rareCaught: 0, fishCaught: 0 }, raw.stats || {});
      if (!raw.quests || !raw.quests.length) raw.quests = defaultQuests();
      if (raw.stamina == null) raw.stamina = 100;
      if (!raw.maxStamina) raw.maxStamina = 100;
      if (!raw.mode) raw.mode = 'farm';
      if (!raw.achievements) raw.achievements = {};
      raw.version = 2;
      return raw;
    } catch { return null; }
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  function showHint(msg) {
    const el = document.getElementById('scene-hint');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => el.classList.remove('show'), 1400);
  }

  function seasonName() { return SEASONS[state.seasonIdx % 4]; }
  function plotAt(x, y) { return state.plots.find(p => p.x === x && p.y === y); }

  function syncAutoButtons() {
    document.querySelectorAll('.auto-btn').forEach(b => {
      b.classList.toggle('on', state.auto);
    });
  }

  function updateQuestDot() {
    const claimable = state.quests.some(q => {
      const def = QUEST_DEFS.find(d => d.id === q.id);
      return def && !q.claimed && q.progress >= def.target;
    });
    document.getElementById('quest-dot').hidden = !claimable;
  }

  function bumpQuest(track, amount) {
    amount = amount || 1;
    state.stats[track] = (state.stats[track] || 0) + amount;
    for (const q of state.quests) {
      const def = QUEST_DEFS.find(d => d.id === q.id);
      if (!def || def.track !== track || q.claimed) continue;
      q.progress = Math.min(def.target, (q.progress || 0) + amount);
    }
    updateQuestDot();
  }

  function setMode(mode) {
    if (!['farm', 'village', 'mine', 'pond'].includes(mode)) return;
    state.mode = mode;
    document.querySelectorAll('.mode-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === mode);
    });
    const adv = document.getElementById('adventure-scene');
    adv.classList.toggle('mode-farm', mode === 'farm');

    const art = SCENE_ART[mode] || SCENE_ART.village;
    document.getElementById('scene-webp').srcset = art.webp;
    document.getElementById('scene-img').src = art.jpg;
    document.getElementById('scene-img').alt = art.alt;

    document.getElementById('plot-card').hidden = mode !== 'farm';
    document.getElementById('farm-panel').hidden = mode !== 'farm';
    document.getElementById('village-panel').hidden = mode !== 'village';
    document.getElementById('mine-panel').hidden = mode !== 'mine';
    document.getElementById('pond-panel').hidden = mode !== 'pond';

    const showPad = mode === 'mine' || mode === 'pond';
    document.getElementById('dpad').hidden = !showPad;
    document.getElementById('action-cluster').hidden = !showPad;

    const captions = SEASON_CAPTIONS[mode] || SEASON_CAPTIONS.village;
    const si = state.seasonIdx % 4;
    document.getElementById('scene-caption').textContent = captions[si];
    document.getElementById('season-tint').dataset.season = String(si);

    const status = document.getElementById('status-text');
    if (mode === 'farm') status.textContent = '點田操作，或開 AUTO';
    else if (mode === 'village') status.textContent = '村落閒逛 · 選去處';
    else if (mode === 'mine') status.textContent = '開挖採礦 · AUTO 可代勞';
    else status.textContent = '拋竿釣魚 · AUTO 可代勞';

    updateModeStats();
    updateHud();
    if (mode === 'farm') drawFarm();
    save();
  }

  function updateModeStats() {
    if (!state) return;
    const inv = state.inventory;
    document.getElementById('mine-ore-label').textContent = '礦石 ' + (inv.ore || 0);
    document.getElementById('mine-goldore-label').textContent = '金礦 ' + (inv.goldOre || 0);
    document.getElementById('mine-cd-label').textContent = mineCd > 0 ? ('冷卻 ' + mineCd.toFixed(1) + 's') : '就緒';
    document.getElementById('pond-fish-label').textContent = '魚 ' + (inv.fish || 0);
    document.getElementById('pond-rare-label').textContent = '珍魚 ' + (inv.rareFish || 0);
    document.getElementById('pond-cd-label').textContent = fishCd > 0 ? ('冷卻 ' + fishCd.toFixed(1) + 's') : '就緒';
  }

  function updateHud() {
    document.getElementById('hud-day').textContent = seasonName() + ' · 第' + state.day + '日';
    document.getElementById('hud-gold').textContent = '💰 ' + state.gold;
    document.getElementById('hud-food').textContent = '🌾 ' + state.food;
    document.getElementById('hud-stam').textContent = '⚡ ' + Math.floor(state.stamina);
    const al = document.getElementById('auto-label');
    const modeLabel = { farm: '種田', village: '村落', mine: '挖礦', pond: '釣魚' }[state.mode] || '';
    al.textContent = state.auto
      ? ('AUTO 開 · ' + (state.mode === 'farm' ? DIRS[state.directive].label : modeLabel))
      : 'AUTO 關';
    al.className = state.auto ? 'auto-on' : 'auto-off';
    syncAutoButtons();
    document.querySelectorAll('.dir').forEach(b => {
      b.classList.toggle('active', b.dataset.dir === state.directive);
    });
    document.getElementById('btn-expand').textContent = '擴田' + state.expandCost;
    const si = state.seasonIdx % 4;
    const tint = document.getElementById('season-tint');
    if (tint) tint.dataset.season = String(si);
    const captions = SEASON_CAPTIONS[state.mode] || SEASON_CAPTIONS.village;
    const cap = document.getElementById('scene-caption');
    if (cap) cap.textContent = captions[si];
    const soilN = state.plots.filter(p => p.kind === 'soil').length;
    const lockedN = state.plots.filter(p => p.kind === 'locked').length;
    const hint = document.getElementById('plot-hint');
    if (hint) hint.textContent = '已開 ' + soilN + ' 畦 · 可擴 ' + lockedN;
    updateModeStats();
    updateQuestDot();
  }

  // ---- Drawing ----
  function farmablePlots() {
    return state.plots
      .filter(p => p.kind === 'soil' || p.kind === 'locked')
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }

  function drawSoilCell(px, py, s, plot) {
    const pad = 3;
    const x = px + pad, y = py + pad, w = s - pad * 2, h = s - pad * 2;
    const r = 8;

    function roundRect(fill, stroke, lw) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
    }

    if (plot.kind === 'locked') {
      roundRect('rgba(165,214,167,0.72)', '#5d4037', 2);
      ctx.fillStyle = 'rgba(93,64,55,0.35)';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('鎖', px + s / 2, py + s / 2);
      return;
    }

    roundRect(plot.watered ? '#6d4c41' : '#8d6e63', '#4e342e', 2);
    ctx.fillStyle = 'rgba(62,39,35,0.35)';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + 6, y + 10 + i * 12, w - 12, 3);
    }
    if (plot.watered) {
      ctx.fillStyle = 'rgba(33,150,243,0.32)';
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    }

    if (plot.crop && plot.stage > 0) {
      const c = CROPS[plot.crop];
      const stage = plot.stage;
      const cx = px + s / 2;
      if (stage === 1) {
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(cx - 2, py + s * 0.55, 4, 10);
        ctx.fillStyle = '#aed581';
        ctx.beginPath();
        ctx.arc(cx, py + s * 0.52, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (stage === 2) {
        ctx.fillStyle = c.color;
        ctx.fillRect(cx - 5, py + s * 0.42, 10, 16);
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.ellipse(cx - 8, py + s * 0.45, 6, 4, -0.4, 0, Math.PI * 2);
        ctx.ellipse(cx + 8, py + s * 0.45, 6, 4, 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (stage === 3) {
        ctx.fillStyle = c.color;
        for (let i = -1; i <= 1; i++) {
          ctx.fillRect(cx + i * 12 - 4, py + s * 0.32, 8, 22);
        }
      } else {
        ctx.fillStyle = c.ripe;
        for (let i = -1; i <= 1; i++) {
          ctx.fillRect(cx + i * 12 - 5, py + s * 0.26, 10, 26);
        }
        ctx.fillStyle = '#fffde7';
        ctx.fillRect(cx - 10, py + s * 0.3, 3, 3);
        ctx.fillRect(cx + 8, py + s * 0.36, 3, 3);
      }
      ctx.fillStyle = '#212121';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(c.name, cx, py + s - 6);
    }

    if (selectedPlot && selectedPlot.x === plot.x && selectedPlot.y === plot.y) {
      roundRect(null, '#ffeb3b', 3);
    }
  }

  function drawFarm() {
    if (!state) return;
    const cells = farmablePlots();
    const cols = PLOT_COLS;
    const rows = Math.max(2, Math.ceil(cells.length / cols));
    const gap = 4;
    const pad = 8;
    const s = TILE;
    const w = pad * 2 + cols * s + (cols - 1) * gap;
    const h = pad * 2 + rows * s + (rows - 1) * gap;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,253,245,0.18)';
    ctx.fillRect(0, 0, w, h);

    cells.forEach((plot, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const px = pad + col * (s + gap);
      const py = pad + row * (s + gap);
      drawSoilCell(px, py, s, plot);
    });

    canvas._layout = { cols, rows, gap, pad, s, cells };
  }

  // ---- Farm gameplay ----
  function canPlant(plot) {
    return plot.kind === 'soil' && (!plot.crop || plot.stage === 0);
  }
  function plant(plot, cropId) {
    const c = CROPS[cropId];
    if (!c || !canPlant(plot)) return false;
    if (state.gold < c.seedCost) { toast('銀兩不足（種子 ' + c.seedCost + '）'); return false; }
    state.gold -= c.seedCost;
    plot.crop = cropId;
    plot.stage = 1;
    plot.progress = 0;
    plot.watered = false;
    plot.wilt = 0;
    return true;
  }
  function water(plot) {
    if (plot.kind !== 'soil' || !plot.crop || plot.stage >= 4) return false;
    if (plot.watered) return false;
    plot.watered = true;
    plot.wilt = 0;
    return true;
  }
  function waterAll() {
    let n = 0;
    for (const p of state.plots) if (water(p)) n++;
    if (n) toast('澆咗 ' + n + ' 畦');
    else toast('冇需要澆嘅田');
  }
  function harvestOne(plot) {
    if (plot.kind !== 'soil' || !plot.crop || plot.stage < 4) return false;
    const c = CROPS[plot.crop];
    const cropId = plot.crop;
    state.inventory[cropId] = (state.inventory[cropId] || 0) + 1;
    state.food += c.food;
    if (cropId === 'rice') bumpQuest('riceHarvested', 1);
    const name = c.name;
    plot.crop = null;
    plot.stage = 0;
    plot.progress = 0;
    plot.watered = false;
    plot.wilt = 0;
    return name;
  }
  function harvestAll() {
    const got = {};
    for (const p of state.plots) {
      const n = harvestOne(p);
      if (n) got[n] = (got[n] || 0) + 1;
    }
    const parts = Object.keys(got).map(k => k + '×' + got[k]);
    if (parts.length) toast('收成：' + parts.join('、'));
    else toast('未有成熟作物');
  }
  function sellSurplus(keepFood) {
    let gained = 0;
    const order = ['flower', 'veg', 'rice', 'wheat'];
    for (const id of order) {
      let count = state.inventory[id] || 0;
      if (!count) continue;
      const c = CROPS[id];
      while (count > 0) {
        if (c.food > 0 && state.food - c.food < keepFood) break;
        state.inventory[id]--;
        count--;
        if (c.food > 0) state.food = Math.max(0, state.food - c.food);
        state.gold += c.sell;
        gained += c.sell;
      }
    }
    return gained;
  }
  function sellInventoryAll() {
    let total = 0;
    for (const id of Object.keys(CROPS)) {
      while ((state.inventory[id] || 0) > 0) {
        state.inventory[id]--;
        state.gold += CROPS[id].sell;
        total += CROPS[id].sell;
      }
    }
    for (const id of Object.keys(ORE)) {
      while ((state.inventory[id] || 0) > 0) {
        state.inventory[id]--;
        state.gold += ORE[id].sell;
        total += ORE[id].sell;
      }
    }
    for (const id of Object.keys(FISH)) {
      while ((state.inventory[id] || 0) > 0) {
        state.inventory[id]--;
        state.gold += FISH[id].sell;
        total += FISH[id].sell;
      }
    }
    toast(total > 0 ? ('賣出 +' + total + ' 💰') : '倉庫空空');
    return total;
  }

  function tryExpand() {
    if (state.unlockedCount >= state.maxPlots) { toast('田已開滿'); return false; }
    if (state.gold < state.expandCost) { toast('擴田要 ' + state.expandCost + ' 💰'); return false; }
    const locked = state.plots.filter(p => p.kind === 'locked');
    if (!locked.length) { toast('冇可擴嘅地'); return false; }
    locked.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const p = locked[0];
    state.gold -= state.expandCost;
    p.kind = 'soil';
    state.unlockedCount++;
    state.expandCost = Math.floor(state.expandCost * 1.35) + 5;
    toast('新開一畦田！下次 ' + state.expandCost + ' 💰');
    return true;
  }

  function advanceGrowth(dtDays) {
    for (const p of state.plots) {
      if (p.kind !== 'soil' || !p.crop || p.stage <= 0 || p.stage >= 4) continue;
      const c = CROPS[p.crop];
      let rate = 1 / c.grow;
      if (c.waterNeed) {
        if (p.watered) rate *= 1.6;
        else {
          p.wilt += dtDays;
          if (p.wilt > 1.2) rate *= 0.35;
        }
      } else if (p.watered) rate *= 1.25;

      if (state.seasonIdx === 3 && p.crop !== 'wheat') rate *= 0.55;
      if (state.seasonIdx === 1) rate *= 1.15;

      p.progress += rate * dtDays;
      while (p.progress >= 1 && p.stage < 4) {
        p.progress -= 1;
        p.stage++;
        p.watered = false;
      }
    }
  }

  function dailyTick() {
    state.day++;
    if (state.day % 8 === 1 && state.day > 1) {
      state.seasonIdx = (state.seasonIdx + 1) % 4;
      toast(seasonName() + '到了');
    }
    const eat = 2 + Math.floor(state.unlockedCount / 6);
    state.food = Math.max(0, state.food - eat);
    if (state.food === 0) toast('存糧見底！快種種糧');
    // daily stamina restore a bit
    state.stamina = Math.min(state.maxStamina, state.stamina + 25);
    state.daysSinceEvent++;
    maybeEvent();
    save();
  }

  function preferCrop() {
    const prefs = DIRS[state.directive].prefer;
    for (const id of prefs) {
      if (state.gold >= CROPS[id].seedCost) return id;
    }
    const ids = Object.keys(CROPS).sort((a, b) => CROPS[a].seedCost - CROPS[b].seedCost);
    for (const id of ids) if (state.gold >= CROPS[id].seedCost) return id;
    return null;
  }

  function autoFarmStep() {
    const dir = DIRS[state.directive];
    for (const p of state.plots) harvestOne(p);
    for (const p of state.plots) {
      if (p.kind === 'soil' && p.crop && p.stage > 0 && p.stage < 4) {
        const c = CROPS[p.crop];
        if ((c.waterNeed && !p.watered) || (!p.watered && Math.random() < 0.3)) water(p);
      }
    }
    sellSurplus(dir.sellFoodKeep);
    if (Math.random() < dir.expandBias && state.gold >= state.expandCost) tryExpand();
    const crop = preferCrop();
    if (crop) {
      const empties = state.plots.filter(canPlant);
      let n = 0;
      for (const p of empties) {
        if (n >= 2) break;
        if (plant(p, crop)) n++;
      }
    }
    document.getElementById('status-text').textContent =
      'AUTO：' + dir.label + ' · 種' + (CROPS[crop || 'rice'].name);
  }

  // ---- Mining ----
  function doMine(silent) {
    if (state.mode !== 'mine' && !silent) return false;
    if (mineCd > 0) {
      if (!silent) toast('稍候再挖');
      return false;
    }
    if (state.stamina < 8) {
      if (!silent) toast('體力不足，先歇息');
      return false;
    }
    state.stamina -= 8;
    mineCd = 1.4;
    bumpQuest('minesDone', 1);

    const roll = Math.random();
    let msg;
    if (roll < 0.08) {
      state.inventory.goldOre = (state.inventory.goldOre || 0) + 1;
      msg = '挖到金礦！';
      showHint('✨ 金礦');
    } else if (roll < 0.18) {
      state.inventory.ore = (state.inventory.ore || 0) + 2;
      state.gold += 3;
      msg = '礦脈豐收 +2 礦石、+3💰';
      showHint('礦脈！');
    } else if (roll < 0.92) {
      state.inventory.ore = (state.inventory.ore || 0) + 1;
      msg = '挖到礦石 +1';
      showHint('叮！');
    } else {
      msg = '只挖到碎石…';
      showHint('…');
    }
    if (!silent) toast(msg);
    updateHud();
    save();
    return true;
  }

  function sellOre() {
    let total = 0;
    for (const id of Object.keys(ORE)) {
      while ((state.inventory[id] || 0) > 0) {
        state.inventory[id]--;
        state.gold += ORE[id].sell;
        total += ORE[id].sell;
      }
    }
    toast(total ? ('賣礦 +' + total + ' 💰') : '冇礦可賣');
    updateHud();
    save();
  }

  function restStamina() {
    if (state.stamina >= state.maxStamina) {
      toast('體力已滿');
      return;
    }
    const gain = 20;
    state.stamina = Math.min(state.maxStamina, state.stamina + gain);
    toast('歇息 +' + gain + ' 體力');
    updateHud();
    save();
  }

  // ---- Fishing ----
  function showAchievement(title, body) {
    document.getElementById('achieve-title').textContent = title;
    document.getElementById('achieve-body').textContent = body;
    document.getElementById('modal-achieve').hidden = false;
  }

  function doFish(silent) {
    if (state.mode !== 'pond' && !silent) return false;
    if (fishCd > 0) {
      if (!silent) toast('魚線未收好');
      return false;
    }
    if (state.stamina < 6) {
      if (!silent) toast('體力不足，先歇息');
      return false;
    }
    state.stamina -= 6;
    fishCd = 1.8;
    state.stats.fishCaught = (state.stats.fishCaught || 0) + 1;

    const roll = Math.random();
    if (roll < 0.12) {
      // rare
      state.inventory.rareFish = (state.inventory.rareFish || 0) + 1;
      bumpQuest('rareCaught', 1);
      showHint('🐟 大魚！');
      if (!silent) toast('釣到珍稀大魚！');
      if (!state.achievements.rareFish) {
        state.achievements.rareFish = true;
        showAchievement('釣獲珍魚', '你在青畦魚塘釣上罕見大魚，鄉里傳為美談。獎勵稍後可於任務領取。');
      }
    } else if (roll < 0.78) {
      state.inventory.fish = (state.inventory.fish || 0) + 1;
      showHint('上鉤');
      if (!silent) toast('釣到普通魚 +1');
    } else if (roll < 0.9) {
      state.inventory.fish = (state.inventory.fish || 0) + 2;
      showHint('連上兩條');
      if (!silent) toast('好運！魚 ×2');
    } else {
      showHint('空竿');
      if (!silent) toast('空竿一回');
    }
    updateHud();
    save();
    return true;
  }

  function sellFish() {
    let total = 0;
    for (const id of Object.keys(FISH)) {
      while ((state.inventory[id] || 0) > 0) {
        state.inventory[id]--;
        state.gold += FISH[id].sell;
        total += FISH[id].sell;
      }
    }
    toast(total ? ('賣魚 +' + total + ' 💰') : '冇魚可賣');
    updateHud();
    save();
  }

  // ---- AUTO ----
  function autoStep() {
    if (!state.auto) return;
    if (!document.getElementById('modal-event').hidden) return;
    if (!document.getElementById('modal-achieve').hidden) return;

    if (state.mode === 'farm') {
      autoFarmStep();
    } else if (state.mode === 'mine') {
      if (state.stamina < 8) {
        state.stamina = Math.min(state.maxStamina, state.stamina + 12);
        document.getElementById('status-text').textContent = 'AUTO：歇息回體力';
      } else {
        doMine(true);
        document.getElementById('status-text').textContent = 'AUTO：開挖中';
      }
      // auto-sell surplus ore if gold low
      if (state.gold < 20 && (state.inventory.ore || 0) > 5) {
        const sellN = Math.min(3, state.inventory.ore);
        state.inventory.ore -= sellN;
        state.gold += sellN * ORE.ore.sell;
      }
    } else if (state.mode === 'pond') {
      if (state.stamina < 6) {
        state.stamina = Math.min(state.maxStamina, state.stamina + 12);
        document.getElementById('status-text').textContent = 'AUTO：歇息回體力';
      } else {
        doFish(true);
        document.getElementById('status-text').textContent = 'AUTO：拋竿中';
      }
    } else if (state.mode === 'village') {
      // idle wander — light stamina regen
      state.stamina = Math.min(state.maxStamina, state.stamina + 2);
      document.getElementById('status-text').textContent = 'AUTO：村中閒逛';
    }
  }

  function toggleAuto() {
    state.auto = !state.auto;
    const modeLabel = { farm: DIRS[state.directive].label, village: '村落', mine: '挖礦', pond: '釣魚' }[state.mode];
    toast(state.auto ? ('AUTO 開：' + modeLabel) : 'AUTO 關');
    updateHud();
    save();
  }

  // ---- Events ----
  const EVENTS = [
    {
      id: 'rain',
      title: '甘霖',
      body: '雲聚雨落。要唔要讓田地飽飲一場？',
      choices: [
        { label: '接下雨水（全部澆透）', fn: () => { state.plots.forEach(p => { if (p.kind === 'soil' && p.crop) p.watered = true; }); toast('雨潤青畦'); } },
        { label: '關緊倉門便是', fn: () => { toast('錯過一場雨'); } },
      ],
    },
    {
      id: 'merchant',
      title: '行商',
      body: '客商要收鮮花與蔬菜，肯出好價。',
      choices: [
        { label: '賣花／菜（高價）', fn: () => {
          let g = 0;
          for (const id of ['flower', 'veg']) {
            while ((state.inventory[id] || 0) > 0) {
              state.inventory[id]--;
              const pay = Math.floor(CROPS[id].sell * 1.6);
              state.gold += pay; g += pay;
            }
          }
          toast(g ? ('行商付款 +' + g) : '冇花菜可賣');
        } },
        { label: '婉拒', fn: () => { toast('客商拱手離去'); } },
      ],
    },
    {
      id: 'drought',
      title: '乾旱',
      body: '烈日灼田。要立刻全村澆水，定係硬撐？',
      choices: [
        { label: '立刻全澆（-5💰）', fn: () => {
          if (state.gold >= 5) { state.gold -= 5; waterAll(); }
          else { toast('銀兩不夠，硬撐'); state.plots.forEach(p => { if (p.crop) p.wilt += 0.8; }); }
        } },
        { label: '硬撐', fn: () => { state.plots.forEach(p => { if (p.crop) p.wilt += 1; }); toast('作物受旱'); } },
      ],
    },
    {
      id: 'gift',
      title: '鄰里',
      body: '鄰家送來一小袋糧種，表心意。',
      choices: [
        { label: '笑納（+8 糧）', fn: () => { state.food += 8; toast('人情暖於爐火'); } },
        { label: '回贈 6💰', fn: () => {
          if (state.gold >= 6) { state.gold -= 6; state.food += 12; toast('禮尚往來，糧更多'); }
          else { state.food += 8; toast('袋緊，只好笑納'); }
        } },
      ],
    },
    {
      id: 'miner',
      title: '礦工傳聞',
      body: '有人說礦洞深處偶見金光。要不要多備體力？',
      choices: [
        { label: '買補藥（-8💰 · +30體力）', fn: () => {
          if (state.gold >= 8) {
            state.gold -= 8;
            state.stamina = Math.min(state.maxStamina, state.stamina + 30);
            toast('體力充盈');
          } else toast('銀兩不夠');
        } },
        { label: '聽過便是', fn: () => { toast('記在心上'); } },
      ],
    },
  ];

  function maybeEvent() {
    if (state.daysSinceEvent < state.eventCooldown) return;
    if (Math.random() > 0.45) return;
    state.daysSinceEvent = 0;
    state.eventCooldown = 6 + Math.floor(Math.random() * 5);
    const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    showEvent(ev);
  }

  function showEvent(ev) {
    const wasAuto = state.auto;
    state._pausedAuto = wasAuto;
    state.auto = false;
    updateHud();
    const modal = document.getElementById('modal-event');
    document.getElementById('event-title').textContent = ev.title;
    document.getElementById('event-body').textContent = ev.body;
    const acts = document.getElementById('event-actions');
    acts.innerHTML = '';
    ev.choices.forEach(ch => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = ch.label;
      b.onclick = () => {
        ch.fn();
        modal.hidden = true;
        if (state._pausedAuto) state.auto = true;
        state._pausedAuto = false;
        updateHud();
        save();
      };
      acts.appendChild(b);
    });
    modal.hidden = false;
  }

  // ---- Bag / Quest UI ----
  function bagEntries() {
    const inv = state.inventory;
    const list = [];
    for (const id of Object.keys(CROPS)) {
      const n = inv[id] || 0;
      if (n > 0) list.push({ id, name: CROPS[id].name, count: n, sell: CROPS[id].sell, kind: 'crop' });
    }
    for (const id of Object.keys(ORE)) {
      const n = inv[id] || 0;
      if (n > 0) list.push({ id, name: ORE[id].name, count: n, sell: ORE[id].sell, kind: 'ore' });
    }
    for (const id of Object.keys(FISH)) {
      const n = inv[id] || 0;
      if (n > 0) list.push({ id, name: FISH[id].name, count: n, sell: FISH[id].sell, kind: 'fish' });
    }
    if ((inv.pickaxe || 0) > 0) list.push({ id: 'pickaxe', name: '鶴嘴鋤', count: inv.pickaxe, sell: 0, kind: 'tool' });
    if ((inv.rod || 0) > 0) list.push({ id: 'rod', name: '釣竿', count: inv.rod, sell: 0, kind: 'tool' });
    return list;
  }

  function renderBag() {
    const grid = document.getElementById('bag-grid');
    grid.innerHTML = '';
    const entries = bagEntries();
    if (!entries.length) {
      grid.innerHTML = '<p class="tiny" style="grid-column:1/-1;text-align:center">背包空空如也</p>';
      return;
    }
    entries.forEach(e => {
      const div = document.createElement('div');
      div.className = 'bag-item';
      div.innerHTML = '<div class="name">' + e.name + '</div>' +
        '<div class="count">×' + e.count + (e.sell ? (' · 單價 ' + e.sell + '💰') : '') + '</div>';
      if (e.sell > 0) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sell-one';
        btn.textContent = '賣 1';
        btn.onclick = () => {
          if ((state.inventory[e.id] || 0) <= 0) return;
          state.inventory[e.id]--;
          // food adjust for crops
          if (CROPS[e.id] && CROPS[e.id].food > 0) {
            state.food = Math.max(0, state.food - CROPS[e.id].food);
          }
          state.gold += e.sell;
          toast(e.name + ' +' + e.sell + '💰');
          updateHud();
          save();
          renderBag();
        };
        div.appendChild(btn);
      }
      grid.appendChild(div);
    });
  }

  function renderQuests() {
    const list = document.getElementById('quest-list');
    list.innerHTML = '';
    state.quests.forEach(q => {
      const def = QUEST_DEFS.find(d => d.id === q.id);
      if (!def) return;
      const done = q.progress >= def.target;
      const div = document.createElement('div');
      div.className = 'quest-item' + (done ? ' done' : '') + (q.claimed ? ' claimed' : '');
      div.innerHTML =
        '<div class="q-title">' + def.title + '</div>' +
        '<div class="q-desc">' + def.desc + '</div>' +
        '<div class="q-prog">進度 ' + Math.min(q.progress, def.target) + '／' + def.target +
          ' · 獎勵 ' + def.reward + '💰</div>';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'q-claim';
      if (q.claimed) {
        btn.textContent = '已領取';
        btn.disabled = true;
      } else if (done) {
        btn.textContent = '領取獎勵';
        btn.onclick = () => {
          q.claimed = true;
          state.gold += def.reward;
          toast('任務完成 +' + def.reward + '💰');
          updateHud();
          save();
          renderQuests();
        };
      } else {
        btn.textContent = '進行中';
        btn.disabled = true;
      }
      div.appendChild(btn);
      list.appendChild(div);
    });
  }

  // ---- Input ----
  function canvasToPlot(ev) {
    const rect = canvas.getBoundingClientRect();
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const layout = canvas._layout;
    if (!layout) return null;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (clientX - rect.left) * scaleX;
    const my = (clientY - rect.top) * scaleY;
    const { cols, gap, pad, s, cells } = layout;
    const col = Math.floor((mx - pad) / (s + gap));
    const row = Math.floor((my - pad) / (s + gap));
    if (col < 0 || row < 0 || col >= cols) return null;
    const localX = (mx - pad) - col * (s + gap);
    const localY = (my - pad) - row * (s + gap);
    if (localX < 0 || localY < 0 || localX > s || localY > s) return null;
    const idx = row * cols + col;
    return cells[idx] || null;
  }

  function onFarmTap(ev) {
    ev.preventDefault();
    if (state.mode !== 'farm') return;
    const plot = canvasToPlot(ev.changedTouches ? ev.changedTouches[0] : ev);
    if (!plot) return;
    selectedPlot = plot;

    if (plot.kind === 'locked') {
      tryExpand();
      updateHud();
      drawFarm();
      return;
    }
    if (plot.kind !== 'soil') {
      document.getElementById('status-text').textContent =
        plot.kind === 'house' ? '自家小屋' :
        plot.kind === 'wheel' ? '水車吱呀轉' :
        plot.kind === 'water' ? '清渠流水' :
        plot.kind === 'tree' ? '後山林影' : '小路';
      drawFarm();
      return;
    }

    if (plot.crop && plot.stage >= 4) {
      const n = harvestOne(plot);
      if (n) toast('收成 ' + n);
    } else if (plot.crop && plot.stage > 0 && !plot.watered) {
      water(plot);
      toast('澆水');
    } else if (canPlant(plot)) {
      if (plant(plot, selectedCrop)) toast('種下' + CROPS[selectedCrop].name);
    } else if (plot.crop) {
      toast(CROPS[plot.crop].name + ' · 階段' + plot.stage + '/4' + (plot.watered ? ' · 已澆' : ' · 待澆'));
    }
    updateHud();
    drawFarm();
    save();
  }

  // ---- Loop ----
  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;

    const dayLen = 12;
    dayAcc += dt;
    advanceGrowth(dt / dayLen);
    if (dayAcc >= dayLen) {
      dayAcc -= dayLen;
      dailyTick();
      updateHud();
    }

    if (mineCd > 0) mineCd = Math.max(0, mineCd - dt);
    if (fishCd > 0) fishCd = Math.max(0, fishCd - dt);

    // slow passive stamina regen
    stamRegenAcc += dt;
    if (stamRegenAcc >= 3) {
      stamRegenAcc = 0;
      if (state.stamina < state.maxStamina) {
        state.stamina = Math.min(state.maxStamina, state.stamina + 1);
      }
    }

    autoAcc += dt;
    if (autoAcc >= 1.1) {
      autoAcc = 0;
      if (state.auto) {
        autoStep();
        updateHud();
      }
    }

    if (state.mode === 'mine' || state.mode === 'pond') updateModeStats();
    if (state.mode === 'farm') drawFarm();
    requestAnimationFrame(frame);
  }

  function startGame(fromSave) {
    state = fromSave ? load() : defaultState();
    if (!state) state = defaultState();
    selectedPlot = null;
    dayAcc = 0;
    autoAcc = 0;
    mineCd = 0;
    fishCd = 0;
    stamRegenAcc = 0;
    document.getElementById('screen-title').hidden = true;
    document.getElementById('screen-game').hidden = false;
    setMode(state.mode || 'farm');
    updateHud();
    drawFarm();
    running = true;
    lastTs = performance.now();
    requestAnimationFrame(frame);
    save();
  }

  function toTitle() {
    running = false;
    save();
    document.getElementById('screen-game').hidden = true;
    document.getElementById('screen-title').hidden = false;
    document.getElementById('btn-continue').hidden = !hasSave();
  }

  // ---- Wire UI ----
  function wire() {
    document.getElementById('btn-start').onclick = () => {
      if (hasSave() && !confirm('開始新局會覆蓋存檔，確定？')) return;
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(SAVE_KEY_V1);
      startGame(false);
    };
    document.getElementById('btn-continue').onclick = () => startGame(true);
    document.getElementById('btn-continue').hidden = !hasSave();

    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.onclick = () => setMode(tab.dataset.mode);
    });
    document.querySelectorAll('[data-goto]').forEach(b => {
      b.onclick = () => setMode(b.dataset.goto);
    });

    ['btn-auto', 'btn-auto-v', 'btn-auto-m', 'btn-auto-p'].forEach(id => {
      document.getElementById(id).onclick = toggleAuto;
    });

    document.querySelectorAll('.dir').forEach(b => {
      b.onclick = () => {
        state.directive = b.dataset.dir;
        toast('方針：' + DIRS[state.directive].label);
        updateHud();
        save();
      };
    });
    document.querySelectorAll('.crop-btn').forEach(b => {
      b.onclick = () => {
        selectedCrop = b.dataset.crop;
        document.querySelectorAll('.crop-btn').forEach(x => x.classList.toggle('active', x === b));
      };
    });

    document.getElementById('btn-water-all').onclick = () => { waterAll(); updateHud(); save(); };
    document.getElementById('btn-harvest').onclick = () => { harvestAll(); updateHud(); save(); };
    document.getElementById('btn-sell').onclick = () => { sellInventoryAll(); updateHud(); save(); };
    document.getElementById('btn-expand').onclick = () => { tryExpand(); updateHud(); drawFarm(); save(); };

    document.getElementById('btn-mine').onclick = () => doMine(false);
    document.getElementById('btn-sell-ore').onclick = sellOre;
    document.getElementById('btn-rest').onclick = restStamina;
    document.getElementById('btn-fish').onclick = () => doFish(false);
    document.getElementById('btn-sell-fish').onclick = sellFish;
    document.getElementById('btn-rest-p').onclick = restStamina;

    document.getElementById('btn-interact').onclick = () => {
      if (state.mode === 'mine') doMine(false);
      else if (state.mode === 'pond') doFish(false);
    };
    document.getElementById('btn-attack').onclick = () => {
      if (state.mode === 'mine') { showHint('揮鋤'); doMine(false); }
      else toast('這兒不必動手');
    };
    document.getElementById('btn-skill').onclick = () => {
      if (state.stamina < state.maxStamina) {
        state.stamina = Math.min(state.maxStamina, state.stamina + 8);
        toast('深呼吸 +8 體力');
        updateHud();
        save();
      } else toast('體力已滿');
    };
    document.querySelectorAll('.dpad-btn').forEach(b => {
      b.onclick = () => {
        const d = b.dataset.dir;
        showHint({ up: '向前', down: '後退', left: '向左', right: '向右' }[d] || '');
        // light flavor — tiny stamina cost feel of walking
        if (state.stamina > 0) state.stamina = Math.max(0, state.stamina - 0.5);
        updateHud();
      };
    });

    canvas.addEventListener('click', onFarmTap);
    canvas.addEventListener('touchend', onFarmTap, { passive: false });

    document.getElementById('btn-bag').onclick = () => {
      renderBag();
      document.getElementById('modal-bag').hidden = false;
    };
    document.getElementById('btn-close-bag').onclick = () => {
      document.getElementById('modal-bag').hidden = true;
    };
    document.getElementById('btn-bag-sell-all').onclick = () => {
      sellInventoryAll();
      updateHud();
      save();
      renderBag();
    };

    document.getElementById('btn-quest').onclick = () => {
      renderQuests();
      document.getElementById('modal-quest').hidden = false;
    };
    document.getElementById('btn-close-quest').onclick = () => {
      document.getElementById('modal-quest').hidden = true;
    };
    document.getElementById('btn-close-achieve').onclick = () => {
      document.getElementById('modal-achieve').hidden = true;
      if (state._pausedAuto) { /* keep as-is */ }
      updateHud();
    };

    document.getElementById('btn-menu').onclick = () => {
      document.getElementById('modal-menu').hidden = false;
    };
    document.getElementById('btn-close-menu').onclick = () => {
      document.getElementById('modal-menu').hidden = true;
    };
    document.getElementById('btn-save').onclick = () => { save(); toast('已存檔'); };
    document.getElementById('btn-title').onclick = () => {
      document.getElementById('modal-menu').hidden = true;
      toTitle();
    };

    const openSettings = () => {
      document.getElementById('set-provider').value = settings.provider || 'none';
      document.getElementById('set-model').value = settings.model || 'deepseek-chat';
      document.getElementById('set-key').value = settings.apiKey || '';
      document.getElementById('modal-settings').hidden = false;
      document.getElementById('modal-menu').hidden = true;
    };
    document.getElementById('btn-settings-title').onclick = openSettings;
    document.getElementById('btn-settings-game').onclick = openSettings;
    document.getElementById('btn-close-settings').onclick = () => {
      document.getElementById('modal-settings').hidden = true;
    };
    document.getElementById('btn-save-settings').onclick = () => {
      settings.provider = document.getElementById('set-provider').value;
      settings.model = document.getElementById('set-model').value;
      settings.apiKey = document.getElementById('set-key').value.trim();
      saveSettings();
      toast('設定已存本機');
      document.getElementById('modal-settings').hidden = true;
    };

    document.addEventListener('click', e => {
      const a = e.target.closest('a');
      if (a && /^weixin:/i.test(a.getAttribute('href') || '')) {
        e.preventDefault();
      }
    }, true);
  }

  wire();
})();
