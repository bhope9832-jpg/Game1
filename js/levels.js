'use strict';
// ---------------------------------------------------------------
// levels.js — 20 seeded levels across 5 mystical worlds.
// Difficulty (enemy density/HP, gap width, hazards, boss HP)
// scales with the level number. Every level ends in a boss arena.
// ---------------------------------------------------------------

// tile ids
const T_EMPTY = 0, T_SOLID = 1, T_PLAT = 2, T_VINE = 3, T_WATER = 4, T_SPIKE = 5;
const TILE = 32;

const THEMES = [
  { // 1 — Emberwood (the reference forest: moss, red foliage, storm light)
    name: 'Emberwood',
    skyTop: '#5f7494', skyBot: '#cdd8de', hills: '#465a6e', hillsFar: '#5d7285',
    trees: '#2f4438', treesLt: '#3d5a46',
    foliage: ['#7fa03e', '#a9b64d', '#96322c', '#c9a13b'],
    rock: '#70747c', rockDk: '#535660', rockLt: '#8b8f98',
    moss: '#7aa03c', mossLt: '#a4c358',
    vine: '#4e7a2e', vineLt: '#79a94e',
    spike: '#d8cfb8', spikeLt: '#f0ead9',
    water: 'rgba(52,112,142,0.55)', waterDeep: 'rgba(22,62,92,0.8)',
    fog: 'rgba(212,226,236,0.16)', particle: '#ffe9a8', lightning: 0.15
  },
  { // 2 — Sunken Fen (drowned swamp)
    name: 'Sunken Fen',
    skyTop: '#48584f', skyBot: '#a9b8a0', hills: '#39493f', hillsFar: '#4c5c50',
    trees: '#25342a', treesLt: '#33473a',
    foliage: ['#6d8f3a', '#8fa04a', '#4e7a5e', '#a08a3b'],
    rock: '#5c6258', rockDk: '#42473f', rockLt: '#767c70',
    moss: '#6d8f3a', mossLt: '#93b055',
    vine: '#3f6e34', vineLt: '#6b9a52',
    spike: '#c4c0a2', spikeLt: '#e0dcc0',
    water: 'rgba(58,110,84,0.6)', waterDeep: 'rgba(24,58,44,0.85)',
    fog: 'rgba(180,205,180,0.2)', particle: '#baffb0', lightning: 0.1
  },
  { // 3 — Crystal Deep (glowing caverns)
    name: 'Crystal Deep',
    skyTop: '#241f3a', skyBot: '#4a3f68', hills: '#332b52', hillsFar: '#3e3560',
    trees: '#2a2348', treesLt: '#3a3060',
    foliage: ['#7a5ad0', '#9a7ae0', '#4a8ad0', '#c9a2ff'],
    rock: '#575068', rockDk: '#3d374b', rockLt: '#726a86',
    moss: '#7a5ad0', mossLt: '#a88af0',
    vine: '#5a4aa8', vineLt: '#8a76d8',
    spike: '#b8a8e8', spikeLt: '#ddd0ff',
    water: 'rgba(70,50,140,0.55)', waterDeep: 'rgba(35,22,80,0.85)',
    fog: 'rgba(150,120,220,0.13)', particle: '#c9a2ff', lightning: 0
  },
  { // 4 — Ruined Spire (dusk-lit ancient ruins)
    name: 'Ruined Spire',
    skyTop: '#7a4a52', skyBot: '#e8b87a', hills: '#5c3a48', hillsFar: '#6e4652',
    trees: '#4a3038', treesLt: '#5e3e44',
    foliage: ['#a08a3b', '#c9a13b', '#96322c', '#7a6a35'],
    rock: '#8a7a62', rockDk: '#655944', rockLt: '#a8977c',
    moss: '#8a8a3e', mossLt: '#b0ae56',
    vine: '#6e6a2e', vineLt: '#9a944a',
    spike: '#d8c8a8', spikeLt: '#f0e4c8',
    water: 'rgba(120,90,60,0.5)', waterDeep: 'rgba(70,50,30,0.8)',
    fog: 'rgba(240,200,140,0.16)', particle: '#ffb45e', lightning: 0.25
  },
  { // 5 — Hive Core (the alien nest)
    name: 'Hive Core',
    skyTop: '#33102e', skyBot: '#7a2050', hills: '#4a1840', hillsFar: '#571e48',
    trees: '#3a1234', treesLt: '#4e1a44',
    foliage: ['#c92a7a', '#ff5ad0', '#3fd6c0', '#8a2a9a'],
    rock: '#5c3050', rockDk: '#3e1f36', rockLt: '#7a4468',
    moss: '#3fd6c0', mossLt: '#7affde',
    vine: '#2a9a8a', vineLt: '#4ecfba',
    spike: '#e888c8', spikeLt: '#ffc0ea',
    water: 'rgba(180,50,140,0.45)', waterDeep: 'rgba(100,20,80,0.8)',
    fog: 'rgba(255,90,208,0.1)', particle: '#ff5ad0', lightning: 0.5
  }
];

