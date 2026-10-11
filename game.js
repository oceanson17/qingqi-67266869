(() => {
  'use strict';

  const SAVE_KEY = 'qingqi_v4';
  const SAVE_KEY_V3 = 'qingqi_v3';
  const SAVE_KEY_V2 = 'qingqi_v2';
  const SAVE_KEY_V1 = 'qingqi_v1';
  const SETTINGS_KEY = 'qingqi_settings_v1';
  const COLS = 6;
  const ROWS = 7;
  const TILE = 58;
  const PLOT_COLS = 6;
  const HOUSE_CELLS = new Set(['1,1', '2,1']);

  const SEASON_CAPTIONS = {
    farm: ['春光滿田', '夏日茂盛', '秋獲將至', '冬雪守田'],
    village: ['春光滿村', '夏日邨景', '秋色入村', '冬雪覆簷'],
    mine: ['礦洞微涼', '礦脈活躍', '岩層穩固', '洞內靜謐'],
    pond: ['塘面春波', '夏日魚躍', '秋水清澈', '冬塘微凍'],
    dungeon: ['副本入口', '焰影地牢', '深處回響', '寒窟寂靜'],
    ranch: ['春牧場暖', '夏草豐茂', '秋畜安穩', '冬棚守暖'],
    craft: ['春日灶香', '夏夜工坊', '秋成料理', '冬爐暖湯'],
  };
  const ASSET_V = '?v=v4';
  const SCENE_ART = {
    village: { webp: 'assets/bg_village.webp' + ASSET_V, jpg: 'assets/bg_village.jpg' + ASSET_V, alt: '青畦村落' },
    farm:    { webp: 'assets/bg_fields.webp' + ASSET_V,  jpg: 'assets/bg_fields.jpg' + ASSET_V,  alt: '田畦外景' },
    mine:    { webp: 'assets/bg_mine.webp' + ASSET_V,    jpg: 'assets/bg_mine.jpg' + ASSET_V,    alt: '礦洞' },
    pond:    { webp: 'assets/bg_pond.webp' + ASSET_V,    jpg: 'assets/bg_pond.jpg' + ASSET_V,    alt: '魚塘' },
    dungeon: { webp: 'assets/bg_dungeon.webp' + ASSET_V, jpg: 'assets/bg_dungeon.jpg' + ASSET_V, alt: '副本' },
    ranch:   { webp: 'assets/bg_fields.webp' + ASSET_V,  jpg: 'assets/bg_fields.jpg' + ASSET_V,  alt: '牧場' },
    craft:   { webp: 'assets/bg_town.webp' + ASSET_V,    jpg: 'assets/bg_town.jpg' + ASSET_V,    alt: '工坊' },
  };

  const SEASONS = ['春', '夏', '秋', '冬'];
  const CROPS = {
    rice:   { name: '稻', grow: 5, waterNeed: true, sell: 8, food: 6, seedCost: 3, color: '#8bc34a', ripe: '#fdd835' },
    veg:    { name: '菜', grow: 4, waterNeed: true, sell: 10, food: 3, seedCost: 4, color: '#66bb6a', ripe: '#43a047' },
    flower: { name: '花', grow: 3, waterNeed: false, sell: 14, food: 0, seedCost: 5, color: '#ec407a', ripe: '#f48fb1' },
    wheat:  { name: '麥', grow: 4, waterNeed: false, sell: 7, food: 5, seedCost: 3, color: '#dce775', ripe: '#fbc02d' },
  };
  const ORE = { ore: { name: '礦石', sell: 6 }, goldOre: { name: '金礦', sell: 22 } };
  const FISH = { fish: { name: '普通魚', sell: 5 }, rareFish: { name: '珍稀大魚', sell: 35 } };

  const DIRS = {
    grain:  { label: '多種糧', prefer: ['rice', 'wheat'], sellFoodKeep: 20, expandBias: 0.2 },
    money:  { label: '多賺錢', prefer: ['flower', 'veg'], sellFoodKeep: 8, expandBias: 0.35 },
    expand: { label: '擴田優先', prefer: ['flower', 'veg'], sellFoodKeep: 10, expandBias: 0.95 },
    winter: { label: '存糧過冬', prefer: ['wheat', 'rice'], sellFoodKeep: 40, expandBias: 0.1 },
  };

  const RARITIES = {
    white:  { id: 'white',  name: '白', className: 'rarity-white',  mult: 1,   sell: 8 },
    green:  { id: 'green',  name: '綠', className: 'rarity-green',  mult: 1.4, sell: 18 },
    blue:   { id: 'blue',   name: '藍', className: 'rarity-blue',   mult: 1.9, sell: 40 },
    purple: { id: 'purple', name: '紫', className: 'rarity-purple', mult: 2.6, sell: 90 },
    gold:   { id: 'gold',   name: '金', className: 'rarity-gold',   mult: 3.5, sell: 200 },
  };
  const RARITY_ORDER = ['white', 'green', 'blue', 'purple', 'gold'];

  const GEAR_BASE = {
    weapon: [
      { name: '木劍', atk: 3, def: 0, hp: 0 },
      { name: '鐵刃', atk: 5, def: 0, hp: 0 },
      { name: '青鋼刀', atk: 7, def: 0, hp: 2 },
      { name: '焰紋劍', atk: 9, def: 1, hp: 0 },
    ],
    armor: [
      { name: '布衣', atk: 0, def: 2, hp: 8 },
      { name: '皮甲', atk: 0, def: 4, hp: 12 },
      { name: '鐵鎧', atk: 0, def: 6, hp: 18 },
      { name: '龍紋甲', atk: 1, def: 8, hp: 24 },
    ],
    accessory: [
      { name: '草繩環', atk: 1, def: 0, hp: 4 },
      { name: '玉佩', atk: 1, def: 1, hp: 8 },
      { name: '護心鏡', atk: 2, def: 2, hp: 10 },
      { name: '金絲墜', atk: 3, def: 2, hp: 14 },
    ],
  };
  const SLOT_LABEL = { weapon: '武器', armor: '防具', accessory: '飾品' };

  const ENEMIES = [
    { name: '岩鼠', hp: 28, atk: 5 },
    { name: '焰蝠', hp: 34, atk: 7 },
    { name: '石傀', hp: 48, atk: 6 },
    { name: '影狼', hp: 42, atk: 9 },
    { name: '熔蟲', hp: 55, atk: 8 },
    { name: '骨衛', hp: 70, atk: 10 },
    { name: '炎魔侍', hp: 90, atk: 12 },
  ];

  const SKILLS = {
    atk:   { name: '攻擊', cd: 0, stamina: 0 },
    slash: { name: '青嵐斬', cd: 3.2, stamina: 4, mult: 1.85 },
    guard: { name: '護體', cd: 5.5, stamina: 3 },
    burst: { name: '爆裂', cd: 7.5, stamina: 8, mult: 2.8 },
  };

  // --- v4: ranch / craft / villagers / buildings / daily orders ---
  const ANIMAL_DEFS = {
    chicken: { name: '青羽雞', product: 'egg', productName: '雞蛋', sell: 9, feedNeed: 1, readyDays: 1, unlockGold: 60, icon: '🐔' },
    cow:     { name: '雲斑牛', product: 'milk', productName: '鮮奶', sell: 16, feedNeed: 2, readyDays: 2, unlockGold: 140, icon: '🐄' },
  };
  const RECIPES = [
    { id: 'riceBall', name: '稻香糰', needs: { rice: 2 }, out: { food: 8 }, gold: 0, heal: 0, desc: '回復存糧' },
    { id: 'vegSoup', name: '青菜湯', needs: { veg: 2, wheat: 1 }, out: { food: 6 }, gold: 0, heal: 18, desc: '戰鬥回血 18' },
    { id: 'fishMeal', name: '鮮魚膳', needs: { fish: 1, rice: 1 }, out: { food: 10 }, gold: 0, heal: 28, desc: '戰鬥回血 28' },
    { id: 'oreBrew', name: '礦泉劑', needs: { ore: 2, flower: 1 }, out: {}, gold: 0, heal: 40, potion: 'oreBrew', desc: '強效藥劑 · 回血 40' },
    { id: 'eggCake', name: '雞蛋糕', needs: { egg: 2, wheat: 1 }, out: { food: 12 }, gold: 0, heal: 22, desc: '牧場甜點 · 回血 22' },
    { id: 'milkTea', name: '暖奶飲', needs: { milk: 1, flower: 1 }, out: {}, gold: 0, heal: 35, potion: 'milkTea', desc: '暖身 · 回血 35' },
  ];
  const VILLAGERS = [
    { id: 'lin', name: '林青禾', role: '田間鄰人', likes: ['flower', 'veg', 'egg'], giftBoost: 12, unlockAt: 0, desc: '愛花菜與雞蛋，好感高時種子打折。' },
    { id: 'shi', name: '石阿鐵', role: '礦道匠人', likes: ['ore', 'goldOre', 'fish'], giftBoost: 14, unlockAt: 0, desc: '愛礦與魚，好感高時賣礦加價。' },
    { id: 'hua', name: '花小滿', role: '灶邊厨娘', likes: ['rareFish', 'milk', 'flower'], giftBoost: 16, unlockAt: 15, desc: '愛珍魚鮮奶，好感高解鎖料理。' },
  ];
  const BUILD_DEFS = {
    house: { name: '農舍', levels: [
      { cost: 0, label: '簡陋', maxPlotsBonus: 0, maxStaminaBonus: 0 },
      { cost: 80, label: '木屋', maxPlotsBonus: 2, maxStaminaBonus: 10 },
      { cost: 180, label: '青瓦', maxPlotsBonus: 4, maxStaminaBonus: 20 },
      { cost: 320, label: '大宅', maxPlotsBonus: 6, maxStaminaBonus: 35 },
    ]},
    warehouse: { name: '倉廩', levels: [
      { cost: 0, label: '小倉', bagCap: 40 },
      { cost: 70, label: '中倉', bagCap: 70 },
      { cost: 160, label: '大倉', bagCap: 110 },
      { cost: 280, label: '囤倉', bagCap: 160 },
    ]},
    anvil: { name: '鐵砧', levels: [
      { cost: 0, label: '石砧', reforgeBonus: 0 },
      { cost: 100, label: '鐵砧', reforgeBonus: 0.08 },
      { cost: 220, label: '精鋼', reforgeBonus: 0.15 },
      { cost: 400, label: '玄鐵', reforgeBonus: 0.25 },
    ]},
  };
  const ORDER_POOL = [
    { need: { rice: 4 }, rewardGold: 40, rewardFood: 2, title: '糧行急單' },
    { need: { veg: 3 }, rewardGold: 38, rewardFood: 1, title: '菜攤補貨' },
    { need: { flower: 3 }, rewardGold: 48, rewardFood: 0, title: '花市訂購' },
    { need: { wheat: 4 }, rewardGold: 36, rewardFood: 2, title: '磨坊麥單' },
    { need: { ore: 5 }, rewardGold: 42, rewardFood: 0, title: '鐵匠礦料' },
    { need: { fish: 3 }, rewardGold: 28, rewardFood: 1, title: '漁市活鮮' },
    { need: { egg: 3 }, rewardGold: 35, rewardFood: 1, title: '点心雞蛋' },
    { need: { milk: 2 }, rewardGold: 40, rewardFood: 0, title: '奶鋪急單' },
    { need: { rice: 2, veg: 2 }, rewardGold: 45, rewardFood: 3, title: '客棧配菜' },
    { need: { flower: 2, ore: 2 }, rewardGold: 55, rewardFood: 0, title: '行商雜貨' },
  ];
  const BOSS_DEFS = [
    { name: '岩層巨鼠王', hp: 120, atk: 11 },
    { name: '焰窟蝠后', hp: 160, atk: 14 },
    { name: '熔心石傀', hp: 210, atk: 16 },
    { name: '影谷狼主', hp: 260, atk: 19 },
    { name: '炎獄魔將', hp: 340, atk: 24 },
  ];


  const QUEST_DEFS = [
    { id: 'harvest_rice', title: '稻米初成', desc: '收成稻米 5 次', target: 5, reward: 30, track: 'riceHarvested' },
    { id: 'mine_ore', title: '礦洞初探', desc: '成功開挖 8 次', target: 8, reward: 40, track: 'minesDone' },
    { id: 'catch_rare', title: '釣上大魚', desc: '釣到珍稀大魚 1 條', target: 1, reward: 60, track: 'rareCaught' },
    { id: 'clear_dungeon', title: '初探副本', desc: '打通副本戰鬥 1 次', target: 1, reward: 80, track: 'dungeonsCleared' },
    { id: 'equip_blue', title: '藍裝加身', desc: '裝備一件藍色或以上裝備', target: 1, reward: 50, track: 'blueEquipped' },
    { id: 'collect_egg', title: '雞啼初鳴', desc: '收取雞蛋 5 枚', target: 5, reward: 45, track: 'eggsCollected' },
    { id: 'craft_meal', title: '灶火初燃', desc: '完成料理／藥劑 3 次', target: 3, reward: 50, track: 'craftsDone' },
    { id: 'friend_hearts', title: '鄉情漸暖', desc: '任一村民好感達 30', target: 1, reward: 60, track: 'friendMilestone' },
    { id: 'fill_orders', title: '日令達人', desc: '完成每日訂單 3 次', target: 3, reward: 55, track: 'ordersFilled' },
    { id: 'boss_slayer', title: '層主挑戰', desc: '擊敗層主 1 次', target: 1, reward: 100, track: 'bossesKilled' },
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
  let battle = null;
  let skillCds = { atk: 0, slash: 0, guard: 0, burst: 0 };
  let guardUntil = 0;

  function loadSettings() {
    try {
      return Object.assign({
        provider: 'none', model: 'deepseek-chat', apiKey: '',
      }, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
    } catch { return { provider: 'none', model: 'deepseek-chat', apiKey: '' }; }
  }
  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function defaultQuests() {
    return QUEST_DEFS.map(q => ({ id: q.id, progress: 0, claimed: false }));
  }


  function defaultState() {
    const plots = [];
    const unlocked = [[1,3],[2,3],[3,3],[1,4],[2,4],[3,4],[1,5],[2,5]];
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
        plots.push({ x, y, kind, crop: null, stage: 0, progress: 0, watered: false, wilt: 0 });
      }
    }
    return {
      day: 1, seasonIdx: 0, gold: 80, food: 12,
      stamina: 100, maxStamina: 100,
      auto: false, mode: 'farm', directive: 'grain',
      inventory: {
        rice: 0, veg: 0, flower: 0, wheat: 0,
        ore: 0, goldOre: 0, fish: 0, rareFish: 0,
        egg: 0, milk: 0, feed: 4,
        oreBrew: 0, milkTea: 0,
        pickaxe: 1, rod: 1,
      },
      plots,
      expandCost: 45, unlockedCount: unlocked.length, maxPlots: 18,
      eventCooldown: 8, daysSinceEvent: 0, log: [],
      stats: {
        riceHarvested: 0, minesDone: 0, rareCaught: 0, fishCaught: 0,
        dungeonsCleared: 0, blueEquipped: 0, monstersKilled: 0,
        eggsCollected: 0, milkCollected: 0, craftsDone: 0,
        friendMilestone: 0, ordersFilled: 0, bossesKilled: 0,
      },
      quests: defaultQuests(),
      achievements: {},
      gear: [],
      equipped: { weapon: null, armor: null, accessory: null },
      dungeonFloor: 1,
      dungeonBest: 0,
      nextGearId: 1,
      ranch: { unlocked: false, animals: [], feedReady: false },
      buildings: { house: 0, warehouse: 0, anvil: 0 },
      friendship: { lin: 0, shi: 0, hua: 0 },
      dailyOrder: null,
      dailyOrderDay: 0,
      potions: { oreBrew: 0, milkTea: 0 },
      version: 4,
    };
  }

  function emptyInv() {
    return {
      rice: 0, veg: 0, flower: 0, wheat: 0,
      ore: 0, goldOre: 0, fish: 0, rareFish: 0,
      egg: 0, milk: 0, feed: 0, oreBrew: 0, milkTea: 0,
      pickaxe: 1, rod: 1,
    };
  }
  function syncQuests(rawQuests) {
    const qmap = {};
    (rawQuests || []).forEach(q => { qmap[q.id] = q; });
    return QUEST_DEFS.map(d => qmap[d.id] || { id: d.id, progress: 0, claimed: false });
  }
  function migrateToV4(raw) {
    const base = defaultState();
    const merged = Object.assign(base, raw, {
      version: 4,
      stamina: raw.stamina != null ? raw.stamina : 100,
      maxStamina: raw.maxStamina || 100,
      mode: raw.mode || 'farm',
      stats: Object.assign({}, base.stats, raw.stats || {}),
      quests: syncQuests(raw.quests),
      achievements: raw.achievements || {},
      inventory: Object.assign(emptyInv(), raw.inventory || {}),
      gear: Array.isArray(raw.gear) ? raw.gear : [],
      equipped: Object.assign({ weapon: null, armor: null, accessory: null }, raw.equipped || {}),
      dungeonFloor: raw.dungeonFloor || 1,
      dungeonBest: raw.dungeonBest || 0,
      nextGearId: raw.nextGearId || 1,
      ranch: Object.assign({ unlocked: false, animals: [], feedReady: false }, raw.ranch || {}),
      buildings: Object.assign({ house: 0, warehouse: 0, anvil: 0 }, raw.buildings || {}),
      friendship: Object.assign({ lin: 0, shi: 0, hua: 0 }, raw.friendship || {}),
      dailyOrder: raw.dailyOrder || null,
      dailyOrderDay: raw.dailyOrderDay || 0,
      potions: Object.assign({ oreBrew: 0, milkTea: 0 }, raw.potions || {}),
    });
    // sync potions from inventory counts
    merged.potions.oreBrew = merged.inventory.oreBrew || merged.potions.oreBrew || 0;
    merged.potions.milkTea = merged.inventory.milkTea || merged.potions.milkTea || 0;
    applyBuildingBonuses(merged, true);
    return merged;
  }

  function applyBuildingBonuses(st, silent) {
    const h = BUILD_DEFS.house.levels[st.buildings.house || 0];
    const baseMax = 18;
    st.maxPlots = baseMax + (h.maxPlotsBonus || 0);
    const baseStam = 100 + (h.maxStaminaBonus || 0);
    if (!silent) {
      st.maxStamina = Math.max(st.maxStamina || 100, baseStam);
    } else {
      st.maxStamina = Math.max(st.maxStamina || 100, baseStam);
    }
  }

  function bagCap() {
    const w = BUILD_DEFS.warehouse.levels[state.buildings.warehouse || 0];
    return w.bagCap || 40;
  }
  function bagUsed() {
    let n = 0;
    const skip = { pickaxe: 1, rod: 1 };
    for (const [k, v] of Object.entries(state.inventory)) {
      if (skip[k]) continue;
      n += (v || 0);
    }
    return n;
  }
  function canAddInv(amount) {
    return bagUsed() + (amount || 1) <= bagCap();
  }

  function save() {
    if (!state) return;
    state.version = 4;
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }
  function hasSave() {
    try {
      return !!(localStorage.getItem(SAVE_KEY) || localStorage.getItem(SAVE_KEY_V3) ||
        localStorage.getItem(SAVE_KEY_V2) || localStorage.getItem(SAVE_KEY_V1));
    } catch { return false; }
  }
  function load() {
    try {
      let raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!raw) {
        for (const k of [SAVE_KEY_V3, SAVE_KEY_V2, SAVE_KEY_V1]) {
          const prev = JSON.parse(localStorage.getItem(k) || 'null');
          if (prev && prev.plots) {
            raw = migrateToV4(prev);
            localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
            break;
          }
        }
      }
      if (!raw || !raw.plots) return null;
      if ((raw.version || 1) < 4) raw = migrateToV4(raw);
      else {
        raw.inventory = Object.assign(emptyInv(), raw.inventory || {});
        raw.stats = Object.assign({
          riceHarvested: 0, minesDone: 0, rareCaught: 0, fishCaught: 0,
          dungeonsCleared: 0, blueEquipped: 0, monstersKilled: 0,
          eggsCollected: 0, milkCollected: 0, craftsDone: 0,
          friendMilestone: 0, ordersFilled: 0, bossesKilled: 0,
        }, raw.stats || {});
        raw.quests = syncQuests(raw.quests);
        if (!raw.ranch) raw.ranch = { unlocked: false, animals: [], feedReady: false };
        if (!raw.buildings) raw.buildings = { house: 0, warehouse: 0, anvil: 0 };
        if (!raw.friendship) raw.friendship = { lin: 0, shi: 0, hua: 0 };
        if (raw.dailyOrder === undefined) raw.dailyOrder = null;
        if (!raw.potions) raw.potions = { oreBrew: 0, milkTea: 0 };
        applyBuildingBonuses(raw, true);
      }
      if (raw.stamina == null) raw.stamina = 100;
      if (!raw.maxStamina) raw.maxStamina = 100;
      if (!raw.mode) raw.mode = 'farm';
      if (!raw.achievements) raw.achievements = {};
      if (!Array.isArray(raw.gear)) raw.gear = [];
      if (!raw.equipped) raw.equipped = { weapon: null, armor: null, accessory: null };
      if (!raw.dungeonFloor) raw.dungeonFloor = 1;
      if (!raw.dungeonBest) raw.dungeonBest = 0;
      if (!raw.nextGearId) raw.nextGearId = 1;
      raw.version = 4;
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
  function syncAutoButtons() {
    document.querySelectorAll('.auto-btn').forEach(b => b.classList.toggle('on', state.auto));
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


  function getEquippedItem(slot) {
    const id = state.equipped[slot];
    if (!id) return null;
    return state.gear.find(g => g.id === id) || null;
  }
  function combatStats() {
    let atk = 8, def = 2, hp = 80;
    for (const slot of ['weapon', 'armor', 'accessory']) {
      const g = getEquippedItem(slot);
      if (!g) continue;
      atk += g.atk || 0;
      def += g.def || 0;
      hp += g.hp || 0;
    }
    return { atk, def, maxHp: hp };
  }
  function yieldBonus() {
    const { atk, def } = combatStats();
    return 1 + Math.min(0.35, (atk + def) / 120);
  }
  function rollRarity(floor) {
    const f = Math.max(1, floor);
    const weights = {
      white: Math.max(5, 55 - f * 6),
      green: Math.max(8, 28 - f * 1),
      blue: 10 + f * 2,
      purple: Math.max(0, f * 1.5 - 1),
      gold: Math.max(0, f * 0.45 - 1.5),
    };
    let total = 0;
    for (const k of RARITY_ORDER) total += weights[k];
    let r = Math.random() * total;
    for (const k of RARITY_ORDER) {
      r -= weights[k];
      if (r <= 0) return k;
    }
    return 'white';
  }
  function createGear(floor) {
    const slots = ['weapon', 'armor', 'accessory'];
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const pool = GEAR_BASE[slot];
    const bi = Math.min(pool.length - 1, Math.floor(Math.random() * pool.length) + Math.floor((floor - 1) / 3));
    const base = pool[bi];
    const rarity = rollRarity(floor);
    const m = RARITIES[rarity].mult;
    const jitter = () => 0.85 + Math.random() * 0.3;
    const gear = {
      id: 'g' + (state.nextGearId++),
      slot, name: base.name, rarity,
      atk: Math.max(0, Math.round(base.atk * m * jitter())),
      def: Math.max(0, Math.round(base.def * m * jitter())),
      hp: Math.max(0, Math.round(base.hp * m * jitter())),
      sell: Math.round(RARITIES[rarity].sell * (0.9 + Math.random() * 0.3)),
    };
    state.gear.push(gear);
    if (rarity === 'gold' && !state.achievements.goldGear) {
      state.achievements.goldGear = true;
      showAchievement('金裝臨身', '你獲得了第一件金色裝備「' + gear.name + '」！金光閃閃，村人側目。');
    }
    return gear;
  }
  function equipGear(gearId) {
    const g = state.gear.find(x => x.id === gearId);
    if (!g) return;
    state.equipped[g.slot] = g.id;
    if (RARITY_ORDER.indexOf(g.rarity) >= 2) bumpQuest('blueEquipped', 1);
    toast('裝備了「' + g.name + '」（' + RARITIES[g.rarity].name + '）');
    updateHud(); save();
  }
  function unequipSlot(slot) {
    state.equipped[slot] = null;
    updateHud(); save();
  }

  function setMode(mode) {
    if (!['farm', 'village', 'mine', 'pond', 'dungeon', 'ranch', 'craft'].includes(mode)) return;
    if (battle && battle.active && mode !== 'dungeon') {
      toast('戰鬥中不能離開副本，請先撤退');
      return;
    }
    state.mode = mode;
    document.querySelectorAll('.mode-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === mode);
    });
    const adv = document.getElementById('adventure-scene');
    adv.classList.toggle('mode-farm', mode === 'farm');
    adv.classList.toggle('in-battle', !!(battle && battle.active));

    const art = SCENE_ART[mode] || SCENE_ART.village;
    document.getElementById('scene-webp').srcset = art.webp;
    document.getElementById('scene-img').src = art.jpg;
    document.getElementById('scene-img').alt = art.alt;

    document.getElementById('plot-card').hidden = mode !== 'farm';
    document.getElementById('farm-panel').hidden = mode !== 'farm';
    document.getElementById('village-panel').hidden = mode !== 'village';
    document.getElementById('mine-panel').hidden = mode !== 'mine';
    document.getElementById('pond-panel').hidden = mode !== 'pond';
    document.getElementById('dungeon-panel').hidden = mode !== 'dungeon';
    const ranchP = document.getElementById('ranch-panel');
    const craftP = document.getElementById('craft-panel');
    if (ranchP) ranchP.hidden = mode !== 'ranch';
    if (craftP) craftP.hidden = mode !== 'craft';

    const inBattle = !!(battle && battle.active);
    const showPad = (mode === 'mine' || mode === 'pond') && !inBattle;
    document.getElementById('dpad').hidden = !showPad;
    document.getElementById('action-cluster').hidden = !showPad;
    document.getElementById('skill-cluster').hidden = !(mode === 'dungeon' && inBattle);
    document.getElementById('battle-hud').hidden = !(mode === 'dungeon' && inBattle);
    document.getElementById('btn-flee').hidden = !inBattle;
    document.getElementById('btn-enter-dungeon').hidden = inBattle;

    const captions = SEASON_CAPTIONS[mode] || SEASON_CAPTIONS.village;
    const si = state.seasonIdx % 4;
    document.getElementById('scene-caption').textContent = captions[si];
    document.getElementById('season-tint').dataset.season = String(si);
    updateSeasonBanner();

    const status = document.getElementById('status-text');
    if (mode === 'farm') status.textContent = '點田操作，或開 AUTO';
    else if (mode === 'village') status.textContent = '村落 · 訂單／鄉人／建築';
    else if (mode === 'mine') status.textContent = '開挖採礦 · AUTO 可代勞';
    else if (mode === 'pond') status.textContent = '拋竿釣魚 · AUTO 可代勞';
    else if (mode === 'ranch') status.textContent = '牧場 · 餵食與收取產物';
    else if (mode === 'craft') status.textContent = '工坊 · 料理與藥劑';
    else status.textContent = inBattle ? '戰鬥中！' : '進入副本 · 每 5 層有層主';

    if (mode === 'ranch') renderRanch();
    if (mode === 'craft') renderCraft();
    if (mode === 'village') renderVillageExtras();
    updateModeStats();
    updateHud();
    if (mode === 'farm') drawFarm();
    if (inBattle) updateBattleHud();
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
    document.getElementById('dung-floor-label').textContent = '層數 ' + state.dungeonFloor + (isBossFloor(state.dungeonFloor) ? '·主' : '');
    document.getElementById('dung-best-label').textContent = '最高 ' + state.dungeonBest;
    document.getElementById('dung-gear-label').textContent = '裝備 ' + state.gear.length;
  }

  function updateHud() {
    if (!state) return;
    const cs = combatStats();
    document.getElementById('hud-day').textContent = seasonName() + ' · 第' + state.day + '日';
    document.getElementById('hud-gold').textContent = '銀 ' + state.gold;
    document.getElementById('hud-food').textContent = '糧 ' + state.food;
    const bagEl = document.getElementById('hud-bagcap');
    if (bagEl) bagEl.textContent = '倉 ' + bagUsed() + '/' + bagCap();
    const hpNow = battle && battle.active ? battle.playerHp : cs.maxHp;
    document.getElementById('hud-combat').textContent = 'HP ' + Math.floor(hpNow) + ' · ATK ' + cs.atk;
    const al = document.getElementById('auto-label');
    const modeLabel = { farm: '種田', village: '村落', mine: '挖礦', pond: '釣魚', dungeon: '副本', ranch: '牧場', craft: '工坊' }[state.mode] || '';
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
    updateSeasonBanner();
    const soilN = state.plots.filter(p => p.kind === 'soil').length;
    const lockedN = state.plots.filter(p => p.kind === 'locked').length;
    const hint = document.getElementById('plot-hint');
    if (hint) hint.textContent = '已開 ' + soilN + ' 畦 · 可擴 ' + lockedN;
    updateModeStats();
    updateQuestDot();
    updateSkillCdsUi();
  }

  function updateSkillCdsUi() {
    for (const id of ['slash', 'guard', 'burst']) {
      const el = document.getElementById('cd-' + id);
      const btn = document.querySelector('.skill-btn[data-skill="' + id + '"]');
      if (!el || !btn) continue;
      if (skillCds[id] > 0) {
        btn.classList.add('on-cd');
        el.textContent = Math.ceil(skillCds[id]);
      } else {
        btn.classList.remove('on-cd');
        el.textContent = '';
      }
    }
  }


  function farmablePlots() {
    return state.plots
      .filter(p => p.kind === 'soil' || p.kind === 'locked')
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }
  function roundRectPath(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  function drawSparkle(cx, cy, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fffde7';
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size * 0.28, cy - size * 0.28);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx + size * 0.28, cy + size * 0.28);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size * 0.28, cy + size * 0.28);
    ctx.lineTo(cx - size, cy);
    ctx.lineTo(cx - size * 0.28, cy - size * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function drawCropSprite(cx, baseY, crop, stage, t) {
    const c = CROPS[crop];
    if (stage === 1) {
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(cx - 1.5, baseY - 6, 3, 8);
      ctx.fillStyle = '#c5e1a5';
      ctx.beginPath();
      ctx.ellipse(cx - 4, baseY - 8, 5, 3, -0.5, 0, Math.PI * 2);
      ctx.ellipse(cx + 4, baseY - 8, 5, 3, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8bc34a';
      ctx.beginPath(); ctx.arc(cx, baseY - 10, 3.2, 0, Math.PI * 2); ctx.fill();
    } else if (stage === 2) {
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(cx - 2, baseY - 14, 4, 14);
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.ellipse(cx - 9, baseY - 12, 8, 5, -0.55, 0, Math.PI * 2);
      ctx.ellipse(cx + 9, baseY - 12, 8, 5, 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath(); ctx.ellipse(cx, baseY - 18, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
    } else if (stage === 3) {
      for (let i = -1; i <= 1; i++) {
        const sx = cx + i * 11;
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(sx - 2, baseY - 22, 4, 22);
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.moveTo(sx, baseY - 28);
        ctx.quadraticCurveTo(sx - 10, baseY - 16, sx - 3, baseY - 6);
        ctx.lineTo(sx + 3, baseY - 6);
        ctx.quadraticCurveTo(sx + 10, baseY - 16, sx, baseY - 28);
        ctx.fill();
      }
    } else {
      for (let i = -1; i <= 1; i++) {
        const sx = cx + i * 11;
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(sx - 2.5, baseY - 26, 5, 26);
        const grd = ctx.createLinearGradient(sx, baseY - 34, sx, baseY - 8);
        grd.addColorStop(0, c.ripe);
        grd.addColorStop(1, c.color);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(sx, baseY - 36);
        ctx.quadraticCurveTo(sx - 12, baseY - 18, sx - 4, baseY - 6);
        ctx.lineTo(sx + 4, baseY - 6);
        ctx.quadraticCurveTo(sx + 12, baseY - 18, sx, baseY - 36);
        ctx.fill();
      }
      const pulse = 0.55 + 0.45 * Math.sin(t * 0.006);
      drawSparkle(cx - 12, baseY - 30, 5, pulse);
      drawSparkle(cx + 10, baseY - 22, 4, 1 - pulse * 0.6);
      drawSparkle(cx + 2, baseY - 38, 3.5, pulse * 0.8);
    }
  }
  function drawSoilCell(px, py, s, plot) {
    const t = performance.now();
    const outer = 2;
    const frame = 4;
    const ix = px + outer + frame;
    const iy = py + outer + frame;
    const iw = s - (outer + frame) * 2;
    const ih = s - (outer + frame) * 2;
    const selected = selectedPlot && selectedPlot.x === plot.x && selectedPlot.y === plot.y;

    // Wood/stone outer frame
    roundRectPath(px + 1, py + 1, s - 2, s - 2, 10);
    ctx.fillStyle = selected ? '#c9a227' : '#6d4c41';
    ctx.fill();
    roundRectPath(px + 3, py + 3, s - 6, s - 6, 8);
    const frameGrad = ctx.createLinearGradient(px, py, px + s, py + s);
    frameGrad.addColorStop(0, '#bcaaa4');
    frameGrad.addColorStop(0.35, '#8d6e63');
    frameGrad.addColorStop(0.7, '#5d4037');
    frameGrad.addColorStop(1, '#4e342e');
    ctx.fillStyle = frameGrad;
    ctx.fill();
    // Stone studs on corners
    ctx.fillStyle = '#d7ccc8';
    [[6, 6], [s - 10, 6], [6, s - 10], [s - 10, s - 10]].forEach(([sx, sy]) => {
      ctx.beginPath(); ctx.arc(px + sx + 2, py + sy + 2, 2.2, 0, Math.PI * 2); ctx.fill();
    });

    if (plot.kind === 'locked') {
      roundRectPath(ix, iy, iw, ih, 6);
      ctx.fillStyle = '#a5d6a7';
      ctx.fill();
      const mist = ctx.createLinearGradient(ix, iy, ix, iy + ih);
      mist.addColorStop(0, 'rgba(232,245,233,0.85)');
      mist.addColorStop(0.5, 'rgba(165,214,167,0.55)');
      mist.addColorStop(1, 'rgba(129,199,132,0.75)');
      ctx.fillStyle = mist;
      ctx.fill();
      // soft fog wisps
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 4; i++) {
        const fy = iy + 8 + i * 10 + Math.sin(t * 0.002 + i) * 2;
        ctx.beginPath();
        ctx.ellipse(ix + iw * 0.5, fy, iw * 0.38, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // locked stone pad
      roundRectPath(ix + iw * 0.28, iy + ih * 0.28, iw * 0.44, ih * 0.42, 5);
      ctx.fillStyle = '#78909c';
      ctx.fill();
      ctx.strokeStyle = '#455a64';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffe082';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', px + s / 2, py + s / 2 + 1);
      ctx.fillStyle = 'rgba(62,39,35,0.7)';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('擴田', px + s / 2, py + s - 9);
      if (selected) {
        roundRectPath(px + 2, py + 2, s - 4, s - 4, 10);
        ctx.strokeStyle = '#ffeb3b';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      return;
    }

    // Soil bed
    roundRectPath(ix, iy, iw, ih, 6);
    const soilGrad = ctx.createLinearGradient(ix, iy, ix, iy + ih);
    if (plot.watered) {
      soilGrad.addColorStop(0, '#5d4037');
      soilGrad.addColorStop(0.5, '#4e342e');
      soilGrad.addColorStop(1, '#3e2723');
    } else {
      soilGrad.addColorStop(0, '#a1887f');
      soilGrad.addColorStop(0.45, '#8d6e63');
      soilGrad.addColorStop(1, '#6d4c41');
    }
    ctx.fillStyle = soilGrad;
    ctx.fill();

    // Furrows / soil texture
    ctx.save();
    ctx.beginPath();
    roundRectPath(ix, iy, iw, ih, 6);
    ctx.clip();
    for (let i = 0; i < 4; i++) {
      const fy = iy + 7 + i * ((ih - 10) / 3.2);
      ctx.strokeStyle = plot.watered ? 'rgba(33,150,243,0.22)' : 'rgba(62,39,35,0.28)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ix + 4, fy);
      ctx.quadraticCurveTo(ix + iw * 0.5, fy + (i % 2 ? 2 : -2), ix + iw - 4, fy);
      ctx.stroke();
    }
    // crumbly dots
    ctx.fillStyle = plot.watered ? 'rgba(100,181,246,0.25)' : 'rgba(62,39,35,0.2)';
    for (let i = 0; i < 12; i++) {
      const dx = ix + 4 + ((i * 17 + plot.x * 13) % (iw - 8));
      const dy = iy + 4 + ((i * 11 + plot.y * 7) % (ih - 8));
      ctx.fillRect(dx, dy, 2, 2);
    }

    // Watered shimmer
    if (plot.watered) {
      const shimmer = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
      const shift = (Math.sin(t * 0.004 + plot.x + plot.y) + 1) * 0.5;
      shimmer.addColorStop(Math.max(0, shift - 0.2), 'rgba(129,212,250,0)');
      shimmer.addColorStop(shift, 'rgba(179,229,252,0.45)');
      shimmer.addColorStop(Math.min(1, shift + 0.2), 'rgba(129,212,250,0)');
      ctx.fillStyle = shimmer;
      ctx.fillRect(ix, iy, iw, ih);
      ctx.fillStyle = 'rgba(227,242,253,0.35)';
      for (let i = 0; i < 3; i++) {
        const bx = ix + 6 + i * 12 + Math.sin(t * 0.005 + i) * 3;
        const by = iy + 8 + ((i * 9 + t * 0.02) % (ih - 14));
        ctx.beginPath(); ctx.ellipse(bx, by, 3, 1.5, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // Inner highlight rim
    roundRectPath(ix + 0.5, iy + 0.5, iw - 1, ih - 1, 5);
    ctx.strokeStyle = plot.watered ? 'rgba(100,181,246,0.55)' : 'rgba(215,204,200,0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Crop
    if (plot.crop && plot.stage > 0) {
      const c = CROPS[plot.crop];
      const cx = px + s / 2;
      const baseY = py + s * 0.72;
      drawCropSprite(cx, baseY, plot.crop, plot.stage, t);
      // name chip
      const label = c.name;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label).width + 10;
      const ly = py + s - 11;
      roundRectPath(cx - tw / 2, ly - 7, tw, 14, 7);
      ctx.fillStyle = plot.stage >= 4 ? 'rgba(255,236,179,0.92)' : 'rgba(255,253,245,0.88)';
      ctx.fill();
      ctx.strokeStyle = plot.stage >= 4 ? '#f9a825' : 'rgba(93,64,55,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = plot.stage >= 4 ? '#e65100' : '#4e342e';
      ctx.fillText(label, cx, ly);
      // growth pips
      const pipY = iy + 5;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(ix + 7 + i * 8, pipY, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = i < plot.stage ? (plot.stage >= 4 ? '#ffb300' : '#81c784') : 'rgba(0,0,0,0.2)';
        ctx.fill();
      }
    } else {
      // empty soil hint
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('空畦', px + s / 2, py + s / 2);
    }

    if (selected) {
      roundRectPath(px + 1.5, py + 1.5, s - 3, s - 3, 10);
      ctx.strokeStyle = '#ffeb3b';
      ctx.lineWidth = 2.8;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,236,179,0.5)';
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  }
  function drawFarm() {
    if (!state) return;
    const cells = farmablePlots();
    const cols = PLOT_COLS;
    const rows = Math.max(2, Math.ceil(cells.length / cols));
    const gap = 6, pad = 10, s = TILE;
    const w = pad * 2 + cols * s + (cols - 1) * gap;
    const h = pad * 2 + rows * s + (rows - 1) * gap;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    // soft parchment wash over fields backdrop
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, 'rgba(255,253,245,0.12)');
    wash.addColorStop(1, 'rgba(232,212,168,0.22)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    // decorative path line between rows
    ctx.strokeStyle = 'rgba(158,158,158,0.25)';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 6]);
    for (let r = 1; r < rows; r++) {
      const yy = pad + r * s + (r - 0.5) * gap;
      ctx.beginPath();
      ctx.moveTo(pad, yy);
      ctx.lineTo(w - pad, yy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    cells.forEach((plot, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      drawSoilCell(pad + col * (s + gap), pad + row * (s + gap), s, plot);
    });
    canvas._layout = { cols, rows, gap, pad, s, cells };
  }

  function canPlant(plot) { return plot.kind === 'soil' && (!plot.crop || plot.stage === 0); }
  function plant(plot, cropId) {
    const c = CROPS[cropId];
    if (!c || !canPlant(plot)) return false;
    const cost = Math.max(1, Math.ceil(c.seedCost * seedDiscount()));
    if (state.gold < cost) { toast('銀兩不夠買種子'); return false; }
    state.gold -= cost;
    plot.crop = cropId; plot.stage = 1; plot.progress = 0; plot.watered = false; plot.wilt = 0;
    return true;
  }
  function water(plot) {
    if (plot.kind !== 'soil' || !plot.crop || plot.stage >= 4 || plot.watered) return false;
    plot.watered = true; plot.wilt = 0; return true;
  }
  function waterAll() {
    let n = 0;
    for (const p of state.plots) if (water(p)) n++;
    toast(n ? ('澆咗 ' + n + ' 畦') : '冇需要澆嘅田');
  }
  function harvestOne(plot) {
    if (plot.kind !== 'soil' || !plot.crop || plot.stage < 4) return false;
    const c = CROPS[plot.crop], cropId = plot.crop;
    state.inventory[cropId] = (state.inventory[cropId] || 0) + 1;
    state.food += c.food;
    if (cropId === 'rice') bumpQuest('riceHarvested', 1);
    const name = c.name;
    plot.crop = null; plot.stage = 0; plot.progress = 0; plot.watered = false; plot.wilt = 0;
    return name;
  }
  function harvestAll() {
    const got = {};
    for (const p of state.plots) { const n = harvestOne(p); if (n) got[n] = (got[n] || 0) + 1; }
    const parts = Object.keys(got).map(k => k + '×' + got[k]);
    toast(parts.length ? ('收成：' + parts.join('、')) : '未有成熟作物');
  }
  function sellSurplus(keepFood) {
    let gained = 0;
    for (const id of ['flower', 'veg', 'rice', 'wheat']) {
      let count = state.inventory[id] || 0;
      if (!count) continue;
      const c = CROPS[id];
      while (count > 0) {
        if (c.food > 0 && state.food - c.food < keepFood) break;
        state.inventory[id]--; count--;
        if (c.food > 0) state.food = Math.max(0, state.food - c.food);
        state.gold += c.sell; gained += c.sell;
      }
    }
    return gained;
  }
  function sellInventoryAll() {
    let total = 0;
    for (const id of Object.keys(CROPS)) {
      while ((state.inventory[id] || 0) > 0) { state.inventory[id]--; state.gold += CROPS[id].sell; total += CROPS[id].sell; }
    }
    for (const id of Object.keys(ORE)) {
      while ((state.inventory[id] || 0) > 0) { state.inventory[id]--; state.gold += ORE[id].sell; total += ORE[id].sell; }
    }
    for (const id of Object.keys(FISH)) {
      while ((state.inventory[id] || 0) > 0) { state.inventory[id]--; state.gold += FISH[id].sell; total += FISH[id].sell; }
    }
    toast(total > 0 ? ('賣出 +' + total + ' 銀') : '倉庫空空');
    return total;
  }
  function tryExpand() {
    if (state.unlockedCount >= state.maxPlots) { toast('田已開滿'); return false; }
    if (state.gold < state.expandCost) { toast('擴田要 ' + state.expandCost + ' 銀'); return false; }
    const locked = state.plots.filter(p => p.kind === 'locked');
    if (!locked.length) { toast('冇可擴嘅地'); return false; }
    locked.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const p = locked[0];
    state.gold -= state.expandCost; p.kind = 'soil'; state.unlockedCount++;
    state.expandCost = Math.floor(state.expandCost * 1.35) + 5;
    toast('新開一畦田！下次 ' + state.expandCost + ' 銀');
    return true;
  }
  function advanceGrowth(dtDays) {
    for (const p of state.plots) {
      if (p.kind !== 'soil' || !p.crop || p.stage <= 0 || p.stage >= 4) continue;
      const c = CROPS[p.crop];
      let rate = 1 / c.grow;
      if (c.waterNeed) {
        if (p.watered) rate *= 1.6;
        else { p.wilt += dtDays; if (p.wilt > 1.2) rate *= 0.35; }
      } else if (p.watered) rate *= 1.25;
      if (state.seasonIdx === 3 && p.crop !== 'wheat') rate *= 0.55;
      if (state.seasonIdx === 1) rate *= 1.15;
      p.progress += rate * dtDays;
      while (p.progress >= 1 && p.stage < 4) { p.progress -= 1; p.stage++; p.watered = false; }
    }
  }
  function dailyTick() {
    state.day++;
    if (state.day % 8 === 1 && state.day > 1) {
      state.seasonIdx = (state.seasonIdx + 1) % 4;
      toast(seasonName() + '到了 · ' + seasonLabelFull());
    }
    const eat = 2 + Math.floor(state.unlockedCount / 6) + Math.floor((state.ranch.animals || []).length / 2);
    state.food = Math.max(0, state.food - eat);
    if (state.food === 0) toast('存糧見底！快種種糧');
    state.stamina = Math.min(state.maxStamina, state.stamina + 25);
    ranchDailyTick();
    ensureDailyOrder();
    state.daysSinceEvent++;
    maybeEvent();
    updateSeasonBanner();
    save();
  }
  function preferCrop() {
    const costOf = id => Math.max(1, Math.ceil(CROPS[id].seedCost * seedDiscount()));
    for (const id of DIRS[state.directive].prefer) if (state.gold >= costOf(id)) return id;
    const ids = Object.keys(CROPS).sort((a, b) => CROPS[a].seedCost - CROPS[b].seedCost);
    for (const id of ids) if (state.gold >= costOf(id)) return id;
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
      let n = 0;
      for (const p of state.plots.filter(canPlant)) { if (n >= 2) break; if (plant(p, crop)) n++; }
    }
    document.getElementById('status-text').textContent =
      'AUTO：' + dir.label + ' · 種' + (CROPS[crop || 'rice'].name);
  }


  function doMine(silent) {
    if (state.mode !== 'mine' && !silent) return false;
    if (mineCd > 0) { if (!silent) toast('稍候再挖'); return false; }
    if (state.stamina < 8) { if (!silent) toast('體力不足，先歇息'); return false; }
    state.stamina -= 8; mineCd = 1.4; bumpQuest('minesDone', 1);
    const bonus = yieldBonus();
    const roll = Math.random();
    let msg;
    if (roll < 0.08 * Math.min(1.4, bonus)) {
      state.inventory.goldOre = (state.inventory.goldOre || 0) + 1;
      msg = '挖到金礦！'; showHint('✨ 金礦');
    } else if (roll < 0.18) {
      const n = bonus > 1.15 ? 3 : 2;
      state.inventory.ore = (state.inventory.ore || 0) + n;
      state.gold += 3; msg = '礦脈豐收 +' + n + ' 礦石'; showHint('礦脈！');
    } else if (roll < 0.92) {
      state.inventory.ore = (state.inventory.ore || 0) + 1;
      msg = '挖到礦石 +1'; showHint('叮！');
    } else { msg = '只挖到碎石…'; showHint('…'); }
    if (!silent) toast(msg);
    updateHud(); save(); return true;
  }
  function sellOre() {
    let total = 0;
    const mult = oreSellBonus();
    for (const id of Object.keys(ORE)) {
      while ((state.inventory[id] || 0) > 0) {
        state.inventory[id]--;
        const pay = Math.round(ORE[id].sell * mult);
        state.gold += pay; total += pay;
      }
    }
    toast(total ? ('賣礦 +' + total + ' 銀' + (mult > 1 ? '（匠人加價）' : '')) : '冇礦可賣'); updateHud(); save();
  }
  function restStamina() {
    if (state.stamina >= state.maxStamina) { toast('體力已滿'); return; }
    state.stamina = Math.min(state.maxStamina, state.stamina + 20);
    toast('歇息 +20 體力'); updateHud(); save();
  }
  function showAchievement(title, body) {
    document.getElementById('achieve-title').textContent = title;
    document.getElementById('achieve-body').textContent = body;
    document.getElementById('modal-achieve').hidden = false;
  }
  function doFish(silent) {
    if (state.mode !== 'pond' && !silent) return false;
    if (fishCd > 0) { if (!silent) toast('魚線未收好'); return false; }
    if (state.stamina < 6) { if (!silent) toast('體力不足，先歇息'); return false; }
    state.stamina -= 6; fishCd = 1.8;
    state.stats.fishCaught = (state.stats.fishCaught || 0) + 1;
    const rareChance = 0.12 * Math.min(1.5, yieldBonus());
    const roll = Math.random();
    if (roll < rareChance) {
      state.inventory.rareFish = (state.inventory.rareFish || 0) + 1;
      bumpQuest('rareCaught', 1); showHint('🐟 大魚！');
      if (!silent) toast('釣到珍稀大魚！');
      if (!state.achievements.rareFish) {
        state.achievements.rareFish = true;
        showAchievement('釣獲珍魚', '你在青畦魚塘釣上罕見大魚，鄉里傳為美談。');
      }
    } else if (roll < 0.78) {
      state.inventory.fish = (state.inventory.fish || 0) + 1;
      showHint('上鉤'); if (!silent) toast('釣到普通魚 +1');
    } else if (roll < 0.9) {
      state.inventory.fish = (state.inventory.fish || 0) + 2;
      showHint('連上兩條'); if (!silent) toast('好運！魚 ×2');
    } else { showHint('空竿'); if (!silent) toast('空竿一回'); }
    updateHud(); save(); return true;
  }
  function sellFish() {
    let total = 0;
    for (const id of Object.keys(FISH)) {
      while ((state.inventory[id] || 0) > 0) { state.inventory[id]--; state.gold += FISH[id].sell; total += FISH[id].sell; }
    }
    toast(total ? ('賣魚 +' + total + ' 銀') : '冇魚可賣'); updateHud(); save();
  }

  /* ========== v4 systems ========== */
  function seasonLabelFull() {
    return ['春暖', '夏盛', '秋收', '冬藏'][state.seasonIdx % 4] + ' · ' + seasonName();
  }
  function updateSeasonBanner() {
    const el = document.getElementById('season-banner');
    if (!el) return;
    el.dataset.season = String(state.seasonIdx % 4);
    el.textContent = seasonLabelFull() + ' · 第' + state.day + '日';
  }

  function ensureDailyOrder() {
    if (state.dailyOrder && state.dailyOrderDay === state.day) return;
    const pool = ORDER_POOL.slice();
    const pick = pool[Math.floor(Math.random() * pool.length)];
    state.dailyOrder = {
      title: pick.title,
      need: Object.assign({}, pick.need),
      rewardGold: pick.rewardGold + Math.floor(state.day / 10) * 3,
      rewardFood: pick.rewardFood,
      filled: false,
    };
    state.dailyOrderDay = state.day;
  }
  function canFillOrder() {
    ensureDailyOrder();
    const o = state.dailyOrder;
    if (!o || o.filled) return false;
    for (const [k, n] of Object.entries(o.need)) {
      if ((state.inventory[k] || 0) < n) return false;
    }
    return true;
  }
  function fillDailyOrder(silent) {
    ensureDailyOrder();
    const o = state.dailyOrder;
    if (!o || o.filled) { if (!silent) toast('今日訂單已完成'); return false; }
    if (!canFillOrder()) { if (!silent) toast('材料未齊'); return false; }
    for (const [k, n] of Object.entries(o.need)) state.inventory[k] -= n;
    // friendship discount from Lin
    let gold = o.rewardGold;
    if ((state.friendship.lin || 0) >= 40) gold = Math.round(gold * 1.1);
    state.gold += gold;
    state.food += o.rewardFood || 0;
    o.filled = true;
    bumpQuest('ordersFilled', 1);
    if (!silent) toast('交單「' + o.title + '」+' + gold + '銀');
    if (!state.achievements.firstOrder) {
      state.achievements.firstOrder = true;
      showAchievement('日令初成', '你完成了第一份村落日令看板訂單。');
    }
    updateHud(); save();
    renderVillageExtras();
    return true;
  }
  function orderNeedText(o) {
    if (!o) return '';
    return Object.entries(o.need).map(([k, n]) => {
      const name = (CROPS[k] && CROPS[k].name) || (ORE[k] && ORE[k].name) || (FISH[k] && FISH[k].name) ||
        (k === 'egg' ? '雞蛋' : k === 'milk' ? '鮮奶' : k);
      return name + '×' + n;
    }).join('、');
  }

  function unlockRanch() {
    if (state.ranch.unlocked) { toast('牧場已解鎖'); return; }
    if (state.gold < 50) { toast('需 50 銀開牧場'); return; }
    state.gold -= 50;
    state.ranch.unlocked = true;
    if (!state.ranch.animals.length) {
      // starter chicken
      state.ranch.animals.push({ type: 'chicken', fed: false, progress: 0, ready: false });
    }
    toast('牧場開張！有一隻青羽雞');
    if (!state.achievements.ranchOpen) {
      state.achievements.ranchOpen = true;
      showAchievement('牧場初開', '禽舍立起，青羽雞咯咯叫。');
    }
    updateHud(); save(); renderRanch();
  }
  function buyAnimal(type) {
    const def = ANIMAL_DEFS[type];
    if (!def) return;
    if (!state.ranch.unlocked) { toast('先開牧場'); return; }
    const cap = 2 + (state.buildings.house || 0);
    if (state.ranch.animals.length >= cap) { toast('欄位已滿（上限 ' + cap + '）'); return; }
    if (state.gold < def.unlockGold) { toast('需 ' + def.unlockGold + ' 銀'); return; }
    state.gold -= def.unlockGold;
    state.ranch.animals.push({ type, fed: false, progress: 0, ready: false });
    toast('迎來' + def.name);
    updateHud(); save(); renderRanch();
  }
  function makeFeed() {
    // 2 wheat or 2 rice -> 3 feed
    if ((state.inventory.wheat || 0) >= 2) {
      state.inventory.wheat -= 2;
      state.inventory.feed = (state.inventory.feed || 0) + 3;
      toast('磨飼料 +3');
    } else if ((state.inventory.rice || 0) >= 2) {
      state.inventory.rice -= 2;
      state.inventory.feed = (state.inventory.feed || 0) + 3;
      toast('磨飼料 +3（用稻）');
    } else {
      toast('需麥或稻 ×2');
      return false;
    }
    updateHud(); save(); renderRanch();
    return true;
  }
  function feedAllAnimals(silent) {
    let fed = 0;
    for (const a of state.ranch.animals) {
      if (a.ready || a.fed) continue;
      const def = ANIMAL_DEFS[a.type];
      const need = def.feedNeed;
      if ((state.inventory.feed || 0) < need) break;
      state.inventory.feed -= need;
      a.fed = true;
      fed++;
    }
    if (!silent) toast(fed ? ('餵食 ' + fed + ' 隻') : '無需餵或飼料不足');
    if (fed) { updateHud(); save(); renderRanch(); }
    return fed > 0;
  }
  function collectAnimalProducts(silent) {
    let got = 0;
    for (const a of state.ranch.animals) {
      if (!a.ready) continue;
      const def = ANIMAL_DEFS[a.type];
      if (!canAddInv(1)) { if (!silent) toast('倉廩已滿'); break; }
      state.inventory[def.product] = (state.inventory[def.product] || 0) + 1;
      if (def.product === 'egg') bumpQuest('eggsCollected', 1);
      if (def.product === 'milk') state.stats.milkCollected = (state.stats.milkCollected || 0) + 1;
      a.ready = false; a.fed = false; a.progress = 0;
      got++;
    }
    if (!silent) toast(got ? ('收取產物 ×' + got) : '暫無可收');
    if (got) { updateHud(); save(); renderRanch(); }
    return got > 0;
  }
  function ranchDailyTick() {
    if (!state.ranch || !state.ranch.animals) return;
    for (const a of state.ranch.animals) {
      const def = ANIMAL_DEFS[a.type];
      if (!def) continue;
      if (a.ready) continue;
      if (a.fed) {
        a.progress = (a.progress || 0) + 1;
        if (a.progress >= def.readyDays) {
          a.ready = true; a.fed = false; a.progress = 0;
        }
      }
    }
  }
  function sellRanchGoods() {
    let total = 0;
    for (const id of ['egg', 'milk']) {
      const price = id === 'egg' ? ANIMAL_DEFS.chicken.sell : ANIMAL_DEFS.cow.sell;
      while ((state.inventory[id] || 0) > 0) {
        state.inventory[id]--;
        state.gold += price;
        total += price;
      }
    }
    toast(total ? ('賣蛋奶 +' + total + '銀') : '冇蛋奶可賣');
    updateHud(); save(); renderRanch();
  }
  function renderRanch() {
    const box = document.getElementById('ranch-list');
    if (!box) return;
    const feedN = state.inventory.feed || 0;
    document.getElementById('ranch-feed-label').textContent = '飼料 ' + feedN;
    document.getElementById('ranch-unlock-row').hidden = !!state.ranch.unlocked;
    document.getElementById('ranch-actions').hidden = !state.ranch.unlocked;
    box.innerHTML = '';
    if (!state.ranch.unlocked) {
      box.innerHTML = '<p class="tiny" style="text-align:center">花費 50 銀開設牧場，飼養青羽雞與雲斑牛。</p>';
      return;
    }
    if (!state.ranch.animals.length) {
      box.innerHTML = '<p class="tiny" style="text-align:center">欄空空 · 買一隻動物吧</p>';
    }
    state.ranch.animals.forEach((a, i) => {
      const def = ANIMAL_DEFS[a.type];
      const div = document.createElement('div');
      div.className = 'ranch-card' + (a.ready ? ' ready' : '');
      const st = a.ready ? ('可收 ' + def.productName) : (a.fed ? ('成長 ' + (a.progress || 0) + '/' + def.readyDays) : '待餵');
      div.innerHTML = '<div class="rc-ico">' + def.icon + '</div><div class="rc-body"><div class="rc-name">' +
        def.name + '</div><div class="rc-st">' + st + '</div></div>';
      box.appendChild(div);
    });
  }

  function itemDisplayName(id) {
    if (CROPS[id]) return CROPS[id].name;
    if (ORE[id]) return ORE[id].name;
    if (FISH[id]) return FISH[id].name;
    const map = { egg: '雞蛋', milk: '鮮奶', feed: '飼料', oreBrew: '礦泉劑', milkTea: '暖奶飲' };
    return map[id] || id;
  }
  function canCraft(recipe) {
    for (const [k, n] of Object.entries(recipe.needs)) {
      if ((state.inventory[k] || 0) < n) return false;
    }
    return true;
  }
  function doCraft(recipeId, silent) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return false;
    // friendship unlock for milkTea / eggCake via Hua
    if ((recipe.id === 'milkTea' || recipe.id === 'eggCake') && (state.friendship.hua || 0) < 20) {
      if (!silent) toast('需花小滿好感 ≥20');
      return false;
    }
    if (!canCraft(recipe)) { if (!silent) toast('材料不足'); return false; }
    if (!canAddInv(1) && (recipe.potion || recipe.out.food)) {
      // food goes to food bar not bag; potions need bag
      if (recipe.potion && !canAddInv(1)) { if (!silent) toast('倉廩已滿'); return false; }
    }
    for (const [k, n] of Object.entries(recipe.needs)) state.inventory[k] -= n;
    if (recipe.out.food) state.food += recipe.out.food;
    if (recipe.potion) {
      state.inventory[recipe.potion] = (state.inventory[recipe.potion] || 0) + 1;
      state.potions[recipe.potion] = (state.potions[recipe.potion] || 0) + 1;
    }
    bumpQuest('craftsDone', 1);
    if (!silent) toast('製成「' + recipe.name + '」');
    if (!state.achievements.firstCraft) {
      state.achievements.firstCraft = true;
      showAchievement('灶火初燃', '你做出第一道「' + recipe.name + '」。');
    }
    updateHud(); save(); renderCraft();
    return true;
  }
  function usePotionInBattle(id) {
    if (!battle || !battle.active) { toast('戰鬥中才能用藥'); return; }
    if ((state.inventory[id] || 0) <= 0) { toast('沒有藥劑'); return; }
    const heal = id === 'oreBrew' ? 40 : id === 'milkTea' ? 35 : 0;
    if (!heal) return;
    state.inventory[id]--;
    state.potions[id] = Math.max(0, (state.potions[id] || 0) - 1);
    battle.playerHp = Math.min(battle.playerMaxHp, battle.playerHp + heal);
    battle.log = '服用藥劑，回復 ' + heal + ' HP';
    showHint('+' + heal + 'HP');
    updateBattleHud(); updateHud(); save();
  }
  function renderCraft() {
    const box = document.getElementById('craft-list');
    if (!box) return;
    box.innerHTML = '';
    RECIPES.forEach(r => {
      const locked = (r.id === 'milkTea' || r.id === 'eggCake') && (state.friendship.hua || 0) < 20;
      const div = document.createElement('div');
      div.className = 'craft-card' + (locked ? ' locked' : '');
      const need = Object.entries(r.needs).map(([k, n]) => itemDisplayName(k) + '×' + n).join(' · ');
      div.innerHTML = '<div class="cc-name">' + r.name + (locked ? ' 🔒' : '') + '</div>' +
        '<div class="cc-need">' + need + '</div>' +
        '<div class="cc-desc">' + r.desc + '</div>';
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn'; btn.textContent = locked ? '未解鎖' : '製作';
      btn.disabled = locked;
      btn.onclick = () => doCraft(r.id, false);
      div.appendChild(btn);
      box.appendChild(div);
    });
  }

  function giftVillager(vid, itemId) {
    const v = VILLAGERS.find(x => x.id === vid);
    if (!v) return;
    if ((state.friendship[vid] || 0) === 0 && v.unlockAt && state.day < v.unlockAt && (state.friendship.lin || 0) < 10) {
      // soft unlock by day or lin friendship
    }
    if ((state.inventory[itemId] || 0) <= 0) { toast('沒有這件禮物'); return; }
    state.inventory[itemId]--;
    const liked = v.likes.includes(itemId);
    const gain = liked ? v.giftBoost : 4;
    state.friendship[vid] = Math.min(100, (state.friendship[vid] || 0) + gain);
    toast(v.name + (liked ? '很喜歡！' : '收下了') + ' 好感+' + gain);
    if (state.friendship[vid] >= 30 && !(state.stats.friendMilestone)) {
      bumpQuest('friendMilestone', 1);
    }
    // check any >= 30
    if (Object.values(state.friendship).some(n => n >= 30)) {
      const q = state.quests.find(x => x.id === 'friend_hearts');
      if (q && q.progress < 1) bumpQuest('friendMilestone', 1);
    }
    if (state.friendship[vid] >= 50 && !state.achievements['friend_' + vid]) {
      state.achievements['friend_' + vid] = true;
      showAchievement('深交 · ' + v.name, v.name + '視你為可信之人。');
    }
    updateHud(); save(); renderVillageExtras();
  }
  function seedDiscount() {
    return (state.friendship.lin || 0) >= 40 ? 0.85 : 1;
  }
  function oreSellBonus() {
    return (state.friendship.shi || 0) >= 40 ? 1.15 : 1;
  }
  function upgradeBuilding(key) {
    const def = BUILD_DEFS[key];
    if (!def) return;
    const cur = state.buildings[key] || 0;
    if (cur >= def.levels.length - 1) { toast(def.name + '已滿級'); return; }
    const next = def.levels[cur + 1];
    if (state.gold < next.cost) { toast('需 ' + next.cost + ' 銀'); return; }
    state.gold -= next.cost;
    state.buildings[key] = cur + 1;
    applyBuildingBonuses(state, false);
    toast(def.name + '升至「' + next.label + '」');
    if (key === 'house' && state.buildings.house >= 1 && !state.achievements.houseUp) {
      state.achievements.houseUp = true;
      showAchievement('農舍煥新', '木屋落成，可開更多田畦。');
    }
    updateHud(); save(); renderVillageExtras();
  }
  function reforgeGear(gearId) {
    const g = state.gear.find(x => x.id === gearId);
    if (!g) return;
    const anvilLv = state.buildings.anvil || 0;
    if (anvilLv < 1) { toast('需先升級鐵砧'); return; }
    const cost = 25 + RARITY_ORDER.indexOf(g.rarity) * 15;
    if (state.gold < cost) { toast('重鑄需 ' + cost + ' 銀'); return; }
    if ((state.inventory.ore || 0) < 2) { toast('需礦石 ×2'); return; }
    state.gold -= cost;
    state.inventory.ore -= 2;
    const bonus = BUILD_DEFS.anvil.levels[anvilLv].reforgeBonus || 0.08;
    g.atk = Math.round(g.atk * (1 + bonus));
    g.def = Math.round(g.def * (1 + bonus));
    g.hp = Math.round(g.hp * (1 + bonus));
    g.sell = Math.round(g.sell * (1 + bonus * 0.5));
    toast('重鑄完成！屬性提升');
    updateHud(); save(); renderBag();
  }

  function renderVillageExtras() {
    ensureDailyOrder();
    const orderBox = document.getElementById('order-board');
    if (orderBox) {
      const o = state.dailyOrder;
      if (!o) orderBox.innerHTML = '';
      else {
        orderBox.innerHTML =
          '<div class="order-title">📋 ' + o.title + (o.filled ? ' ✅' : '') + '</div>' +
          '<div class="order-need">需：' + orderNeedText(o) + '</div>' +
          '<div class="order-reward">酬：' + o.rewardGold + '銀' +
            (o.rewardFood ? (' · 糧+' + o.rewardFood) : '') + '</div>';
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'btn primary';
        btn.textContent = o.filled ? '已交貨' : '交貨';
        btn.disabled = !!o.filled;
        btn.onclick = () => fillDailyOrder(false);
        orderBox.appendChild(btn);
      }
    }
    const vbox = document.getElementById('villager-list');
    if (vbox) {
      vbox.innerHTML = '';
      VILLAGERS.forEach(v => {
        const hearts = state.friendship[v.id] || 0;
        const div = document.createElement('div');
        div.className = 'villager-card';
        div.innerHTML = '<div class="v-name">' + v.name + ' · ' + v.role + '</div>' +
          '<div class="v-hearts">好感 ' + hearts + '/100</div>' +
          '<div class="v-desc">' + v.desc + '</div>';
        const gifts = document.createElement('div');
        gifts.className = 'v-gifts';
        v.likes.forEach(id => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'btn tiny-btn';
          b.textContent = '送' + itemDisplayName(id) + '(' + (state.inventory[id] || 0) + ')';
          b.onclick = () => giftVillager(v.id, id);
          gifts.appendChild(b);
        });
        div.appendChild(gifts);
        vbox.appendChild(div);
      });
    }
    const bbox = document.getElementById('build-list');
    if (bbox) {
      bbox.innerHTML = '';
      for (const key of ['house', 'warehouse', 'anvil']) {
        const def = BUILD_DEFS[key];
        const lv = state.buildings[key] || 0;
        const cur = def.levels[lv];
        const next = def.levels[lv + 1];
        const div = document.createElement('div');
        div.className = 'build-card';
        div.innerHTML = '<div class="b-name">' + def.name + ' · ' + cur.label + '（Lv' + lv + '）</div>' +
          '<div class="b-desc">' + (key === 'house' ? ('田上限 ' + state.maxPlots + ' · 體力上限 ' + state.maxStamina) :
            key === 'warehouse' ? ('倉容 ' + bagCap()) : ('重鑄加成 ' + Math.round((cur.reforgeBonus || 0) * 100) + '%')) + '</div>';
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'btn';
        if (!next) { btn.textContent = '滿級'; btn.disabled = true; }
        else {
          btn.textContent = '升級 ' + next.cost + '銀 → ' + next.label;
          btn.onclick = () => upgradeBuilding(key);
        }
        div.appendChild(btn);
        bbox.appendChild(div);
      }
    }
  }

  function isBossFloor(floor) {
    return floor > 0 && floor % 5 === 0;
  }

  function makeEnemy(floor, wave) {
    if (isBossFloor(floor) && wave === 1) {
      const bi = Math.min(BOSS_DEFS.length - 1, Math.floor(floor / 5) - 1);
      const base = BOSS_DEFS[bi];
      const scale = 1 + (floor - 1) * 0.18;
      const hp = Math.round(base.hp * scale);
      return { name: '【層主】' + base.name, hp, maxHp: hp, atk: Math.round(base.atk * scale), boss: true };
    }
    const idx = Math.min(ENEMIES.length - 1, Math.floor((floor - 1) * 0.7 + (wave - 1) * 0.5 + Math.random() * 1.5));
    const base = ENEMIES[idx];
    const scale = 1 + (floor - 1) * 0.22 + (wave - 1) * 0.08;
    const hp = Math.round(base.hp * scale);
    return { name: base.name + (floor >= 4 ? '·精英' : ''), hp, maxHp: hp, atk: Math.round(base.atk * scale), boss: false };
  }
  function startBattle() {
    if (battle && battle.active) return;
    if (state.stamina < 10) { toast('體力不足（需 10）'); return; }
    state.stamina -= 10;
    const floor = state.dungeonFloor;
    const boss = isBossFloor(floor);
    const waves = boss ? 1 + Math.floor(Math.random() * 2) : (3 + Math.floor(Math.random() * 3));
    const cs = combatStats();
    const enemy = makeEnemy(floor, 1);
    battle = {
      active: true, floor, wave: 1, maxWaves: waves, isBoss: boss,
      enemy, playerHp: cs.maxHp, playerMaxHp: cs.maxHp,
      lootSilver: 0, lootGear: [], log: '遭遇 ' + enemy.name + '！',
    };
    skillCds = { atk: 0, slash: 0, guard: 0, burst: 0 };
    guardUntil = 0;
    setMode('dungeon');
    updateBattleHud();
    toast(boss ? ('【層主】第 ' + floor + ' 層！') : ('進入第 ' + floor + ' 層 · ' + waves + ' 波'));
    save();
  }
  function endBattle(won) {
    if (!battle) return;
    const floor = battle.floor;
    const lootGear = battle.lootGear.slice();
    const lootSilver = battle.lootSilver;
    battle.active = false;
    document.getElementById('adventure-scene').classList.remove('in-battle');
    document.getElementById('battle-hud').hidden = true;
    document.getElementById('skill-cluster').hidden = true;
    document.getElementById('btn-flee').hidden = true;
    document.getElementById('btn-enter-dungeon').hidden = false;
    if (won) {
      bumpQuest('dungeonsCleared', 1);
      if (floor > state.dungeonBest) state.dungeonBest = floor;
      const wasBoss = isBossFloor(floor);
      if (wasBoss) {
        bumpQuest('bossesKilled', 1);
        lootGear.push(createGear(floor + 2));
        if (Math.random() < 0.7) lootGear.push(createGear(floor + 1));
        if (!state.achievements.firstBoss) {
          state.achievements.firstBoss = true;
          showAchievement('層主首捷', '你擊敗了第 ' + floor + ' 層的層主！');
        }
        if (floor >= 10 && !state.achievements.boss10) {
          state.achievements.boss10 = true;
          showAchievement('十層之巔', '層主連破，聲名遠播至第 10 層。');
        }
      } else if (Math.random() < 0.55) {
        lootGear.push(createGear(floor));
      }
      const bonus = 15 + floor * 8 + Math.floor(Math.random() * 10) + (wasBoss ? floor * 12 : 0);
      state.gold += lootSilver + bonus;
      showLootModal(lootSilver + bonus, lootGear, (wasBoss ? '擊敗層主！第 ' : '通關第 ') + floor + ' 層！');
      toast('勝利！+' + (lootSilver + bonus) + ' 銀');
    } else {
      const loss = Math.min(state.gold, 5 + floor * 2);
      state.gold -= loss;
      toast('戰敗…失去 ' + loss + ' 銀');
      if (lootSilver > 0) state.gold += Math.floor(lootSilver / 2);
    }
    battle = null;
    updateHud();
    setMode('dungeon');
    save();
  }
  function showLootModal(silver, gearList, title) {
    document.getElementById('loot-body').textContent = title + ' 獲得銀兩 +' + silver;
    const box = document.getElementById('loot-gear');
    box.innerHTML = '';
    gearList.forEach(g => {
      const div = document.createElement('div');
      div.className = 'gear-item ' + RARITIES[g.rarity].className;
      div.innerHTML = '<div class="g-info"><div class="g-name">[' + RARITIES[g.rarity].name + '] ' + g.name +
        '（' + SLOT_LABEL[g.slot] + '）</div><div class="g-stats">攻' + g.atk + ' 防' + g.def + ' 血' + g.hp + '</div></div>';
      box.appendChild(div);
    });
    if (!gearList.length) box.innerHTML = '<p class="tiny">今次沒有掉落裝備</p>';
    document.getElementById('modal-loot').hidden = false;
  }
  function updateBattleHud() {
    if (!battle || !battle.active) return;
    const e = battle.enemy;
    document.getElementById('enemy-name').textContent = e.name;
    document.getElementById('enemy-hp-fill').style.width = Math.max(0, (e.hp / e.maxHp) * 100) + '%';
    document.getElementById('enemy-hp-num').textContent = Math.max(0, Math.ceil(e.hp)) + '/' + e.maxHp;
    document.getElementById('player-hp-fill').style.width = Math.max(0, (battle.playerHp / battle.playerMaxHp) * 100) + '%';
    document.getElementById('player-hp-num').textContent = Math.max(0, Math.ceil(battle.playerHp)) + '/' + battle.playerMaxHp;
    document.getElementById('wave-label').textContent = '第 ' + battle.wave + '／' + battle.maxWaves + ' 波 · 層' + battle.floor;
    document.getElementById('battle-log').textContent = battle.log || '';
    updateSkillCdsUi();
  }
  function enemyStrike() {
    if (!battle || !battle.active) return;
    const cs = combatStats();
    let dmg = Math.max(1, battle.enemy.atk - Math.floor(cs.def * 0.6) + Math.floor(Math.random() * 3));
    if (performance.now() < guardUntil) {
      dmg = Math.max(1, Math.floor(dmg * 0.35));
      battle.log = '護體減傷！受到 ' + dmg + ' 傷害';
    } else {
      battle.log = battle.enemy.name + ' 攻擊，你受到 ' + dmg + ' 傷害';
    }
    battle.playerHp -= dmg;
    showHint('-' + dmg);
    if (battle.playerHp <= 0) {
      battle.playerHp = 0; updateBattleHud(); endBattle(false); return;
    }
    updateBattleHud();
  }
  function nextWaveOrWin() {
    bumpQuest('monstersKilled', 1);
    state.stats.monstersKilled = (state.stats.monstersKilled || 0) + 1;
    const silver = 4 + battle.floor * 2 + Math.floor(Math.random() * 6);
    battle.lootSilver += silver;
    if (Math.random() < 0.42 + battle.floor * 0.04) {
      const g = createGear(battle.floor);
      battle.lootGear.push(g);
      battle.log = '擊敗！掉落 [' + RARITIES[g.rarity].name + ']' + g.name + ' · +' + silver + '銀';
    } else {
      battle.log = '擊敗 ' + battle.enemy.name + '！+' + silver + '銀';
    }
    if (battle.wave >= battle.maxWaves) { updateBattleHud(); endBattle(true); return; }
    battle.wave++;
    battle.enemy = makeEnemy(battle.floor, battle.wave);
    battle.log += ' → 下一波：' + battle.enemy.name;
    battle.playerHp = Math.min(battle.playerMaxHp, battle.playerHp + Math.round(battle.playerMaxHp * 0.08));
    updateBattleHud();
    toast('第 ' + battle.wave + ' 波');
  }
  function playerAttack(skillId) {
    if (!battle || !battle.active) return;
    if (!document.getElementById('modal-loot').hidden) return;
    const sk = SKILLS[skillId];
    if (!sk) return;
    if (skillCds[skillId] > 0) { toast('技能冷卻中'); return; }
    if (sk.stamina && state.stamina < sk.stamina) { toast('體力不足'); return; }
    if (sk.stamina) state.stamina -= sk.stamina;
    const cs = combatStats();
    if (skillId === 'guard') {
      skillCds.guard = sk.cd;
      guardUntil = performance.now() + 2800;
      battle.log = '展開護體！短暫大幅減傷';
      showHint('護體'); updateBattleHud(); updateHud();
      setTimeout(() => { if (battle && battle.active) enemyStrike(); }, 350);
      return;
    }
    let dmg = 0;
    if (skillId === 'atk') {
      dmg = Math.max(1, cs.atk + Math.floor(Math.random() * 4) - 1);
      battle.log = '普通攻擊造成 ' + dmg + ' 傷害'; showHint('攻 ' + dmg);
    } else if (skillId === 'slash') {
      skillCds.slash = sk.cd;
      dmg = Math.max(1, Math.round(cs.atk * sk.mult) + Math.floor(Math.random() * 5));
      battle.log = '青嵐斬！造成 ' + dmg + ' 傷害'; showHint('斬 ' + dmg);
    } else if (skillId === 'burst') {
      skillCds.burst = sk.cd;
      dmg = Math.max(1, Math.round(cs.atk * sk.mult) + Math.floor(Math.random() * 8));
      battle.log = '爆裂一擊！造成 ' + dmg + ' 傷害'; showHint('爆 ' + dmg);
    }
    battle.enemy.hp -= dmg;
    updateBattleHud(); updateHud();
    if (battle.enemy.hp <= 0) {
      battle.enemy.hp = 0; updateBattleHud();
      setTimeout(() => { if (battle && battle.active) nextWaveOrWin(); }, 280);
      return;
    }
    setTimeout(() => { if (battle && battle.active) enemyStrike(); }, 320);
  }
  function fleeBattle() {
    if (!battle || !battle.active) return;
    const loss = Math.min(state.gold, 3 + battle.floor);
    state.gold -= loss;
    toast('撤退，損失 ' + loss + ' 銀');
    battle.active = false; battle = null;
    document.getElementById('adventure-scene').classList.remove('in-battle');
    document.getElementById('battle-hud').hidden = true;
    document.getElementById('skill-cluster').hidden = true;
    document.getElementById('btn-flee').hidden = true;
    document.getElementById('btn-enter-dungeon').hidden = false;
    updateHud(); setMode('dungeon'); save();
  }
  function nextFloor() {
    if (battle && battle.active) { toast('先打完或撤退'); return; }
    state.dungeonFloor++;
    toast('前往第 ' + state.dungeonFloor + ' 層');
    updateHud(); save();
  }
  function autoDungeonStep() {
    if (!battle || !battle.active) {
      if (state.stamina >= 10) startBattle();
      else {
        state.stamina = Math.min(state.maxStamina, state.stamina + 15);
        document.getElementById('status-text').textContent = 'AUTO：回體力後再戰';
      }
      return;
    }
    if (skillCds.burst <= 0 && state.stamina >= 8 && battle.enemy.hp > combatStats().atk * 1.5) playerAttack('burst');
    else if (skillCds.slash <= 0 && state.stamina >= 4) playerAttack('slash');
    else if (skillCds.guard <= 0 && battle.playerHp < battle.playerMaxHp * 0.4) playerAttack('guard');
    else playerAttack('atk');
    document.getElementById('status-text').textContent = 'AUTO：自動戰鬥中';
  }


  function autoCraftBasics() {
    // prefer healing potions / food when low
    if (state.food < 15 && canCraft(RECIPES[0])) { doCraft('riceBall', true); return true; }
    if ((state.inventory.oreBrew || 0) < 2 && canCraft(RECIPES.find(r => r.id === 'oreBrew'))) {
      doCraft('oreBrew', true); return true;
    }
    if ((state.friendship.hua || 0) >= 20) {
      const r = RECIPES.find(x => x.id === 'eggCake');
      if (r && canCraft(r) && state.food < 25) { doCraft('eggCake', true); return true; }
    }
    return false;
  }
  function autoRanchStep() {
    if (!state.ranch.unlocked) {
      if (state.gold >= 50) { unlockRanch(); return; }
      document.getElementById('status-text').textContent = 'AUTO：存銀開牧場';
      return;
    }
    if (collectAnimalProducts(true)) {
      document.getElementById('status-text').textContent = 'AUTO：收取蛋奶';
      return;
    }
    if ((state.inventory.feed || 0) < 2) makeFeed();
    if (feedAllAnimals(true)) {
      document.getElementById('status-text').textContent = 'AUTO：餵食牲口';
      return;
    }
    if ((state.inventory.egg || 0) + (state.inventory.milk || 0) >= 3) sellRanchGoods();
    document.getElementById('status-text').textContent = 'AUTO：牧場待命';
  }
  function autoStep() {
    if (!state.auto) return;
    if (!document.getElementById('modal-event').hidden) return;
    if (!document.getElementById('modal-achieve').hidden) return;
    if (!document.getElementById('modal-loot').hidden) return;
    if (state.mode === 'farm') {
      autoFarmStep();
      if (Math.random() < 0.25) autoCraftBasics();
      if (state.ranch.unlocked && Math.random() < 0.2) {
        collectAnimalProducts(true);
        feedAllAnimals(true);
      }
    } else if (state.mode === 'mine') {
      if (state.stamina < 8) {
        state.stamina = Math.min(state.maxStamina, state.stamina + 12);
        document.getElementById('status-text').textContent = 'AUTO：歇息回體力';
      } else {
        doMine(true);
        document.getElementById('status-text').textContent = 'AUTO：開挖中';
      }
      if (state.gold < 20 && (state.inventory.ore || 0) > 5) {
        const sellN = Math.min(3, state.inventory.ore);
        state.inventory.ore -= sellN;
        state.gold += Math.round(sellN * ORE.ore.sell * oreSellBonus());
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
      state.stamina = Math.min(state.maxStamina, state.stamina + 2);
      if (canFillOrder()) { fillDailyOrder(true); document.getElementById('status-text').textContent = 'AUTO：交日令'; }
      else if (autoCraftBasics()) document.getElementById('status-text').textContent = 'AUTO：工坊備料';
      else if (state.ranch.unlocked) { collectAnimalProducts(true); feedAllAnimals(true); document.getElementById('status-text').textContent = 'AUTO：村務／牧場'; }
      else document.getElementById('status-text').textContent = 'AUTO：村中調度';
    } else if (state.mode === 'ranch') {
      autoRanchStep();
    } else if (state.mode === 'craft') {
      if (autoCraftBasics()) document.getElementById('status-text').textContent = 'AUTO：製作中';
      else {
        sellSurplus(DIRS[state.directive].sellFoodKeep);
        document.getElementById('status-text').textContent = 'AUTO：工坊待命';
      }
    } else if (state.mode === 'dungeon') {
      // use potion if low HP
      if (battle && battle.active && battle.playerHp < battle.playerMaxHp * 0.35) {
        if ((state.inventory.oreBrew || 0) > 0) usePotionInBattle('oreBrew');
        else if ((state.inventory.milkTea || 0) > 0) usePotionInBattle('milkTea');
      }
      autoDungeonStep();
    }
  }
  function toggleAuto() {
    state.auto = !state.auto;
    const modeLabel = {
      farm: DIRS[state.directive].label, village: '村落', mine: '挖礦', pond: '釣魚',
      dungeon: '副本', ranch: '牧場', craft: '工坊',
    }[state.mode];
    toast(state.auto ? ('AUTO 開：' + modeLabel) : 'AUTO 關');
    updateHud(); save();
  }

  const EVENTS = [
    {
      id: 'rain', title: '甘霖', body: '雲聚雨落。要唔要讓田地飽飲一場？',
      choices: [
        { label: '接下雨水（全部澆透）', fn: () => { state.plots.forEach(p => { if (p.kind === 'soil' && p.crop) p.watered = true; }); toast('雨潤青畦'); } },
        { label: '關緊倉門便是', fn: () => { toast('錯過一場雨'); } },
      ],
    },
    {
      id: 'merchant', title: '行商', body: '客商要收鮮花與蔬菜，肯出好價。',
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
      id: 'drought', title: '乾旱', body: '烈日灼田。要立刻全村澆水，定係硬撐？',
      choices: [
        { label: '立刻全澆（-5銀）', fn: () => {
          if (state.gold >= 5) { state.gold -= 5; waterAll(); }
          else { toast('銀兩不夠，硬撐'); state.plots.forEach(p => { if (p.crop) p.wilt += 0.8; }); }
        } },
        { label: '硬撐', fn: () => { state.plots.forEach(p => { if (p.crop) p.wilt += 1; }); toast('作物受旱'); } },
      ],
    },
    {
      id: 'gift', title: '鄰里', body: '鄰家送來一小袋糧種，表心意。',
      choices: [
        { label: '笑納（+8 糧）', fn: () => { state.food += 8; toast('人情暖於爐火'); } },
        { label: '回贈 6銀', fn: () => {
          if (state.gold >= 6) { state.gold -= 6; state.food += 12; toast('禮尚往來，糧更多'); }
          else { state.food += 8; toast('袋緊，只好笑納'); }
        } },
      ],
    },
    {
      id: 'miner', title: '礦工傳聞', body: '有人說礦洞深處偶見金光。要不要多備體力？',
      choices: [
        { label: '買補藥（-8銀 · +30體力）', fn: () => {
          if (state.gold >= 8) {
            state.gold -= 8;
            state.stamina = Math.min(state.maxStamina, state.stamina + 30);
            toast('體力充盈');
          } else toast('銀兩不夠');
        } },
        { label: '聽過便是', fn: () => { toast('記在心上'); } },
      ],
    },
    {
      id: 'dungeon_rumor', title: '地牢傳言', body: '村落老人說副本深處有金光裝備。要探一探嗎？',
      choices: [
        { label: '記下位置（去副本）', fn: () => { toast('已標記於副本入口'); } },
        { label: '先顧農事', fn: () => { toast('田事為重'); } },
      ],
    },
    {
      id: 'ranch_fair', title: '村集禽市', body: '今日村集收購雞蛋與鮮奶，出價不錯。',
      choices: [
        { label: '全數賣出（高價）', fn: () => {
          let g = 0;
          while ((state.inventory.egg || 0) > 0) { state.inventory.egg--; state.gold += 14; g += 14; }
          while ((state.inventory.milk || 0) > 0) { state.inventory.milk--; state.gold += 24; g += 24; }
          toast(g ? ('禽市付款 +' + g) : '冇蛋奶可賣');
        } },
        { label: '留著自用', fn: () => { toast('產物入倉'); } },
      ],
    },
    {
      id: 'order_rush', title: '日令加急', body: '看板出現加急訂單，完成可額外得銀。',
      choices: [
        { label: '接急單（刷新今日訂單＋獎勵）', fn: () => {
          state.dailyOrderDay = -1;
          ensureDailyOrder();
          if (state.dailyOrder) state.dailyOrder.rewardGold = Math.round(state.dailyOrder.rewardGold * 1.35);
          toast('急單已掛上看板');
          renderVillageExtras();
        } },
        { label: '不忙', fn: () => { toast('按兵不動'); } },
      ],
    },
  ];

  function maybeEvent() {
    if (battle && battle.active) return;
    if (state.daysSinceEvent < state.eventCooldown) return;
    if (Math.random() > 0.45) return;
    state.daysSinceEvent = 0;
    state.eventCooldown = 6 + Math.floor(Math.random() * 5);
    showEvent(EVENTS[Math.floor(Math.random() * EVENTS.length)]);
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
      b.type = 'button'; b.className = 'btn'; b.textContent = ch.label;
      b.onclick = () => {
        ch.fn();
        modal.hidden = true;
        if (state._pausedAuto) state.auto = true;
        state._pausedAuto = false;
        updateHud(); save();
      };
      acts.appendChild(b);
    });
    modal.hidden = false;
  }


  function bagEntries() {
    const inv = state.inventory, list = [];
    for (const id of Object.keys(CROPS)) {
      const n = inv[id] || 0;
      if (n > 0) list.push({ id, name: CROPS[id].name, count: n, sell: CROPS[id].sell });
    }
    for (const id of Object.keys(ORE)) {
      const n = inv[id] || 0;
      if (n > 0) list.push({ id, name: ORE[id].name, count: n, sell: Math.round(ORE[id].sell * oreSellBonus()) });
    }
    for (const id of Object.keys(FISH)) {
      const n = inv[id] || 0;
      if (n > 0) list.push({ id, name: FISH[id].name, count: n, sell: FISH[id].sell });
    }
    if ((inv.egg || 0) > 0) list.push({ id: 'egg', name: '雞蛋', count: inv.egg, sell: ANIMAL_DEFS.chicken.sell });
    if ((inv.milk || 0) > 0) list.push({ id: 'milk', name: '鮮奶', count: inv.milk, sell: ANIMAL_DEFS.cow.sell });
    if ((inv.feed || 0) > 0) list.push({ id: 'feed', name: '飼料', count: inv.feed, sell: 0 });
    if ((inv.oreBrew || 0) > 0) list.push({ id: 'oreBrew', name: '礦泉劑', count: inv.oreBrew, sell: 12 });
    if ((inv.milkTea || 0) > 0) list.push({ id: 'milkTea', name: '暖奶飲', count: inv.milkTea, sell: 10 });
    if ((inv.pickaxe || 0) > 0) list.push({ id: 'pickaxe', name: '鶴嘴鋤', count: inv.pickaxe, sell: 0 });
    if ((inv.rod || 0) > 0) list.push({ id: 'rod', name: '釣竿', count: inv.rod, sell: 0 });
    return list;
  }

  function renderBag() {
    const cs = combatStats();
    const slots = document.getElementById('equip-slots');
    slots.innerHTML = '';
    for (const slot of ['weapon', 'armor', 'accessory']) {
      const g = getEquippedItem(slot);
      const div = document.createElement('div');
      div.className = 'equip-slot' + (g ? ' filled ' + RARITIES[g.rarity].className : '');
      if (g) {
        div.innerHTML = '<div class="slot-label">' + SLOT_LABEL[slot] + '</div>' +
          '<div class="slot-name">[' + RARITIES[g.rarity].name + '] ' + g.name + '</div>' +
          '<div class="slot-stats">攻' + g.atk + ' 防' + g.def + ' 血' + g.hp + '</div>';
        div.onclick = () => {
          if (confirm('卸下「' + g.name + '」？')) { unequipSlot(slot); renderBag(); }
        };
      } else {
        div.innerHTML = '<div class="slot-label">' + SLOT_LABEL[slot] + '</div><div class="slot-name">空</div>';
      }
      slots.appendChild(div);
    }
    document.getElementById('combat-summary').textContent =
      '戰力　攻 ' + cs.atk + '　防 ' + cs.def + '　最大HP ' + cs.maxHp +
      '　· 採集加成 ×' + yieldBonus().toFixed(2);

    const grid = document.getElementById('bag-grid');
    grid.innerHTML = '';
    const entries = bagEntries();
    if (!entries.length) {
      grid.innerHTML = '<p class="tiny" style="grid-column:1/-1;text-align:center">冇材料</p>';
    } else {
      entries.forEach(e => {
        const div = document.createElement('div');
        div.className = 'bag-item';
        div.innerHTML = '<div class="name">' + e.name + '</div>' +
          '<div class="count">×' + e.count + (e.sell ? (' · 單價 ' + e.sell) : '') + '</div>';
        if (e.sell > 0) {
          const btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'sell-one'; btn.textContent = '賣 1';
          btn.onclick = () => {
            if ((state.inventory[e.id] || 0) <= 0) return;
            state.inventory[e.id]--;
            if (CROPS[e.id] && CROPS[e.id].food > 0) state.food = Math.max(0, state.food - CROPS[e.id].food);
            state.gold += e.sell;
            toast(e.name + ' +' + e.sell + '銀');
            updateHud(); save(); renderBag();
          };
          div.appendChild(btn);
        }
        grid.appendChild(div);
      });
    }

    const glist = document.getElementById('gear-list');
    glist.innerHTML = '';
    if (!state.gear.length) {
      glist.innerHTML = '<p class="tiny" style="text-align:center">尚未獲得裝備 · 去副本打怪吧</p>';
    } else {
      state.gear.slice().reverse().forEach(g => {
        const equipped = Object.values(state.equipped).includes(g.id);
        const div = document.createElement('div');
        div.className = 'gear-item ' + RARITIES[g.rarity].className;
        const cur = getEquippedItem(g.slot);
        let cmp = '';
        if (cur && cur.id !== g.id) {
          const da = g.atk - cur.atk, dd = g.def - cur.def, dh = g.hp - cur.hp;
          cmp = ' 相對現裝 ' + (da >= 0 ? '+' : '') + da + '攻 ' +
            (dd >= 0 ? '+' : '') + dd + '防 ' + (dh >= 0 ? '+' : '') + dh + '血';
        }
        div.innerHTML = '<div class="g-info"><div class="g-name">[' + RARITIES[g.rarity].name + '] ' + g.name +
          '（' + SLOT_LABEL[g.slot] + '）' + (equipped ? ' · 已裝備' : '') + '</div>' +
          '<div class="g-stats">攻' + g.atk + ' 防' + g.def + ' 血' + g.hp + ' · 賣' + g.sell + cmp + '</div></div>';
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'g-act';
        if (equipped) {
          btn.textContent = '卸下';
          btn.onclick = () => { unequipSlot(g.slot); renderBag(); };
        } else {
          btn.textContent = '裝備';
          btn.onclick = () => { equipGear(g.id); renderBag(); };
        }
        div.appendChild(btn);
        if (!equipped) {
          const sell = document.createElement('button');
          sell.type = 'button'; sell.className = 'g-act'; sell.textContent = '賣';
          sell.style.background = '#efebe9';
          sell.onclick = () => {
            if (!confirm('賣掉「' + g.name + '」換 ' + g.sell + ' 銀？')) return;
            state.gear = state.gear.filter(x => x.id !== g.id);
            state.gold += g.sell;
            toast('賣裝 +' + g.sell + '銀');
            updateHud(); save(); renderBag();
          };
          div.appendChild(sell);
        }
        if ((state.buildings.anvil || 0) >= 1) {
          const rf = document.createElement('button');
          rf.type = 'button'; rf.className = 'g-act'; rf.textContent = '重鑄';
          rf.style.background = '#e3f2fd';
          rf.onclick = () => {
            if (!confirm('重鑄「' + g.name + '」？耗銀與礦石')) return;
            reforgeGear(g.id);
          };
          div.appendChild(rf);
        }
        glist.appendChild(div);
      });
    }
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
          ' · 獎勵 ' + def.reward + '銀</div>';
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'q-claim';
      if (q.claimed) { btn.textContent = '已領取'; btn.disabled = true; }
      else if (done) {
        btn.textContent = '領取獎勵';
        btn.onclick = () => {
          q.claimed = true; state.gold += def.reward;
          toast('任務完成 +' + def.reward + '銀');
          updateHud(); save(); renderQuests();
        };
      } else { btn.textContent = '進行中'; btn.disabled = true; }
      div.appendChild(btn);
      list.appendChild(div);
    });
  }

  function canvasToPlot(ev) {
    const rect = canvas.getBoundingClientRect();
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const layout = canvas._layout;
    if (!layout) return null;
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    const mx = (clientX - rect.left) * scaleX, my = (clientY - rect.top) * scaleY;
    const { cols, gap, pad, s, cells } = layout;
    const col = Math.floor((mx - pad) / (s + gap));
    const row = Math.floor((my - pad) / (s + gap));
    if (col < 0 || row < 0 || col >= cols) return null;
    const localX = (mx - pad) - col * (s + gap);
    const localY = (my - pad) - row * (s + gap);
    if (localX < 0 || localY < 0 || localX > s || localY > s) return null;
    return cells[row * cols + col] || null;
  }
  function onFarmTap(ev) {
    ev.preventDefault();
    if (state.mode !== 'farm') return;
    const plot = canvasToPlot(ev.changedTouches ? ev.changedTouches[0] : ev);
    if (!plot) return;
    selectedPlot = plot;
    if (plot.kind === 'locked') { tryExpand(); updateHud(); drawFarm(); return; }
    if (plot.kind !== 'soil') {
      document.getElementById('status-text').textContent =
        plot.kind === 'house' ? '自家小屋' :
        plot.kind === 'wheel' ? '水車吱呀轉' :
        plot.kind === 'water' ? '清渠流水' :
        plot.kind === 'tree' ? '後山林影' : '小路';
      drawFarm(); return;
    }
    if (plot.crop && plot.stage >= 4) {
      const n = harvestOne(plot); if (n) toast('收成 ' + n);
    } else if (plot.crop && plot.stage > 0 && !plot.watered) {
      water(plot); toast('澆水');
    } else if (canPlant(plot)) {
      if (plant(plot, selectedCrop)) toast('種下' + CROPS[selectedCrop].name);
    } else if (plot.crop) {
      toast(CROPS[plot.crop].name + ' · 階段' + plot.stage + '/4' + (plot.watered ? ' · 已澆' : ' · 待澆'));
    }
    updateHud(); drawFarm(); save();
  }

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    const dayLen = 12;
    dayAcc += dt;
    advanceGrowth(dt / dayLen);
    if (dayAcc >= dayLen) { dayAcc -= dayLen; dailyTick(); updateHud(); }
    if (mineCd > 0) mineCd = Math.max(0, mineCd - dt);
    if (fishCd > 0) fishCd = Math.max(0, fishCd - dt);
    for (const k of Object.keys(skillCds)) {
      if (skillCds[k] > 0) skillCds[k] = Math.max(0, skillCds[k] - dt);
    }
    stamRegenAcc += dt;
    if (stamRegenAcc >= 3) {
      stamRegenAcc = 0;
      if (state.stamina < state.maxStamina) state.stamina = Math.min(state.maxStamina, state.stamina + 1);
    }
    autoAcc += dt;
    const autoInterval = (state.mode === 'dungeon' && battle && battle.active) ? 0.85 : 1.1;
    if (autoAcc >= autoInterval) {
      autoAcc = 0;
      if (state.auto) { autoStep(); updateHud(); }
    }
    if (state.mode === 'mine' || state.mode === 'pond' || state.mode === 'dungeon') updateModeStats();
    if (battle && battle.active) updateSkillCdsUi();
    if (state.mode === 'farm') drawFarm();
    requestAnimationFrame(frame);
  }

  function startGame(fromSave) {
    state = fromSave ? load() : defaultState();
    if (!state) state = defaultState();
    selectedPlot = null;
    dayAcc = 0; autoAcc = 0; mineCd = 0; fishCd = 0; stamRegenAcc = 0;
    battle = null;
    skillCds = { atk: 0, slash: 0, guard: 0, burst: 0 };
    document.getElementById('screen-title').hidden = true;
    document.getElementById('screen-game').hidden = false;
    setMode(state.mode || 'farm');
    updateHud(); drawFarm();
    running = true;
    lastTs = performance.now();
    requestAnimationFrame(frame);
    save();
  }
  function toTitle() {
    if (battle && battle.active) { battle.active = false; battle = null; }
    running = false; save();
    document.getElementById('screen-game').hidden = true;
    document.getElementById('screen-title').hidden = false;
    document.getElementById('btn-continue').hidden = !hasSave();
  }

  function wire() {
    document.getElementById('btn-start').onclick = () => {
      if (hasSave() && !confirm('開始新局會覆蓋存檔，確定？')) return;
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(SAVE_KEY_V3);
      localStorage.removeItem(SAVE_KEY_V2);
      localStorage.removeItem(SAVE_KEY_V1);
      startGame(false);
    };
    document.getElementById('btn-continue').onclick = () => startGame(true);
    document.getElementById('btn-continue').hidden = !hasSave();
    document.querySelectorAll('.mode-tab').forEach(tab => { tab.onclick = () => setMode(tab.dataset.mode); });
    document.querySelectorAll('[data-goto]').forEach(b => { b.onclick = () => setMode(b.dataset.goto); });
    ['btn-auto', 'btn-auto-v', 'btn-auto-m', 'btn-auto-p', 'btn-auto-d', 'btn-auto-r', 'btn-auto-c'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.onclick = toggleAuto;
    });
    document.querySelectorAll('.dir').forEach(b => {
      b.onclick = () => {
        state.directive = b.dataset.dir;
        toast('方針：' + DIRS[state.directive].label);
        updateHud(); save();
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
    document.getElementById('btn-enter-dungeon').onclick = startBattle;
    document.getElementById('btn-flee').onclick = fleeBattle;
    document.getElementById('btn-next-floor').onclick = nextFloor;
    document.querySelectorAll('.skill-btn').forEach(b => {
      b.onclick = () => playerAttack(b.dataset.skill);
    });
    document.getElementById('btn-interact').onclick = () => {
      if (state.mode === 'mine') doMine(false);
      else if (state.mode === 'pond') doFish(false);
    };
    document.querySelectorAll('.dpad-btn').forEach(b => {
      b.onclick = () => {
        showHint({ up: '向前', down: '後退', left: '向左', right: '向右' }[b.dataset.dir] || '');
        if (state.stamina > 0) state.stamina = Math.max(0, state.stamina - 0.5);
        updateHud();
      };
    });
    const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    bind('btn-unlock-ranch', unlockRanch);
    bind('btn-make-feed', makeFeed);
    bind('btn-feed-all', () => feedAllAnimals(false));
    bind('btn-collect-ranch', () => collectAnimalProducts(false));
    bind('btn-sell-ranch', sellRanchGoods);
    bind('btn-buy-chicken', () => buyAnimal('chicken'));
    bind('btn-buy-cow', () => buyAnimal('cow'));
    bind('btn-use-orebrew', () => usePotionInBattle('oreBrew'));
    bind('btn-use-milktea', () => usePotionInBattle('milkTea'));
    bind('btn-battle-orebrew', () => usePotionInBattle('oreBrew'));
    bind('btn-battle-milktea', () => usePotionInBattle('milkTea'));

    canvas.addEventListener('click', onFarmTap);
    canvas.addEventListener('touchend', onFarmTap, { passive: false });
    document.getElementById('btn-bag').onclick = () => { renderBag(); document.getElementById('modal-bag').hidden = false; };
    document.getElementById('btn-close-bag').onclick = () => { document.getElementById('modal-bag').hidden = true; };
    document.getElementById('btn-bag-sell-all').onclick = () => { sellInventoryAll(); updateHud(); save(); renderBag(); };
    document.getElementById('btn-quest').onclick = () => { renderQuests(); document.getElementById('modal-quest').hidden = false; };
    document.getElementById('btn-close-quest').onclick = () => { document.getElementById('modal-quest').hidden = true; };
    document.getElementById('btn-close-achieve').onclick = () => { document.getElementById('modal-achieve').hidden = true; updateHud(); };
    document.getElementById('btn-close-loot').onclick = () => { document.getElementById('modal-loot').hidden = true; updateHud(); };
    document.getElementById('btn-menu').onclick = () => { document.getElementById('modal-menu').hidden = false; };
    document.getElementById('btn-close-menu').onclick = () => { document.getElementById('modal-menu').hidden = true; };
    document.getElementById('btn-save').onclick = () => { save(); toast('已存檔'); };
    document.getElementById('btn-title').onclick = () => { document.getElementById('modal-menu').hidden = true; toTitle(); };
    const openSettings = () => {
      document.getElementById('set-provider').value = settings.provider || 'none';
      document.getElementById('set-model').value = settings.model || 'deepseek-chat';
      document.getElementById('set-key').value = settings.apiKey || '';
      document.getElementById('modal-settings').hidden = false;
      document.getElementById('modal-menu').hidden = true;
    };
    document.getElementById('btn-settings-title').onclick = openSettings;
    document.getElementById('btn-settings-game').onclick = openSettings;
    document.getElementById('btn-close-settings').onclick = () => { document.getElementById('modal-settings').hidden = true; };
    document.getElementById('btn-save-settings').onclick = () => {
      settings.provider = document.getElementById('set-provider').value;
      settings.model = document.getElementById('set-model').value;
      settings.apiKey = document.getElementById('set-key').value.trim();
      saveSettings(); toast('設定已存本機');
      document.getElementById('modal-settings').hidden = true;
    };
    document.addEventListener('click', e => {
      const a = e.target.closest('a');
      if (a && /^weixin:/i.test(a.getAttribute('href') || '')) e.preventDefault();
    }, true);
  }

  wire();
})();
