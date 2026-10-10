(() => {
  'use strict';

  const SAVE_KEY = 'qingqi_v1';
  const SETTINGS_KEY = 'qingqi_settings_v1';
  const COLS = 6;
  const ROWS = 7;
  const TILE = 48;
  const HOUSE_CELLS = new Set(['1,1', '2,1']); // house footprint on grid overlay zone

  const SEASONS = ['春', '夏', '秋', '冬'];
  const CROPS = {
    rice:   { name: '稻', emoji: '稻', grow: 5, waterNeed: true, sell: 8, food: 6, seedCost: 3, color: '#8bc34a', ripe: '#fdd835' },
    veg:    { name: '菜', emoji: '菜', grow: 4, waterNeed: true, sell: 10, food: 3, seedCost: 4, color: '#66bb6a', ripe: '#43a047' },
    flower: { name: '花', emoji: '花', grow: 3, waterNeed: false, sell: 14, food: 0, seedCost: 5, color: '#ec407a', ripe: '#f48fb1' },
    wheat:  { name: '麥', emoji: '麥', grow: 4, waterNeed: false, sell: 7, food: 5, seedCost: 3, color: '#dce775', ripe: '#fbc02d' },
  };

  const DIRS = {
    grain:  { label: '多種糧', prefer: ['rice', 'wheat'], sellFoodKeep: 20, expandBias: 0.2 },
    money:  { label: '多賺錢', prefer: ['flower', 'veg'], sellFoodKeep: 8, expandBias: 0.35 },
    expand: { label: '擴田優先', prefer: ['flower', 'veg'], sellFoodKeep: 10, expandBias: 0.95 },
    winter: { label: '存糧過冬', prefer: ['wheat', 'rice'], sellFoodKeep: 40, expandBias: 0.1 },
  };

  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById('farm');
  const ctx = canvas.getContext('2d');
  const titleCanvas = document.getElementById('titleCanvas');
  const tctx = titleCanvas.getContext('2d');

  let state = null;
  let settings = loadSettings();
  let selectedCrop = 'rice';
  let selectedPlot = null;
  let tickAcc = 0;
  let lastTs = 0;
  let running = false;
  let toastTimer = 0;

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

  function defaultState() {
    const plots = [];
    // 4 unlocked soil plots in a farm area (rows 3-5, cols 1-4 partially)
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
          stage: 0,      // 0 empty, 1 planted, 2 sprout, 3 grow, 4 ripe
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
      auto: false,
      directive: 'grain',
      inventory: { rice: 0, veg: 0, flower: 0, wheat: 0 },
      plots,
      expandCost: 45,
      unlockedCount: unlocked.length,
      maxPlots: 18,
      eventCooldown: 8,
      daysSinceEvent: 0,
      log: [],
      version: 1,
    };
  }

  function save() {
    if (!state) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }
  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
  }
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!raw || !raw.plots) return null;
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

  function seasonName() { return SEASONS[state.seasonIdx % 4]; }
  function plotAt(x, y) { return state.plots.find(p => p.x === x && p.y === y); }

  function updateHud() {
    document.getElementById('hud-day').textContent = seasonName() + ' · 第' + state.day + '日';
    document.getElementById('hud-gold').textContent = '💰 ' + state.gold;
    document.getElementById('hud-food').textContent = '🌾 ' + state.food;
    const al = document.getElementById('auto-label');
    al.textContent = state.auto ? 'AUTO 開 · ' + DIRS[state.directive].label : 'AUTO 關';
    al.className = state.auto ? 'auto-on' : 'auto-off';
    document.getElementById('btn-auto').classList.toggle('on', state.auto);
    document.querySelectorAll('.dir').forEach(b => {
      b.classList.toggle('active', b.dataset.dir === state.directive);
    });
    document.getElementById('btn-expand').textContent = '擴田' + state.expandCost;
  }

  // ---- Drawing (pixel) ----
  function drawTile(px, py, kind, plot) {
    const s = TILE;
    // base
    if (kind === 'water' || kind === 'wheel') {
      ctx.fillStyle = '#29b6f6';
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#4fc3f7';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(px + 4 + i * 10, py + 8 + ((i + Math.floor(performance.now() / 200)) % 3) * 4, 8, 3);
      }
      if (kind === 'wheel') {
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(px + 18, py + 6, 12, 36);
        ctx.beginPath();
        ctx.arc(px + 24, py + 24, 14, 0, Math.PI * 2);
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 3;
        ctx.stroke();
        const ang = (performance.now() / 800) % (Math.PI * 2);
        for (let i = 0; i < 6; i++) {
          const a = ang + i * Math.PI / 3;
          ctx.beginPath();
          ctx.moveTo(px + 24, py + 24);
          ctx.lineTo(px + 24 + Math.cos(a) * 12, py + 24 + Math.sin(a) * 12);
          ctx.stroke();
        }
      }
      return;
    }
    if (kind === 'tree') {
      ctx.fillStyle = '#81c784';
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#33691e';
      ctx.fillRect(px + 18, py + 28, 12, 16);
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath();
      ctx.arc(px + 24, py + 18, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#66bb6a';
      ctx.beginPath();
      ctx.arc(px + 16, py + 22, 10, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (kind === 'house') {
      ctx.fillStyle = '#a5d6a7';
      ctx.fillRect(px, py, s, s);
      // only draw house body on left cell of footprint; right cell path-ish yard
      if (plot.x === 1) {
        ctx.fillStyle = '#efebe9';
        ctx.fillRect(px + 6, py + 16, 36, 26);
        ctx.fillStyle = '#c62828';
        ctx.beginPath();
        ctx.moveTo(px + 4, py + 18);
        ctx.lineTo(px + 24, py + 4);
        ctx.lineTo(px + 44, py + 18);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(px + 18, py + 28, 10, 14);
        ctx.fillStyle = '#bbdefb';
        ctx.fillRect(px + 8, py + 22, 8, 8);
      } else {
        ctx.fillStyle = '#d7ccc8';
        ctx.fillRect(px + 4, py + 20, s - 8, 20);
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(px + 10, py + 10, 8, 10);
        ctx.fillRect(px + 28, py + 12, 10, 8);
      }
      return;
    }
    if (kind === 'path') {
      ctx.fillStyle = '#d7ccc8';
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#bcaaa4';
      for (let i = 0; i < 6; i++) ctx.fillRect(px + 4 + (i % 3) * 14, py + 8 + Math.floor(i / 3) * 18, 10, 8);
      return;
    }
    if (kind === 'locked') {
      ctx.fillStyle = '#a5d6a7';
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = 'rgba(93,64,55,0.25)';
      ctx.fillRect(px + 8, py + 8, s - 16, s - 16);
      ctx.fillStyle = '#5d4037';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('鎖', px + s / 2, py + s / 2 + 6);
      return;
    }
    if (kind === 'grass') {
      ctx.fillStyle = '#8bc34a';
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = '#7cb342';
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(px + 4 + (i % 4) * 11, py + 6 + Math.floor(i / 4) * 20, 3, 10);
      }
      return;
    }
    // soil
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = '#6d4c41';
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, s - 4, s - 4);
    // furrows
    ctx.fillStyle = '#795548';
    for (let i = 0; i < 3; i++) ctx.fillRect(px + 6, py + 10 + i * 12, s - 12, 3);

    if (plot.watered) {
      ctx.fillStyle = 'rgba(33,150,243,0.28)';
      ctx.fillRect(px + 2, py + 2, s - 4, s - 4);
    }

    if (plot.crop && plot.stage > 0) {
      const c = CROPS[plot.crop];
      const stage = plot.stage;
      if (stage === 1) {
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(px + 22, py + 28, 4, 8);
      } else if (stage === 2) {
        ctx.fillStyle = c.color;
        ctx.fillRect(px + 20, py + 22, 8, 14);
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(px + 16, py + 18, 6, 6);
        ctx.fillRect(px + 26, py + 18, 6, 6);
      } else if (stage === 3) {
        ctx.fillStyle = c.color;
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(px + 10 + i * 12, py + 14, 8, 22);
        }
      } else if (stage >= 4) {
        ctx.fillStyle = c.ripe;
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(px + 10 + i * 12, py + 10, 10, 26);
        }
        // sparkle
        ctx.fillStyle = '#fffde7';
        ctx.fillRect(px + 14, py + 12, 3, 3);
        ctx.fillRect(px + 30, py + 16, 3, 3);
      }
      // label
      ctx.fillStyle = '#212121';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.name, px + s / 2, py + s - 4);
    }

    if (selectedPlot && selectedPlot.x === plot.x && selectedPlot.y === plot.y) {
      ctx.strokeStyle = '#ffeb3b';
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 1, py + 1, s - 2, s - 2);
    }
  }

  function drawFarm() {
    const w = COLS * TILE;
    const h = ROWS * TILE;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.imageSmoothingEnabled = false;
    // sky strip already in CSS; fill field bg
    ctx.fillStyle = '#81c784';
    ctx.fillRect(0, 0, w, h);

    for (const p of state.plots) {
      drawTile(p.x * TILE, p.y * TILE, p.kind, p);
    }

    // fence around farm area
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 2;
  }

  function drawTitleArt() {
    const c = titleCanvas;
    tctx.imageSmoothingEnabled = false;
    tctx.fillStyle = '#81c784';
    tctx.fillRect(0, 0, c.width, c.height);
    // simple house + field
    tctx.fillStyle = '#29b6f6';
    tctx.fillRect(0, 0, c.width, 40);
    tctx.fillStyle = '#efebe9';
    tctx.fillRect(40, 50, 50, 40);
    tctx.fillStyle = '#c62828';
    tctx.beginPath();
    tctx.moveTo(35, 55); tctx.lineTo(65, 30); tctx.lineTo(95, 55); tctx.closePath(); tctx.fill();
    tctx.fillStyle = '#8d6e63';
    for (let i = 0; i < 4; i++) {
      tctx.fillRect(120 + i * 36, 70, 30, 40);
      tctx.fillStyle = '#8bc34a';
      tctx.fillRect(126 + i * 36, 78, 18, 24);
      tctx.fillStyle = '#8d6e63';
    }
    tctx.fillStyle = '#2e7d32';
    tctx.font = 'bold 14px sans-serif';
    tctx.fillText('AUTO', 200, 28);
  }

  // ---- Gameplay ----
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
    state.inventory[plot.crop] = (state.inventory[plot.crop] || 0) + 1;
    state.food += c.food;
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
      // for food crops, only sell if food above keep
      while (count > 0) {
        if (c.food > 0 && state.food - c.food < keepFood) break;
        state.inventory[id]--;
        count--;
        if (c.food > 0) state.food = Math.max(0, state.food - c.food);
        state.gold += c.sell;
        gained += c.sell;
      }
    }
    // also sell pure cash crops always
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
    toast(total > 0 ? ('賣出 +' + total + ' 💰') : '倉庫空空');
    return total;
  }

  function tryExpand() {
    if (state.unlockedCount >= state.maxPlots) { toast('田已開滿'); return false; }
    if (state.gold < state.expandCost) { toast('擴田要 ' + state.expandCost + ' 💰'); return false; }
    const locked = state.plots.filter(p => p.kind === 'locked');
    if (!locked.length) { toast('冇可擴嘅地'); return false; }
    // unlock nearest to existing soil
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
    // dtDays fractional day progress per tick
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

      // winter slows non-wheat
      if (state.seasonIdx === 3 && p.crop !== 'wheat') rate *= 0.55;
      // summer boosts
      if (state.seasonIdx === 1) rate *= 1.15;

      p.progress += rate * dtDays;
      while (p.progress >= 1 && p.stage < 4) {
        p.progress -= 1;
        p.stage++;
        p.watered = false; // need water again each stage if waterNeed
      }
    }
  }

  function dailyTick() {
    state.day++;
    if (state.day % 8 === 1 && state.day > 1) {
      state.seasonIdx = (state.seasonIdx + 1) % 4;
      toast(seasonName() + '到了');
    }
    // eat food
    const eat = 2 + Math.floor(state.unlockedCount / 6);
    state.food = Math.max(0, state.food - eat);
    if (state.food === 0) {
      toast('存糧見底！快種種糧');
    }
    state.daysSinceEvent++;
    maybeEvent();
    save();
  }

  function preferCrop() {
    const prefs = DIRS[state.directive].prefer;
    for (const id of prefs) {
      if (state.gold >= CROPS[id].seedCost) return id;
    }
    // fallback cheapest affordable
    const ids = Object.keys(CROPS).sort((a, b) => CROPS[a].seedCost - CROPS[b].seedCost);
    for (const id of ids) if (state.gold >= CROPS[id].seedCost) return id;
    return null;
  }

  function autoStep() {
    if (!state.auto) return;
    if (!document.getElementById('modal-event').hidden) return;

    const dir = DIRS[state.directive];

    // 1) harvest ripe
    for (const p of state.plots) harvestOne(p);

    // 2) water needs
    for (const p of state.plots) {
      if (p.kind === 'soil' && p.crop && p.stage > 0 && p.stage < 4) {
        const c = CROPS[p.crop];
        if ((c.waterNeed && !p.watered) || (!p.watered && Math.random() < 0.3)) water(p);
      }
    }

    // 3) sell surplus toward goal
    sellSurplus(dir.sellFoodKeep);

    // 4) expand if bias and affordable
    if (Math.random() < dir.expandBias && state.gold >= state.expandCost) {
      tryExpand();
    }

    // 5) plant empty
    const crop = preferCrop();
    if (crop) {
      const empties = state.plots.filter(canPlant);
      // plant up to 2 per step
      let n = 0;
      for (const p of empties) {
        if (n >= 2) break;
        if (plant(p, crop)) n++;
      }
    }

    document.getElementById('status-text').textContent =
      'AUTO：' + dir.label + ' · 種' + (CROPS[crop || 'rice'].name);
  }

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

  // ---- Input ----
  function canvasToPlot(ev) {
    const rect = canvas.getBoundingClientRect();
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const x = Math.floor((clientX - rect.left) / rect.width * COLS);
    const y = Math.floor((clientY - rect.top) / rect.height * ROWS);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
    return plotAt(x, y);
  }

  function onFarmTap(ev) {
    ev.preventDefault();
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
  let dayAcc = 0;
  let autoAcc = 0;
  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;

    // growth: 1 game-day ≈ 12 real seconds
    const dayLen = 12;
    dayAcc += dt;
    advanceGrowth(dt / dayLen);
    if (dayAcc >= dayLen) {
      dayAcc -= dayLen;
      dailyTick();
      updateHud();
    }

    autoAcc += dt;
    if (autoAcc >= 1.1) {
      autoAcc = 0;
      if (state.auto) {
        autoStep();
        updateHud();
      }
    }

    drawFarm();
    requestAnimationFrame(frame);
  }

  function startGame(fromSave) {
    state = fromSave ? load() : defaultState();
    if (!state) state = defaultState();
    selectedPlot = null;
    dayAcc = 0;
    autoAcc = 0;
    document.getElementById('screen-title').hidden = true;
    document.getElementById('screen-game').hidden = false;
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
    drawTitleArt();
  }

  // ---- Wire UI ----
  function wire() {
    document.getElementById('btn-start').onclick = () => {
      if (hasSave() && !confirm('開始新局會覆蓋存檔，確定？')) return;
      localStorage.removeItem(SAVE_KEY);
      startGame(false);
    };
    document.getElementById('btn-continue').onclick = () => startGame(true);
    document.getElementById('btn-continue').hidden = !hasSave();

    document.getElementById('btn-auto').onclick = () => {
      state.auto = !state.auto;
      toast(state.auto ? ('AUTO 開：' + DIRS[state.directive].label) : 'AUTO 關');
      updateHud();
      save();
    };
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

    canvas.addEventListener('click', onFarmTap);
    canvas.addEventListener('touchend', onFarmTap, { passive: false });

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

    // block weixin schemes
    document.addEventListener('click', e => {
      const a = e.target.closest('a');
      if (a && /^weixin:/i.test(a.getAttribute('href') || '')) {
        e.preventDefault();
      }
    }, true);
  }

  wire();
  drawTitleArt();
})();