// Level 1's world — modeled directly on the alien-beach reference art
const DESERT_THEME = {
  name: 'Duskmere Strand', desert: true,
  skyTop: '#221650', skyMid: '#63307c', skyBot: '#f07a3a',
  hills: '#472052', hillsFar: '#5a2a62',
  trees: '#2a4432', treesLt: '#3a5a42',
  foliage: ['#4a8a3a', '#6aa04a', '#c9713b', '#8a5a9a'],
  rock: '#b98a58', rockDk: '#8a6038', rockLt: '#d9ac74',
  moss: '#c99a62', mossLt: '#ecc68c',
  vine: '#4e7a2e', vineLt: '#79a94e',
  spike: '#d8cfb8', spikeLt: '#f0ead9',
  water: 'rgba(82,128,215,0.5)', waterDeep: 'rgba(44,64,150,0.72)',
  fog: 'rgba(140,70,150,0.08)', particle: '#ffd9a8', lightning: 0
};

const LEVEL_NAMES = [
  'Duskmere Strand', 'Totem Hollow', 'Whispering Pines', 'Emberwood Heart',
  'Fenlight Shallows', 'Drowned Roots', 'Croaking Deep', "Leviathan's Maw",
  'Glimmer Descent', 'Shardfall Chasm', 'Echoing Vault', "Tyrant's Lair",
  'Broken Causeway', 'Skyfall Ruins', 'The Old Spire', "Warlord's Gate",
  'Hive Approach', 'Membrane Warrens', 'Royal Chamber Road', 'Heart of the Hive'
];

