(() => {
  'use strict';

  const SAVE_KEY = 'qingqi_v1';
  const SETTINGS_KEY = 'qingqi_settings_v1';
  const COLS = 6;
  const ROWS = 7;
  const TILE = 52;
  const PLOT_COLS = 6;
  const HOUSE_CELLS = new Set(['1,1', '2,1']); // house footprint on scenic map
  const SEASON_CAPTIONS = ['春光滿村', '夏日茂盛', '秋獲將至', '冬雪守田'];

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
    const si = state.seasonIdx % 4;
    const tint = document.getElementById('season-tint');
    if (tint) tint.dataset.season = String(si);
    const cap = document.getElementById('scene-caption');
    if (cap) cap.textContent = SEASON_CAPTIONS[si];
    const soilN = state.plots.filter(p => p.kind === 'soil').length;
    const lockedN = state.plots.filter(p => p.kind === 'locked').length;
    const hint = document.getElementById('plot-hint');
    if (hint) hint.textContent = '已開 ' + soilN + ' 畦 · 可擴 ' + lockedN;
  }

  // ---- Drawing (compact plot strip over fields art) ----
  function farmablePlots() {
    return state.plots
      .filter(p => p.kind === 'soil' || p.kind === 'locked')
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }

  function drawSoilCell(px, py, s, plot) {
    const pad = 3;
    const x = px + pad, y = py + pad, w = s - pad * 2, h = s - pad * 2;
    const r = 8;

    // rounded rect helper
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

    // soil base
    roundRect(plot.watered ? '#6d4c41' : '#8d6e63', '#4e342e', 2);
    // furrows
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
    // soft panel so fields art shows through
    ctx.fillStyle = 'rgba(255,253,245,0.18)';
    ctx.fillRect(0, 0, w, h);

    cells.forEach((plot, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const px = pad + col * (s + gap);
      const py = pad + row * (s + gap);
      drawSoilCell(px, py, s, plot);
    });

    // stash layout for hit-testing
    canvas._layout = { cols, rows, gap, pad, s, cells };
  }

  function drawTitleArt() {
    // title uses CSS village background; no canvas
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
    // inside cell?
    const localX = (mx - pad) - col * (s + gap);
    const localY = (my - pad) - row * (s + gap);
    if (localX < 0 || localY < 0 || localX > s || localY > s) return null;
    const idx = row * cols + col;
    return cells[idx] || null;
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