const Levels = {
  count: 20,
  themeFor(L) { return L === 1 ? DESERT_THEME : THEMES[Math.floor((L - 1) / 4)]; },
  themeIndex(L) { return Math.floor((L - 1) / 4); },

  // ---------------------------------------------------------------
  // Level 1 — hand-built alien beach: slopes, jumpable cliffs, an
  // oasis pool, the reference creatures, and decorative gems/palms.
  // ---------------------------------------------------------------
  level1() {
    const rnd = U.rng(9241);
    const W = 430, H = 72;
    const tiles = new Uint8Array(W * H);
    const enemies = [], items = [], movers = [], checkpoints = [], deco = [], flora = [];
    const plats = [];
    const arenaLen = 46, arenaStart = W - arenaLen;

    const groundAt = new Int16Array(W).fill(-1);
    function col(x, g) { if (x >= 0 && x < W) groundAt[x] = g; }

    let g = 56, x = 0;
    const run = (len, fn) => { for (let i = 0; i < len && x < arenaStart; i++, x++) { col(x, g); if (fn) fn(i, x); } };
    const slope = (dh, stepEvery) => {      // 1-tile steps read as slopes; dh<0 climbs
      const dir = Math.sign(dh);
      for (let s = 0; s < Math.abs(dh) && x < arenaStart; s++) {
        g = U.clamp(g + dir, 18, 62);
        run(stepEvery || 2);
      }
    };
    const cliff = (dh) => { g = U.clamp(g - dh, 18, 62); };
    const gap = (len) => { for (let i = 0; i < len && x < arenaStart; i++, x++) groundAt[x] = -1; };
    const pool = (len, depth) => {
      const surf = g;
      for (let i = 0; i < len && x < arenaStart; i++, x++) {
        const floor = surf + depth - (i === 0 || i === len - 1 ? 1 : 0);
        groundAt[x] = floor;
        for (let yy = surf; yy < floor; yy++) tiles[yy * W + x] = T_WATER;
        if (i === Math.floor(len / 2)) flora.push({ kind: 'gemBlue', x: x * TILE + 16, y: (floor) * TILE });
      }
    };
    const foe = (type, hp, dxTiles) =>
      enemies.push({ type, x: (x + (dxTiles || 0)) * TILE + 16, y: g * TILE, hp });
    const item = (kind, dxTiles) =>
      items.push({ kind, x: (x + (dxTiles || 0)) * TILE + 16, y: g * TILE - 10 });
    const palm = (kind, dxTiles) =>
      deco.push({ kind, x: (x + (dxTiles || 0)) * TILE, y: g * TILE });
    const plant = (kind, dxTiles) =>
      flora.push({ kind, x: (x + (dxTiles || 0)) * TILE + 16, y: g * TILE });
    const gems = ['gemRock', 'gemTeal', 'gemGreen', 'gemRed', 'gemBlue', 'gemPurp'];
    const gemPatch = (n) => {
      for (let k = 0; k < n; k++)
        flora.push({ kind: gems[Math.floor(rnd() * gems.length)], x: (x + k * 1.2) * TILE + rnd() * 20, y: g * TILE });
    };

    // --- the beach walk ------------------------------------------
    run(6); palm('palmL', -2);
    run(8, i => { if (i === 3) item('gun'); if (i === 5) item('ammo'); });
    plant('grassA', -6); gemPatch(2);
    slope(-3, 2);                                   // sandy rise
    run(6, i => { if (i === 2) foe('dog', 3); });
    palm('palmM', 1); plant('fernR', 3);
    cliff(2); run(7, i => { if (i === 3) foe('pillbug', 4); });   // jump-up ledge
    gemPatch(3);
    slope(3, 2);                                    // back down
    run(10, i => { if (i === 2) foe('alien', 3); if (i === 7) foe('spiderW', 3); if (i === 4) item('rock'); });
    palm('palmR', 2);
    gap(4);
    run(4); checkpoints.push({ x: x * TILE, y: g * TILE }); run(2);
    run(10, i => { if (i === 3) foe('octo', 10); if (i === 8) item('spear'); });
    plant('grassA', -4);
    // stepped cliff — two hops up
    cliff(2); run(3, i => { if (i === 1) gemPatch(1); });
    cliff(2); run(9, i => { if (i === 2) foe('spiderC', 3); if (i === 6) foe('dog', 3); });
    palm('palmM', 0); plant('fernR', 2);
    slope(4, 2);
    run(4, i => { if (i === 1) item('ammo'); });
    pool(9, 4);                                     // the oasis
    run(6, i => { if (i === 2) foe('crab', 4); });
    plant('grassA', 1); gemPatch(2);
    gap(5);
    run(8, i => { if (i === 3) foe('spiderW', 3); if (i === 6) foe('alien', 3); });
    palm('palmL', 1);
    // rock-hop ascent
    plats.push({ x: x + 1, y: g - 3, len: 2 }, { x: x + 4, y: g - 6, len: 2 });
    cliff(6); gap(6);
    run(3); checkpoints.push({ x: x * TILE, y: g * TILE });
    run(9, i => { if (i === 2) foe('pillbug', 4); if (i === 6) foe('spiderC', 3); });
    gemPatch(3); palm('palmR', 0);
    slope(4, 2);
    run(8, i => { if (i === 3) foe('dog', 3); if (i === 6) item('skull'); });
    pool(12, 5);                                    // long lagoon swim
    run(6, i => { if (i === 2) foe('crab', 4); });
    plant('fernR', -3);
    slope(-4, 2);                                   // climb the headland
    run(6, i => { if (i === 2) foe('octo', 10); });
    palm('palmM', 1);
    cliff(2); run(5, i => { if (i === 1) foe('spiderW', 3); });
    cliff(2); run(6, i => { if (i === 2) gemPatch(2); });
    slope(6, 2);
    run(8, i => { if (i === 2) foe('alien', 3); if (i === 5) foe('dog', 3); if (i === 3) item('rock'); });
    gap(4);
    run(10, i => { if (i === 3) foe('spiderC', 3); if (i === 7) foe('crab', 4); });
    palm('palmL', 2); gemPatch(2);
    // fill any remaining approach with beach + stragglers
    while (x < arenaStart - 14) {
      const pick = rnd();
      if (pick < 0.3) slope(rnd() < 0.5 ? -2 : 2, 2);
      else if (pick < 0.4) gap(3 + Math.floor(rnd() * 2));
      else run(6 + Math.floor(rnd() * 6), i => {
        if (i === 2 && rnd() < 0.5) {
          const t = ['dog', 'pillbug', 'spiderW', 'spiderC', 'crab', 'alien'][Math.floor(rnd() * 6)];
          foe(t, t === 'pillbug' || t === 'crab' ? 4 : 3);
        }
        if (i === 4 && rnd() < 0.3) item(['rock', 'skull', 'ammo'][Math.floor(rnd() * 3)]);
        if (i === 1 && rnd() < 0.3) gemPatch(1 + Math.floor(rnd() * 2));
        if (i === 5 && rnd() < 0.25) palm(['palmL', 'palmM', 'palmR'][Math.floor(rnd() * 3)], 0);
        if (i === 3 && rnd() < 0.4) plant(rnd() < 0.5 ? 'grassA' : 'fernR', 0);
      });
    }
    run(6); checkpoints.push({ x: x * TILE, y: g * TILE }); run(8);

    // --- boss arena ------------------------------------------------
    const gA = U.clamp(g, 30, 56);
    g = gA;
    for (; x < W; x++) {
      col(x, gA);
      if (x >= W - 3) for (let yy = gA - 16; yy < gA; yy++) tiles[yy * W + x] = T_SOLID;
    }
    deco.push({ kind: 'palmR', x: (arenaStart + 6) * TILE, y: gA * TILE });

    // --- rasterize ---------------------------------------------------
    for (let xx = 0; xx < W; xx++) {
      const gg = groundAt[xx];
      if (gg < 0) continue;
      for (let yy = gg; yy < H; yy++) if (tiles[yy * W + xx] !== T_WATER) tiles[yy * W + xx] = T_SOLID;
    }
    plats.forEach(pl => { for (let i = 0; i < pl.len; i++) if (pl.x + i < W) tiles[pl.y * W + pl.x + i] = T_PLAT; });

    // snap decorations to the finished terrain so nothing floats
    const snap = list => list.forEach(o => {
      const cxx = U.clamp(Math.floor(o.x / TILE), 0, W - 1);
      if (groundAt[cxx] >= 0) o.y = groundAt[cxx] * TILE;
    });
    snap(flora); snap(deco);

    return {
      L: 1, W, H, tiles, d: 0,
      theme: DESERT_THEME, themeIndex: 0,
      name: LEVEL_NAMES[0],
      spawnX: 3 * TILE, spawnY: 56 * TILE - 40,
      enemies, items, movers, checkpoints, deco, flora,
      arenaX: arenaStart * TILE,
      boss: {
        id: 1, key: 'sporefather', name: Sprites.bossDefs[0].name, hp: 20,
        x: (arenaStart + 30) * TILE, y: gA * TILE,
        groundY: gA * TILE,
        arenaL: (arenaStart + 2) * TILE, arenaR: (W - 3) * TILE
      }
    };
  },

  generate(L) {
    if (L === 1) return this.level1();
    const rnd = U.rng(L * 7919 + 1013);
    const d = (L - 1) / 19;                       // 0..1 difficulty
    const W = 380 + L * 26, H = 72;
    const tiles = new Uint8Array(W * H);
    const prof = new Array(W);                    // per-column profile
    const plats = [], vines = [], enemies = [], items = [], movers = [], checkpoints = [];

    const hpSmall = 3 + (L > 6 ? 1 : 0) + (L > 13 ? 1 : 0);        // 3..5 hits
    const hpBrute = 10 + Math.round(d * 10);                        // 10..20 hits
    const hpStalker = 12 + Math.round(d * 8);                       // 12..20 hits
    const bossHp = 20 + Math.round(d * 10);                         // 20..30 hits

    let g = 56;                                    // current ground top row
    let x = 0;
    const arenaLen = 48;
    const arenaStart = W - arenaLen;

    function setProf(xx, p) { prof[xx] = p; }
    function ground(xx, gg, opts) {
      setProf(xx, Object.assign({ kind: 'ground', g: gg, waterTop: 0, spike: false }, opts || {}));
    }

    // --- enemy / item cursors -------------------------------------
    let nextEnemy = 16 + Math.floor(rnd() * 10);
    let nextThrow = 10 + Math.floor(rnd() * 8);
    let nextAmmo = 26 + Math.floor(rnd() * 12);
    let nextCheck = 85;

    function pickEnemy() {
      const roll = rnd();
      const largeChance = L < 4 ? 0 : 0.10 + d * 0.22;
      if (roll < largeChance) {
        const type = (L >= 8 && rnd() < 0.5) ? 'stalker' : 'brute';
        return { type, hp: type === 'brute' ? hpBrute : hpStalker, big: true };
      }
      const smalls = ['crawler', 'imp'];
      if (L >= 2) smalls.push('spitter');
      if (L >= 3) smalls.push('wisp');
      const type = smalls[Math.floor(rnd() * smalls.length)];
      return { type, hp: type === 'spitter' ? Math.min(5, hpSmall + 1) : hpSmall, big: false };
    }

    function populate(xx, gg) {                    // called for walkable ground columns
      if (xx > 14 && xx >= nextEnemy && xx < arenaStart - 6) {
        const e = pickEnemy();
        const px = xx * TILE + 16, py = gg * TILE;
        if (e.type === 'wisp') enemies.push({ type: 'wisp', x: px, y: py - 70 - rnd() * 40, hp: e.hp });
        else enemies.push({ type: e.type, x: px, y: py, hp: e.hp });
        nextEnemy = xx + 6 + Math.floor(rnd() * (16 - d * 8));
      }
      if (xx >= nextThrow && xx < arenaStart - 4) {
        const kinds = ['rock', 'rock', 'skull', 'spear'];
        items.push({ kind: kinds[Math.floor(rnd() * kinds.length)], x: xx * TILE + 16, y: gg * TILE - 8 });
        nextThrow = xx + 14 + Math.floor(rnd() * 16);
      }
      if (xx >= nextAmmo && xx < arenaStart - 4) {
        items.push({ kind: 'ammo', x: xx * TILE + 16, y: gg * TILE - 10 });
        nextAmmo = xx + 26 + Math.floor(rnd() * 20);
      }
      if (xx >= nextCheck && xx < arenaStart - 10) {
        checkpoints.push({ x: xx * TILE + 16, y: gg * TILE });
        nextCheck = xx + 80 + Math.floor(rnd() * 30);
      }
    }

    // --- opening safe strip ---------------------------------------
    for (; x < 12; x++) ground(x, g);
    items.push({ kind: 'gun', x: (8 + Math.floor(rnd() * 4)) * TILE, y: g * TILE - 12 });
    items.push({ kind: 'ammo', x: 10 * TILE, y: g * TILE - 10 });

    // --- section patterns ------------------------------------------
    const patterns = ['flat', 'steps', 'gap', 'pool', 'cliffUp', 'cliffDown', 'platforms', 'flat', 'steps', 'gap'];

    while (x < arenaStart) {
      const left = arenaStart - x;
      let pat = patterns[Math.floor(rnd() * patterns.length)];
      if (left < 26) pat = 'flat';

      if (pat === 'flat') {
        const len = Math.min(left, 8 + Math.floor(rnd() * 10));
        for (let i = 0; i < len; i++, x++) { ground(x, g); populate(x, g); }

      } else if (pat === 'steps') {
        const dir = (g > 46 && rnd() < 0.55) ? -1 : 1;   // -1 = up
        const steps = 2 + Math.floor(rnd() * 3);
        for (let s2 = 0; s2 < steps && x < arenaStart; s2++) {
          const rise = 1 + Math.floor(rnd() * 2);
          const wlen = 3 + Math.floor(rnd() * 3);
          g = U.clamp(g + dir * rise, 18, 62);
          for (let i = 0; i < wlen && x < arenaStart; i++, x++) { ground(x, g); populate(x, g); }
        }

      } else if (pat === 'gap') {
        const gw = Math.min(left - 4, 3 + Math.floor(rnd() * (2 + d * 4)));
        if (gw < 3) continue;
        if (gw > 5) {
          // bridge the wide gap: moving platform on later levels, static ledge before
          if (L >= 5 && rnd() < 0.5) {
            movers.push({
              x: (x + 1) * TILE, y: (g - 1) * TILE, len: 3,
              axis: 'x', range: (gw - 3) * TILE, speed: 46 + d * 50
            });
          } else {
            const px = x + Math.floor(gw / 2) - 1;
            plats.push({ x: px, y: g - 1 - Math.floor(rnd() * 2), len: 3 });
          }
        }
        for (let i = 0; i < gw && x < arenaStart; i++, x++) setProf(x, { kind: 'gap' });

      } else if (pat === 'pool') {
        const len = Math.min(left - 4, 9 + Math.floor(rnd() * (8 + d * 10)));
        if (len < 6 || g > 58) continue;
        const depth = 3 + Math.floor(rnd() * (3 + d * 3));
        const surf = g;
        for (let i = 0; i < len && x < arenaStart; i++, x++) {
          const floor = U.clamp(surf + depth - (i === 0 || i === len - 1 ? 1 : 0), surf + 2, 66);
          ground(x, floor, { waterTop: surf });
          if (i === Math.floor(len / 2)) items.push({ kind: 'gem', x: x * TILE + 16, y: (floor - 1) * TILE });
        }
        if (rnd() < 0.4 + d * 0.4)               // a wisp guards the far shore
          enemies.push({ type: 'wisp', x: (x + 1) * TILE, y: surf * TILE - 90, hp: hpSmall });

      } else if (pat === 'cliffUp') {
        const dh = 4 + Math.floor(rnd() * 5);
        const ng = U.clamp(g - dh, 18, 62);
        if (ng === g) continue;
        // vine hangs beside the cliff face for the climb
        vines.push({ x: x, y0: ng - 2, y1: g - 1 });
        for (let i = 0; i < 1 && x < arenaStart; i++, x++) setProf(x, { kind: 'gap' });
        g = ng;
        const len = 4 + Math.floor(rnd() * 5);
        for (let i = 0; i < len && x < arenaStart; i++, x++) { ground(x, g); populate(x, g); }

      } else if (pat === 'cliffDown') {
        g = U.clamp(g + 3 + Math.floor(rnd() * 5), 18, 62);
        const len = 4 + Math.floor(rnd() * 5);
        for (let i = 0; i < len && x < arenaStart; i++, x++) { ground(x, g); populate(x, g); }

      } else if (pat === 'platforms') {
        // spike gauntlet crossed on floating ledges
        const len = Math.min(left - 4, 10 + Math.floor(rnd() * 8));
        if (len < 8) continue;
        const baseG = g;
        let px = x + 1, ph = baseG - 3 - Math.floor(rnd() * 2);
        while (px < x + len - 2) {
          const plen = 2 + Math.floor(rnd() * 2);
          plats.push({ x: px, y: ph, len: plen });
          if (rnd() < 0.35 + d * 0.3)
            enemies.push({ type: rnd() < 0.5 ? 'crawler' : 'imp', x: (px + 1) * TILE, y: ph * TILE, hp: hpSmall });
          if (rnd() < 0.4) items.push({ kind: 'gem', x: (px + 1) * TILE, y: ph * TILE - 20 });
          px += plen + 2 + Math.floor(rnd() * 2);
          ph = U.clamp(ph + (Math.floor(rnd() * 5) - 2), baseG - 7, baseG - 2);
        }
        for (let i = 0; i < len && x < arenaStart; i++, x++) {
          ground(x, baseG, { spike: L >= 2 && i > 0 && i < len - 1 });
        }
        g = baseG;
      }
    }

    // --- boss arena -------------------------------------------------
    const gA = U.clamp(g, 30, 56);
    for (; x < W; x++) {
      const nearEnd = x >= W - 3;
      ground(x, gA);
      if (nearEnd) ground(x, gA, { wall: gA - 16 });
    }
    checkpoints.push({ x: (arenaStart - 14) * TILE, y: prof[arenaStart - 14].g * TILE });

    // --- rasterize ---------------------------------------------------
    function set(xx, yy, v) { if (xx >= 0 && xx < W && yy >= 0 && yy < H) tiles[yy * W + xx] = v; }
    for (let xx = 0; xx < W; xx++) {
      const p = prof[xx];
      if (!p || p.kind === 'gap') continue;
      for (let yy = p.g; yy < H; yy++) set(xx, yy, T_SOLID);
      if (p.waterTop) for (let yy = p.waterTop; yy < p.g; yy++) set(xx, yy, T_WATER);
      if (p.spike) set(xx, p.g - 1, T_SPIKE);
      if (p.wall) for (let yy = p.wall; yy < p.g; yy++) set(xx, yy, T_SOLID);
    }
    plats.forEach(pl => { for (let i = 0; i < pl.len; i++) set(pl.x + i, pl.y, T_PLAT); });
    vines.forEach(v => {
      for (let yy = v.y0; yy <= v.y1; yy++)
        if (tiles[yy * W + v.x] === T_EMPTY) set(v.x, yy, T_VINE);
    });

    const bossId = Math.ceil(L / 4);
    const bossDef = Sprites.bossDefs[bossId - 1];
    return {
      L, W, H, tiles, d,
      theme: this.themeFor(L), themeIndex: this.themeIndex(L),
      name: LEVEL_NAMES[L - 1],
      spawnX: 4 * TILE, spawnY: 56 * TILE - 40,
      enemies, items, movers, checkpoints,
      arenaX: arenaStart * TILE,
      boss: {
        id: bossId, key: bossDef.key, name: bossDef.name, hp: bossHp,
        x: (arenaStart + 30) * TILE, y: gA * TILE,
        groundY: gA * TILE,
        arenaL: (arenaStart + 2) * TILE, arenaR: (W - 3) * TILE
      }
    };
  }
};
