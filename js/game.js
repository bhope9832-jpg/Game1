/* ============================================================
   DRIVE-THRU DASH — a 32-bit style drive-thru burger arcade
   Build orders, toss them through car windows, chase combos.
   Everything (art, music, sfx) is generated in code.
   ============================================================ */
(() => {
'use strict';

// ------------------------------------------------------------
// Canvas & scaling
// ------------------------------------------------------------
const W = 270, H = 480;
const cv = document.getElementById('game');
const cx = cv.getContext('2d');
cx.imageSmoothingEnabled = false;

function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  cv.style.width  = Math.floor(W * s) + 'px';
  cv.style.height = Math.floor(H * s) + 'px';
}
addEventListener('resize', fit); fit();

// ------------------------------------------------------------
// Save data
// ------------------------------------------------------------
const SAVE_KEY = 'dtdash-v1';
const save = Object.assign({
  coins: 0, best: 0, muted: false, tutorialDone: false,
  owned: { outfit: [0], window: [0], music: [0] },
  eq:    { outfit: 0,  window: 0,  music: 0 },
}, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
function persist() { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }

// ------------------------------------------------------------
// Cosmetics catalog
// ------------------------------------------------------------
const OUTFITS = [
  { name: 'Classic',     price: 0,    top: '#f4f1ea', topSh: '#d6d1c4', skirt: '#23252e', skirtSh: '#13141b', shoe: '#2d3860' },
  { name: 'Cherry Crew', price: 300,  top: '#e5484d', topSh: '#b93338', skirt: '#f4f1ea', skirtSh: '#cfcabd', shoe: '#8c2a2e' },
  { name: 'Chef Whites', price: 600,  top: '#fbfaf6', topSh: '#dcd8cc', skirt: '#8fa8c8', skirtSh: '#6c86a8', shoe: '#3c465c' },
  { name: 'Midnight',    price: 900,  top: '#8455d8', topSh: '#633cab', skirt: '#1b1430', skirtSh: '#0e0a1c', shoe: '#41328a' },
];
const WINDOWS = [
  { name: 'Classic Red',  price: 0,    awn1: '#e5484d', awn2: '#f7f3e6', wall: '#c98652', wallSh: '#a2683c', counter: '#8a5a33', frame: '#5b3a20', glow: null },
  { name: 'Neon Nights',  price: 400,  awn1: '#22d3ee', awn2: '#182448', wall: '#2a3355', wallSh: '#1d2440', counter: '#232c4a', frame: '#22d3ee', glow: '#22d3ee' },
  { name: 'Mint Retro',   price: 700,  awn1: '#43bd82', awn2: '#fdf6e3', wall: '#e8dcc4', wallSh: '#c9bda2', counter: '#4f9e74', frame: '#2f6a4b', glow: null },
  { name: 'Gold Deluxe',  price: 1200, awn1: '#f0b429', awn2: '#6e4812', wall: '#8a5a33', wallSh: '#6e4527', counter: '#b98a2e', frame: '#f0b429', glow: '#ffd76a' },
];
const SONG_META = [
  { name: 'Sunny Grill',      price: 0 },
  { name: 'Turbo Boulevard',  price: 500 },
  { name: 'Moonlit Cruise',   price: 1000 },
];

// ------------------------------------------------------------
// Audio — chiptune sequencer + 8-bit SFX
// ------------------------------------------------------------
let AC = null, noiseBuf = null;
function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
const mf = m => 440 * Math.pow(2, (m - 69) / 12);

function beep(freq, dur, type = 'square', vol = 0.14, slide = 0, when = 0) {
  if (save.muted || !AC) return;
  const t = AC.currentTime + when;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(AC.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
function hiss(dur, vol = 0.12, fStart = 6000, fEnd = 1200, when = 0) {
  if (save.muted || !AC) return;
  const t = AC.currentTime + when;
  const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(fStart, t);
  f.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(AC.destination);
  s.start(t); s.stop(t + dur + 0.02);
}
const SFX = {
  tap()      { beep(660, 0.05, 'square', 0.08); },
  stack(n)   { beep(300 + n * 70, 0.07, 'square', 0.12, 60); },
  scrap()    { beep(220, 0.1, 'square', 0.1, -120); },
  toss()     { hiss(0.22, 0.1, 900, 5200); },
  register() { // ka-ching!
    beep(1245, 0.07, 'square', 0.12); beep(1665, 0.12, 'square', 0.12, 0, 0.07);
    [880, 1109, 1319, 1760].forEach((f, i) => beep(f, 0.09, 'triangle', 0.13, 0, 0.14 + i * 0.05));
  },
  perfect()  { [1319, 1568, 2093].forEach((f, i) => beep(f, 0.08, 'square', 0.1, 0, i * 0.06)); },
  buzz()     { beep(110, 0.3, 'sawtooth', 0.16, -30); beep(55, 0.3, 'square', 0.14); },
  screech()  { hiss(0.4, 0.16, 5000, 700); },
  honk()     { beep(370, 0.12, 'square', 0.14); beep(311, 0.16, 'square', 0.14, 0, 0.13); },
  life()     { beep(196, 0.18, 'square', 0.14, -60); beep(147, 0.25, 'square', 0.14, -40, 0.16); },
  buy()      { [784, 988, 1175, 1568].forEach((f, i) => beep(f, 0.09, 'square', 0.11, 0, i * 0.06)); },
  over()     { [392, 330, 262, 196].forEach((f, i) => beep(f, 0.22, 'triangle', 0.14, 0, i * 0.18)); },
};

// 32-step patterns, 8th notes. null = rest.
const _ = null;
const SONGS = [
  { bpm: 118,
    lead: [72,_,76,_,79,_,76,_,74,72,74,_,76,_,_,_, 72,_,76,_,79,_,81,79, 76,74,72,_,74,_,_,_],
    bass: [36,_,43,_,45,_,43,_,41,_,45,_,43,_,38,_, 36,_,43,_,45,_,43,_,41,_,45,_,43,_,43,_] },
  { bpm: 134,
    lead: [69,_,72,74,76,_,74,72,71,_,74,_,71,69,_,_, 69,_,72,74,76,79,76,74,72,_,76,_,74,_,72,_],
    bass: [33,33,_,33,_,33,36,_,31,31,_,31,_,31,38,_, 33,33,_,33,_,33,36,_,29,29,_,29,_,31,32,_] },
  { bpm: 100,
    lead: [77,_,_,81,_,_,84,_,79,_,_,76,_,_,74,_, 77,_,_,81,_,_,86,84,81,_,79,_,77,_,_,_],
    bass: [29,_,_,_,36,_,_,_,34,_,_,_,31,_,_,_, 29,_,_,_,36,_,_,_,26,_,_,_,31,_,_,_] },
];
const music = { timer: null, step: 0, next: 0, tempoMult: 1 };
function musicTick() {
  const song = SONGS[save.eq.music];
  const ahead = AC.currentTime + 0.15;
  while (music.next < ahead) {
    const t = music.next - AC.currentTime, s = music.step % 32;
    if (!save.muted) {
      const L = song.lead[s], B = song.bass[s];
      if (L != null) beep(mf(L), 0.11, 'square', 0.055, 0, t);
      if (B != null) beep(mf(B), 0.16, 'triangle', 0.12, 0, t);
      if (s % 2 === 0) hiss(0.03, 0.025, 8000, 7000, t);          // hat
      if (s % 16 === 8) hiss(0.09, 0.06, 2500, 900, t);           // snare
    }
    music.next += 30 / (song.bpm * music.tempoMult);              // 8th note
    music.step++;
  }
}
function musicStart() {
  if (!audio() || music.timer) return;
  music.step = 0; music.next = AC.currentTime + 0.05;
  music.timer = setInterval(musicTick, 40);
}
function musicStop() { clearInterval(music.timer); music.timer = null; }

// ------------------------------------------------------------
// Pixel sprite helpers
// ------------------------------------------------------------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}
function spriteFromMap(rows, pal) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const [c, g] = makeCanvas(w, h);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  });
  return c;
}

// ------------------------------------------------------------
// The main character — human, clean & simple 32-bit sprite.
// Blonde bob, purple eyes & earrings, freckles, simple brown nose.
// ------------------------------------------------------------
const CHAR_MAP = [
  '...OOOOOOOOO......',
  '..OHHHHHHHHHOO....',
  '.OHHHHHHHHHHHHO...',
  '.OHHHHHHHHHHHHHO..',
  'OHHHHHHHHHHHHHHO..',
  'OHhHHHHHHHHHHHHO..',
  'OHhHOSSSOHHHHHHO..',
  'OHhOSSSSSOHHHHHO..',
  'OHOSWESSSOHHHHHO..',
  'OHOSSSSSSOHHHHhO..',
  'OHOSSNSSSOHHHHhO..',
  '.OOSfSSfSOHHHHO...',
  '.pOSSSSSSOHHHO....',
  '..OOSSSSOOOO......',
  '....OSSO..........',
  '...OOTTOO.........',
  '..OTTTTTTTO.......',
  '.OSTTTTTTTSO......',
  '.OSOTTTTTOSO......',
  '.OSOTtTtTOSO......',
  '.OSOTTTTTOSO......',
  '.OSSOTTTOSSO......',
  '..OOTTTTTOO.......',
  '...OSSSSSO........',
  '..OKKKKKKKO.......',
  '.OKKKKKKKKKO......',
  '.OKkKKKKKkKO......',
  '.OKKKKKKKKKO......',
  '..OKKKKKKKO.......',
  '...OSSOSSO........',
  '...OSSOSSO........',
  '...OSSOSSO........',
  '...OSSOSSO........',
  '...OSSOSSO........',
  '...OCCOCCO........',
  '..OCCCOCCCO.......',
  '..OwwwOwwwO.......',
];
const CHAR_TORSO_ROWS = 24; // crop for the drive-thru window view
function charPalette(outfit) {
  return {
    O: '#2a1a26', H: '#f2d16b', h: '#d3a83f',
    S: '#dda071', s: '#bd8154', f: '#c07b46',
    W: '#ffffff', E: '#8a4fd0', N: '#6b4632', p: '#a05fe0',
    T: outfit.top, t: outfit.topSh,
    K: outfit.skirt, k: outfit.skirtSh,
    C: outfit.shoe, w: '#e8e6df',
  };
}
const charSprites = OUTFITS.map(o => spriteFromMap(CHAR_MAP, charPalette(o)));
const charTorsos  = OUTFITS.map(o =>
  spriteFromMap(CHAR_MAP.slice(0, CHAR_TORSO_ROWS), charPalette(o)));

// ------------------------------------------------------------
// Ingredients
// ------------------------------------------------------------
const ING = ['bun_b', 'patty', 'cheese', 'lettuce', 'bun_t'];
const ING_LABEL = { bun_b: 'BUN', patty: 'PATTY', cheese: 'CHEESE', lettuce: 'LETTUCE', bun_t: 'TOP BUN' };
const ING_KEY = { bun_b: '1', patty: '2', cheese: '3', lettuce: '4', bun_t: '5' };

// Draws one burger layer, w wide, at (x,y) = top-left of the layer band.
function drawLayer(g, type, x, y, w, h) {
  const r = n => Math.max(1, Math.round(n));
  if (type === 'bun_b') {
    g.fillStyle = '#e8a54b'; g.fillRect(x, y, w, h);
    g.fillStyle = '#c9853a'; g.fillRect(x, y + h - r(h / 3), w, r(h / 3));
    g.fillStyle = '#f3bc6a'; g.fillRect(x + 1, y, w - 2, r(h / 3));
  } else if (type === 'patty') {
    g.fillStyle = '#7a4a28'; g.fillRect(x, y, w, h);
    g.fillStyle = '#5f3820'; g.fillRect(x, y + h - r(h / 3), w, r(h / 3));
    g.fillStyle = '#8f5c35';
    for (let i = x + 2; i < x + w - 2; i += 4) g.fillRect(i, y + 1, 1, 1);
  } else if (type === 'cheese') {
    g.fillStyle = '#ffc933'; g.fillRect(x, y, w, h);
    g.fillStyle = '#e8a614';
    g.fillRect(x, y + h - 1, w, 1);
    g.fillRect(x + r(w / 5), y + h - 1, 2, 1); // drip hint
  } else if (type === 'lettuce') {
    g.fillStyle = '#6fce4e'; g.fillRect(x, y, w, h);
    g.fillStyle = '#4da834';
    for (let i = x; i < x + w; i += 3) g.fillRect(i, y + h - 1, 2, 1);
  } else if (type === 'bun_t') {
    const hh = h + r(h / 2);
    const yy = y - r(h / 2);
    g.fillStyle = '#e8a54b'; g.fillRect(x, yy + 1, w, hh - 1);
    g.fillStyle = '#f3bc6a'; g.fillRect(x + 1, yy, w - 2, 2);
    g.fillStyle = '#fff3d1'; // sesame
    for (let i = x + 3; i < x + w - 3; i += 5) g.fillRect(i, yy + 2, 1, 1);
    g.fillStyle = '#c9853a'; g.fillRect(x, yy + hh - 1, w, 1);
  }
}
// Draws a whole burger (list of layers, bottom first). Returns drawn height.
function drawBurger(g, stack, cxr, baseY, w, layerH, gap) {
  let y = baseY;
  for (const type of stack) {
    y -= layerH + gap;
    drawLayer(g, type, Math.round(cxr - w / 2), y, w, layerH);
  }
  return baseY - y;
}

// ------------------------------------------------------------
// Cars — procedural pixel sprites, driver included
// ------------------------------------------------------------
const CAR_TYPES = {
  minivan: { w: 76, h: 34, spd: [30, 42],  winX: 46, winW: 14, cabX: 8,  cabW: 58, cabH: 13 },
  sedan:   { w: 64, h: 28, spd: [46, 60],  winX: 38, winW: 13, cabX: 12, cabW: 40, cabH: 11 },
  pickup:  { w: 72, h: 30, spd: [54, 70],  winX: 40, winW: 13, cabX: 30, cabW: 26, cabH: 12 },
  sports:  { w: 62, h: 22, spd: [82, 104], winX: 34, winW: 14, cabX: 16, cabW: 34, cabH: 8  },
};
const CAR_COLORS = ['#e5484d', '#3f78d8', '#43bd82', '#e8963a', '#9a63d8', '#5bc8d8', '#c9c9c9', '#e8d23a'];
const DRIVER_SKIN = ['#dda071', '#b97f52', '#8a5a3c', '#e8b88a'];
const DRIVER_HAIR = ['#2a2028', '#6b4632', '#f2d16b', '#b0453a', '#888', '#3f2a5c'];

function makeCarSprite(typeName, color, seed) {
  const T = CAR_TYPES[typeName];
  const [c, g] = makeCanvas(T.w, T.h);
  const dark = shade(color, -40), light = shade(color, 35);
  const bodyY = T.h - 14;
  // cabin
  g.fillStyle = dark;
  g.fillRect(T.cabX, bodyY - T.cabH, T.cabW, T.cabH + 2);
  g.fillStyle = '#1c2733'; // closed glass
  g.fillRect(T.cabX + 3, bodyY - T.cabH + 2, T.cabW - 6, T.cabH - 2);
  // body
  g.fillStyle = color; g.fillRect(0, bodyY, T.w, 10);
  g.fillStyle = light; g.fillRect(2, bodyY, T.w - 4, 2);
  g.fillStyle = dark;  g.fillRect(0, bodyY + 8, T.w, 2);
  if (typeName === 'pickup') { // truck bed
    g.fillStyle = dark; g.fillRect(2, bodyY - 7, T.cabX - 4, 7);
    g.fillStyle = color; g.fillRect(2, bodyY - 7, T.cabX - 4, 2);
  }
  if (typeName === 'sports') { // spoiler
    g.fillStyle = dark; g.fillRect(1, bodyY - 5, 8, 2); g.fillRect(3, bodyY - 3, 2, 3);
  }
  // open window + driver
  const wx = T.winX, ww = T.winW;
  g.fillStyle = '#0d1118'; g.fillRect(wx, bodyY - T.cabH + 1, ww, T.cabH - 1);
  const skin = DRIVER_SKIN[seed % DRIVER_SKIN.length];
  const hair = DRIVER_HAIR[seed % DRIVER_HAIR.length];
  g.fillStyle = skin; g.fillRect(wx + 4, bodyY - T.cabH + 4, 6, 6);
  g.fillStyle = hair; g.fillRect(wx + 3, bodyY - T.cabH + 3, 8, 3);
  g.fillStyle = '#2a1a26'; g.fillRect(wx + 8, bodyY - T.cabH + 6, 1, 1); // eye
  // window frame highlight
  g.fillStyle = light; g.fillRect(wx - 1, bodyY - T.cabH + 1, 1, T.cabH - 1);
  // lights & bumper
  g.fillStyle = '#fff3d1'; g.fillRect(T.w - 2, bodyY + 2, 2, 3);
  g.fillStyle = '#e5484d'; g.fillRect(0, bodyY + 2, 2, 3);
  // wheels
  const wheelY = T.h - 6;
  for (const wxp of [10, T.w - 18]) {
    g.fillStyle = '#14161c'; g.fillRect(wxp, wheelY - 2, 12, 8);
    g.fillStyle = '#3a3f4a'; g.fillRect(wxp + 4, wheelY + 1, 4, 3);
  }
  return c;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, v + amt));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------
// Layout constants
// ------------------------------------------------------------
const ROAD_TOP = 78, ROAD_BOT = 154;
const CAR_BASE = ROAD_BOT - 6;           // car bottom baseline
const COUNTER_TOP = 160, KITCHEN_TOP = 212;
const CHAR_X = 118, CHAR_Y = 158;        // torso sprite (scale 2) position
const TOSS_X = 135, TOSS_Y = 204;
const STACK_CX = 135, STACK_BASE = 356;
const BTN_Y = 416, BTN_H = 58;
const MAX_STACK = 8;

// ------------------------------------------------------------
// Game state
// ------------------------------------------------------------
let mode = 'menu';       // menu | shop | play | over
let shopTab = 0;         // 0 outfits, 1 windows, 2 music
let hits = [];           // tap targets rebuilt each frame
let time = 0;            // global clock for animation
const G = {};            // per-run state
function resetRun() {
  Object.assign(G, {
    t: 0, score: 0, lives: 3, combo: 0, bestCombo: 0,
    stack: [], cars: [], bag: null, floats: [], shake: 0, flash: 0,
    spawnIn: 1.2, served: 0, tut: !save.tutorialDone, over: 0,
  });
}

// ------------------------------------------------------------
// Orders & cars
// ------------------------------------------------------------
function makeOrder(len) {
  const mid = ['patty'];
  const pool = ['patty', 'cheese', 'lettuce', 'cheese', 'lettuce'];
  while (mid.length < len - 2) mid.push(pool[(Math.random() * pool.length) | 0]);
  mid.sort(() => Math.random() - 0.5);
  return ['bun_b', ...mid, 'bun_t'];
}
function difficulty() { return Math.min(1, G.t / 150); }
function spawnCar() {
  const names = Object.keys(CAR_TYPES);
  const pick = G.t < 12 ? 'sedan'
    : names[(Math.random() * (G.t < 40 ? 3 : 4)) | 0];
  const T = CAR_TYPES[pick];
  const seed = (Math.random() * 999) | 0;
  const color = CAR_COLORS[seed % CAR_COLORS.length];
  const spd = (T.spd[0] + Math.random() * (T.spd[1] - T.spd[0])) * (1 + difficulty() * 0.5);
  const orderLen = Math.min(3 + ((G.t / 30) | 0) + (Math.random() < 0.3 ? 1 : 0), 6);
  G.cars.push({
    type: pick, T, sprite: makeCarSprite(pick, color, seed),
    x: -T.w - 4, speed: spd, order: makeOrder(orderLen),
    served: false, angry: false,
  });
}
function carWinCenter(car) { return car.x + car.T.winX + car.T.winW / 2; }
function carTop(car) { return CAR_BASE - car.T.h; }

// ------------------------------------------------------------
// Play actions
// ------------------------------------------------------------
function addIngredient(type) {
  if (G.bag) return;
  if (G.stack.length >= MAX_STACK) { SFX.scrap(); return; }
  G.stack.push(type);
  SFX.stack(G.stack.length);
}
function scrapStack() {
  if (!G.stack.length) return;
  G.stack = [];
  SFX.scrap();
}
function tossBag(vx) {
  if (G.bag || !G.stack.length) return;
  G.bag = { x: TOSS_X, y: TOSS_Y, vx: Math.max(-95, Math.min(95, vx)), vy: -330, stack: G.stack };
  G.stack = [];
  SFX.toss();
}
function comboMult() { return 1 + 0.1 * Math.min(G.combo, 20); }
function addFloat(text, x, y, color) { G.floats.push({ text, x, y, t: 0, color }); }

function serveSuccess(car, perfect) {
  car.served = true;
  car.speed *= 1.6;
  G.combo++; G.served++;
  G.bestCombo = Math.max(G.bestCombo, G.combo);
  music.tempoMult = 1 + Math.min(G.combo, 16) * 0.03;
  let pts = Math.round((30 + 12 * (car.order.length - 2)) * comboMult());
  if (perfect) pts += 25;
  G.score += pts;
  addFloat('+' + pts, carWinCenter(car), carTop(car) - 6, '#ffd76a');
  if (perfect) { addFloat('PERFECT!', carWinCenter(car), carTop(car) - 16, '#7dffb0'); SFX.perfect(); }
  SFX.register();
  if (G.tut) { G.tut = false; save.tutorialDone = true; persist(); }
}
function loseLife(reason, x, y) {
  G.combo = 0;
  music.tempoMult = 1;
  G.lives--;
  G.shake = 0.35; G.flash = 0.4;
  addFloat(reason, x, y, '#ff7d7d');
  SFX.life();
  if (G.lives <= 0) endRun();
}
function endRun() {
  const earned = Math.floor(G.score / 10);
  save.coins += earned;
  save.best = Math.max(save.best, G.score);
  persist();
  G.earned = earned;
  mode = 'over'; G.over = 0;
  musicStop();
  SFX.over();
}

// ------------------------------------------------------------
// Update
// ------------------------------------------------------------
function updatePlay(dt) {
  G.t += dt;
  G.shake = Math.max(0, G.shake - dt);
  G.flash = Math.max(0, G.flash - dt);

  // spawn cars
  G.spawnIn -= dt;
  const maxCars = G.t < 35 ? 1 : G.t < 90 ? 2 : 3;
  const lastX = G.cars.length ? Math.min(...G.cars.map(c => c.x)) : 999;
  if (G.spawnIn <= 0 && G.cars.length < maxCars && lastX > 40) {
    spawnCar();
    G.spawnIn = Math.max(2.0, 5.5 - G.t * 0.03) * (0.75 + Math.random() * 0.5);
  }

  // move cars
  for (const car of G.cars) {
    car.x += car.speed * dt;
    if (!car.served && !car.angry && car.x > W - car.T.w * 0.55) {
      car.angry = true; SFX.honk();
    }
  }
  for (let i = G.cars.length - 1; i >= 0; i--) {
    const car = G.cars[i];
    if (car.x > W + 8) {
      if (!car.served) { SFX.screech(); loseLife('DROVE OFF!', W - 40, ROAD_TOP + 10); }
      G.cars.splice(i, 1);
    }
  }

  // bag flight
  if (G.bag) {
    const b = G.bag;
    b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 60 * dt;
    let resolved = false;
    for (const car of G.cars) {
      if (car.served) continue;
      const wy = carTop(car) + 4;
      if (b.y <= wy + 8 && b.y >= wy - 6) {
        const wc = carWinCenter(car);
        const half = car.T.winW / 2 + 5;
        if (Math.abs(b.x - wc) <= half) {
          resolved = true;
          if (sameOrder(b.stack, car.order)) {
            serveSuccess(car, Math.abs(b.x - wc) <= 3.5);
          } else {
            loseLife('WRONG ORDER!', wc, carTop(car) - 6);
            SFX.buzz();
          }
          break;
        }
      }
    }
    if (resolved) G.bag = null;
    else if (b.y < ROAD_TOP - 26 || b.x < -10 || b.x > W + 10) {
      G.bag = null;
      loseLife('MISSED!', Math.max(20, Math.min(W - 20, b.x)), ROAD_TOP - 6);
    }
  }

  // floats
  for (let i = G.floats.length - 1; i >= 0; i--) {
    const f = G.floats[i];
    f.t += dt; f.y -= 14 * dt;
    if (f.t > 1.1) G.floats.splice(i, 1);
  }
}
function sameOrder(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ------------------------------------------------------------
// Drawing — background & scene
// ------------------------------------------------------------
function drawSky(g) {
  const grad = g.createLinearGradient(0, 0, 0, ROAD_TOP);
  grad.addColorStop(0, '#5aa7e8'); grad.addColorStop(1, '#a8d8f0');
  g.fillStyle = grad; g.fillRect(0, 0, W, ROAD_TOP);
  // sun
  g.fillStyle = '#fff3b8'; g.fillRect(232, 22, 14, 14);
  g.fillStyle = '#ffe98a'; g.fillRect(234, 24, 10, 10);
  // clouds (drift)
  g.fillStyle = '#ffffff';
  const cxo = (time * 4) % (W + 80) - 60;
  for (const [ox, oy, w] of [[cxo, 20, 34], [(cxo + 130) % (W + 80) - 40, 34, 26], [(cxo + 210) % (W + 80) - 40, 12, 22]]) {
    g.fillRect(ox, oy, w, 6); g.fillRect(ox + 5, oy - 4, w - 12, 4);
  }
  // skyline
  g.fillStyle = '#7ba8cc';
  for (let i = 0; i < 9; i++) {
    const bw = 22 + (i * 37) % 18, bh = 14 + (i * 53) % 22;
    g.fillRect(i * 31 - 6, ROAD_TOP - 12 - bh, bw, bh + 12);
  }
  // billboard
  g.fillStyle = '#5b3a20'; g.fillRect(160, 32, 4, 18);
  g.fillStyle = '#e5484d'; g.fillRect(148, 12, 58, 22);
  g.fillStyle = '#fff3d1'; g.fillRect(151, 15, 52, 16);
  g.fillStyle = '#e5484d';
  g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('DASH', 177, 20); g.fillText('BURGER', 177, 28);
  // hedge
  g.fillStyle = '#4da834'; g.fillRect(0, ROAD_TOP - 8, W, 8);
  g.fillStyle = '#3c8828';
  for (let i = 0; i < W; i += 7) g.fillRect(i, ROAD_TOP - 8 + (i % 3), 4, 3);
}
function drawRoad(g) {
  g.fillStyle = '#3a3f4a'; g.fillRect(0, ROAD_TOP, W, ROAD_BOT - ROAD_TOP);
  g.fillStyle = '#4a5261'; g.fillRect(0, ROAD_TOP, W, 2); g.fillRect(0, ROAD_BOT - 2, W, 2);
  g.fillStyle = '#e8e6df';
  const off = -((time * 30) % 24);
  for (let x = off; x < W; x += 24) g.fillRect(x, ROAD_TOP + 37, 12, 2);
}
function drawCounterZone(g) {
  const WT = WINDOWS[save.eq.window];
  // wall
  g.fillStyle = WT.wall; g.fillRect(0, COUNTER_TOP, W, KITCHEN_TOP - COUNTER_TOP);
  g.fillStyle = WT.wallSh;
  for (let y = COUNTER_TOP + 8; y < KITCHEN_TOP; y += 8)
    for (let x = ((y / 8) | 0) % 2 * 10; x < W; x += 20) g.fillRect(x, y, 9, 1);
  // awning
  for (let x = 0; x < W; x += 20) {
    g.fillStyle = WT.awn1; g.fillRect(x, COUNTER_TOP - 6, 10, 10);
    g.fillStyle = WT.awn2; g.fillRect(x + 10, COUNTER_TOP - 6, 10, 10);
  }
  g.fillStyle = shade(WT.awn1, -50); g.fillRect(0, COUNTER_TOP + 4, W, 2);
  // serving window
  const wx = CHAR_X - 12, ww = 60, wy = COUNTER_TOP + 8, wh = KITCHEN_TOP - COUNTER_TOP - 12;
  g.fillStyle = WT.frame; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
  g.fillStyle = '#1b1626'; g.fillRect(wx, wy, ww, wh);
  if (WT.glow) {
    g.fillStyle = WT.glow;
    g.fillRect(wx - 3, wy - 5, ww + 6, 1);
    if ((time * 2 | 0) % 2) g.fillRect(wx - 5, wy, 1, wh);
    else g.fillRect(wx + ww + 4, wy, 1, wh);
  }
  // character behind the window (torso, scale 2)
  const spr = charTorsos[save.eq.outfit];
  const bob = Math.round(Math.sin(time * 3) * 1);
  g.drawImage(spr, CHAR_X - 6, CHAR_Y + bob, spr.width * 2, spr.height * 2);
  // toss arm + bag when a bag was just thrown
  // counter sill
  g.fillStyle = WT.counter; g.fillRect(wx - 6, KITCHEN_TOP - 8, ww + 12, 8);
  g.fillStyle = shade(WT.counter, 30); g.fillRect(wx - 6, KITCHEN_TOP - 8, ww + 12, 2);
}
function drawBagSprite(g, x, y) {
  g.fillStyle = '#d8a35c'; g.fillRect(x - 5, y - 6, 10, 12);
  g.fillStyle = '#b9843d'; g.fillRect(x - 5, y - 6, 10, 2);
  g.fillStyle = '#f3d9a8'; g.fillRect(x - 3, y - 1, 6, 4);
  g.fillStyle = '#e5484d'; g.fillRect(x - 2, y, 4, 2);
}
function drawOrderBubble(g, car) {
  const layers = car.order.length;
  const bh = layers * 4 + 12, bw = 30;
  const bx = Math.round(Math.max(4, Math.min(W - bw - 4, carWinCenter(car) - bw / 2)));
  const by = Math.round(carTop(car) - bh - 8);
  g.fillStyle = car.angry ? '#ffdada' : '#ffffff';
  g.fillRect(bx, by, bw, bh);
  g.fillStyle = '#2a1a26';
  g.strokeStyle = '#2a1a26'; g.lineWidth = 1;
  g.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  // tail
  g.fillStyle = car.angry ? '#ffdada' : '#ffffff';
  g.fillRect(Math.round(carWinCenter(car)) - 2, by + bh, 4, 4);
  // mini burger
  drawBurger(g, car.order, bx + bw / 2, by + bh - 3, 18, 3, 1);
  if (car.angry && (time * 4 | 0) % 2) {
    g.fillStyle = '#e5484d'; g.font = 'bold 7px monospace';
    g.textAlign = 'center'; g.fillText('!', bx + bw - 5, by + 8);
  }
}
function drawKitchen(g) {
  // steel counter
  g.fillStyle = '#39404e'; g.fillRect(0, KITCHEN_TOP, W, H - KITCHEN_TOP);
  g.fillStyle = '#434b5c'; g.fillRect(0, KITCHEN_TOP, W, 3);
  // tray
  g.fillStyle = '#59637a'; g.fillRect(STACK_CX - 44, STACK_BASE + 2, 88, 5);
  g.fillStyle = '#6d7892'; g.fillRect(STACK_CX - 44, STACK_BASE + 2, 88, 2);
  // current stack
  if (G.stack.length) drawBurger(g, G.stack, STACK_CX, STACK_BASE + 2, 56, 9, 1);
  // serve hint
  if (G.stack.length >= 2 && !G.bag) {
    const pulse = (Math.sin(time * 6) + 1) / 2;
    g.globalAlpha = 0.5 + pulse * 0.5;
    g.fillStyle = '#7dffb0';
    const ax = STACK_CX + 62, ay = 300;
    g.fillRect(ax - 2, ay, 4, 14);
    g.fillRect(ax - 5, ay + 2, 10, 3);
    g.fillRect(ax - 3, ay - 2, 6, 3);
    g.font = 'bold 7px monospace'; g.textAlign = 'center';
    g.fillText('SWIPE', ax, ay + 24);
    g.fillText('UP!', ax, ay + 32);
    g.globalAlpha = 1;
  }
  // scrap button
  if (G.stack.length) {
    button(g, 8, KITCHEN_TOP + 8, 40, 18, '#5c3038', 'SCRAP', '#ffb0b0', () => scrapStack());
  }
  // ingredient buttons
  const bw = 50, gap = 3, x0 = (W - (bw * 5 + gap * 4)) / 2;
  ING.forEach((type, i) => {
    const bx = x0 + i * (bw + gap);
    const r = { x: bx, y: BTN_Y, w: bw, h: BTN_H };
    hits.push({ ...r, cb: () => addIngredient(type) });
    g.fillStyle = '#232936'; g.fillRect(bx, BTN_Y, bw, BTN_H);
    g.fillStyle = '#2e3648'; g.fillRect(bx, BTN_Y, bw, 3);
    g.fillStyle = '#161a24'; g.fillRect(bx, BTN_Y + BTN_H - 3, bw, 3);
    drawLayer(g, type, bx + 10, BTN_Y + 16, 30, 8);
    g.fillStyle = '#c8cede'; g.font = '7px monospace'; g.textAlign = 'center';
    g.fillText(ING_LABEL[type], bx + bw / 2, BTN_Y + 44);
    g.fillStyle = '#6d7892';
    g.fillText(ING_KEY[type], bx + bw / 2, BTN_Y + 53);
  });
}
function drawHUD(g) {
  g.font = 'bold 9px monospace'; g.textAlign = 'left'; g.textBaseline = 'top';
  g.fillStyle = '#12081f'; g.fillText('SCORE ' + G.score, 6, 5);
  g.fillStyle = '#ffffff'; g.fillText('SCORE ' + G.score, 5, 4);
  // combo
  if (G.combo > 1) {
    g.fillStyle = '#12081f';
    g.fillText('x' + comboMult().toFixed(1) + '  ' + G.combo + ' COMBO', 6, 16);
    g.fillStyle = '#ffd76a';
    g.fillText('x' + comboMult().toFixed(1) + '  ' + G.combo + ' COMBO', 5, 15);
  }
  // combo meter
  const mw = 80, mx = 5, my = 27;
  g.fillStyle = '#232936'; g.fillRect(mx, my, mw, 4);
  g.fillStyle = G.combo >= 20 ? '#ff7d3a' : '#ffd76a';
  g.fillRect(mx, my, Math.round(mw * Math.min(G.combo, 20) / 20), 4);
  // lives
  for (let i = 0; i < 3; i++) {
    const hx = W - 16 - i * 14;
    g.fillStyle = i < G.lives ? '#e5484d' : '#3a3f4a';
    g.fillRect(hx, 5, 4, 4); g.fillRect(hx + 6, 5, 4, 4);
    g.fillRect(hx, 8, 10, 4); g.fillRect(hx + 2, 12, 6, 2); g.fillRect(hx + 4, 14, 2, 1);
  }
}
function drawTutorial(g) {
  if (!G.tut || G.t > 14) return;
  g.globalAlpha = 0.88;
  g.fillStyle = '#12081f'; g.fillRect(20, 232, W - 40, 92);
  g.globalAlpha = 1;
  g.strokeStyle = '#ffd76a'; g.strokeRect(20.5, 232.5, W - 41, 91);
  g.fillStyle = '#ffd76a'; g.font = 'bold 9px monospace'; g.textAlign = 'center';
  g.fillText('HOW TO PLAY', W / 2, 244);
  g.fillStyle = '#ffffff'; g.font = '8px monospace';
  g.fillText('1. Check the car\'s order bubble', W / 2, 262);
  g.fillText('2. Tap ingredients in order', W / 2, 276);
  g.fillText('3. SWIPE UP to toss the bag', W / 2, 290);
  g.fillText('through the car window!', W / 2, 302);
  g.fillStyle = '#7dffb0'; g.fillText('(keys 1-5 + SPACE work too)', W / 2, 316);
}

function drawPlay(g) {
  drawSky(g); drawRoad(g);
  for (const car of G.cars) {
    g.drawImage(car.sprite, Math.round(car.x), carTop(car));
    if (!car.served) drawOrderBubble(g, car);
  }
  drawCounterZone(g);
  drawKitchen(g);
  if (G.bag) drawBagSprite(g, Math.round(G.bag.x), Math.round(G.bag.y));
  for (const f of G.floats) {
    g.globalAlpha = Math.max(0, 1 - f.t / 1.1);
    g.fillStyle = f.color; g.font = 'bold 9px monospace'; g.textAlign = 'center';
    g.fillText(f.text, Math.round(f.x), Math.round(f.y));
    g.globalAlpha = 1;
  }
  drawHUD(g);
  drawTutorial(g);
  if (G.flash > 0) {
    g.globalAlpha = G.flash * 0.5;
    g.fillStyle = '#e5484d'; g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
}

// ------------------------------------------------------------
// UI helpers
// ------------------------------------------------------------
function button(g, x, y, w, h, bg, label, fg, cb, small) {
  hits.push({ x, y, w, h, cb });
  g.fillStyle = bg; g.fillRect(x, y, w, h);
  g.fillStyle = shade(bg, 30); g.fillRect(x, y, w, 2);
  g.fillStyle = shade(bg, -40); g.fillRect(x, y + h - 2, w, 2);
  g.fillStyle = fg; g.font = (small ? '' : 'bold ') + (small ? 7 : 9) + 'px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, x + w / 2, y + h / 2 + 1);
}
function coinIcon(g, x, y) {
  g.fillStyle = '#f0b429'; g.fillRect(x, y + 1, 8, 6); g.fillRect(x + 1, y, 6, 8);
  g.fillStyle = '#ffd76a'; g.fillRect(x + 2, y + 1, 2, 5);
}

// ------------------------------------------------------------
// Menu
// ------------------------------------------------------------
function drawMenu(g) {
  drawSky(g); drawRoad(g);
  // parked hero car
  if (!menuCar) menuCar = makeCarSprite('sports', '#e5484d', 3);
  g.drawImage(menuCar, 168, CAR_BASE - CAR_TYPES.sports.h);
  drawCounterZone(g);
  g.fillStyle = '#39404e'; g.fillRect(0, KITCHEN_TOP, W, H - KITCHEN_TOP);
  g.fillStyle = '#434b5c'; g.fillRect(0, KITCHEN_TOP, W, 3);

  // title
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#12081f';
  g.font = 'bold 20px monospace';
  g.fillText('DRIVE-THRU', W / 2 + 1, 243);
  g.fillText('DASH', W / 2 + 1, 265);
  g.fillStyle = '#ffd76a';
  g.fillText('DRIVE-THRU', W / 2, 241);
  g.fillText('DASH', W / 2, 263);
  g.fillStyle = '#7dffb0'; g.font = '8px monospace';
  g.fillText('~ serve \'em hot, serve \'em fast ~', W / 2, 282);

  // character full sprite
  const spr = charSprites[save.eq.outfit];
  const bob = Math.round(Math.sin(time * 3));
  g.drawImage(spr, 30, 300 + bob, spr.width * 2, spr.height * 2);

  // stats
  g.textAlign = 'left'; g.font = 'bold 9px monospace';
  coinIcon(g, 96, 306);
  g.fillStyle = '#ffd76a'; g.fillText(String(save.coins), 110, 311);
  g.fillStyle = '#c8cede'; g.fillText('BEST ' + save.best, 96, 324);

  button(g, 96, 340, 150, 34, '#3c8828', 'PLAY', '#ffffff', startPlay);
  button(g, 96, 382, 150, 28, '#3f78d8', 'SHOP', '#ffffff', () => { mode = 'shop'; SFX.tap(); });
  button(g, 96, 418, 72, 24, '#4a5261', save.muted ? 'SOUND OFF' : 'SOUND ON', save.muted ? '#8a93a8' : '#7dffb0', toggleMute, true);
  g.fillStyle = '#6d7892'; g.font = '7px monospace'; g.textAlign = 'center';
  g.fillText('32-BIT ARCADE ACTION', W / 2, 466);
}
let menuCar = null;
function toggleMute() {
  save.muted = !save.muted; persist();
  if (!save.muted) { audio(); musicStart(); SFX.tap(); }
}
function startPlay() {
  audio(); musicStart();
  music.tempoMult = 1;
  resetRun();
  mode = 'play';
  SFX.tap();
}

// ------------------------------------------------------------
// Shop
// ------------------------------------------------------------
function shopItems() {
  return [OUTFITS, WINDOWS, SONG_META][shopTab];
}
const SHOP_KEYS = ['outfit', 'window', 'music'];
function drawShop(g) {
  g.fillStyle = '#1a1230'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#241a40'; g.fillRect(0, 0, W, 34);
  g.fillStyle = '#ffd76a'; g.font = 'bold 12px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('SHOP', W / 2, 14);
  coinIcon(g, W / 2 - 24, 22); g.font = 'bold 9px monospace';
  g.fillText(String(save.coins), W / 2 + 8, 27);
  button(g, 6, 6, 40, 22, '#4a5261', 'BACK', '#ffffff', () => { mode = 'menu'; SFX.tap(); }, true);

  // tabs
  const tabs = ['OUTFITS', 'WINDOW', 'MUSIC'];
  tabs.forEach((t, i) => {
    const tx = 8 + i * 86;
    button(g, tx, 40, 82, 22, i === shopTab ? '#3f78d8' : '#2a2248', t, i === shopTab ? '#fff' : '#8a93a8',
      () => { shopTab = i; SFX.tap(); }, true);
  });

  const key = SHOP_KEYS[shopTab];
  shopItems().forEach((item, i) => {
    const iy = 74 + i * 74;
    const owned = save.owned[key].includes(i);
    const equipped = save.eq[key] === i;
    g.fillStyle = equipped ? '#243a5c' : '#241a40';
    g.fillRect(8, iy, W - 16, 66);
    if (equipped) { g.strokeStyle = '#7dffb0'; g.strokeRect(8.5, iy + 0.5, W - 17, 65); }

    // preview
    if (shopTab === 0) {
      const spr = charSprites[i];
      g.drawImage(spr, 18, iy + 7, spr.width * 1.5, spr.height * 1.5);
    } else if (shopTab === 1) {
      const WT = WINDOWS[i];
      for (let x = 0; x < 44; x += 12) {
        g.fillStyle = WT.awn1; g.fillRect(16 + x, iy + 14, 6, 10);
        g.fillStyle = WT.awn2; g.fillRect(22 + x, iy + 14, 6, 10);
      }
      g.fillStyle = WT.wall; g.fillRect(16, iy + 24, 44, 26);
      g.fillStyle = WT.frame; g.fillRect(24, iy + 28, 28, 18);
      g.fillStyle = '#1b1626'; g.fillRect(26, iy + 30, 24, 14);
      if (WT.glow) { g.fillStyle = WT.glow; g.fillRect(24, iy + 25, 28, 1); }
    } else {
      g.fillStyle = equipped ? '#7dffb0' : '#8a93a8';
      g.font = 'bold 16px monospace'; g.textAlign = 'center';
      g.fillText('♪', 38, iy + 30);
      const song = SONGS[i];
      g.font = '7px monospace';
      g.fillText(song.bpm + ' BPM', 38, iy + 48);
    }

    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = '#ffffff'; g.font = 'bold 9px monospace';
    g.fillText(item.name, 74, iy + 18);
    g.font = '7px monospace'; g.fillStyle = '#8a93a8';
    if (shopTab === 0) g.fillText('A fresh look for the chef', 74, iy + 30);
    if (shopTab === 1) g.fillText('Restyle your drive-thru', 74, iy + 30);
    if (shopTab === 2) g.fillText('New in-game soundtrack', 74, iy + 30);

    if (equipped) {
      g.fillStyle = '#7dffb0'; g.font = 'bold 8px monospace';
      g.fillText('EQUIPPED', 74, iy + 48);
    } else if (owned) {
      button(g, 74, iy + 40, 60, 18, '#3c8828', 'EQUIP', '#fff', () => {
        save.eq[key] = i; persist(); SFX.tap();
        if (key === 'music') { music.step = 0; }
      }, true);
    } else {
      const afford = save.coins >= item.price;
      button(g, 74, iy + 40, 84, 18, afford ? '#8a6a1c' : '#3a3648',
        'BUY ' + item.price + 'c', afford ? '#ffd76a' : '#6d7892', () => {
          if (save.coins < item.price) { SFX.scrap(); return; }
          save.coins -= item.price;
          save.owned[key].push(i);
          save.eq[key] = i;
          persist(); SFX.buy();
        }, true);
    }
  });
  g.fillStyle = '#6d7892'; g.font = '7px monospace'; g.textAlign = 'center';
  g.fillText('Earn coins by scoring big in-game!', W / 2, H - 10);
}

// ------------------------------------------------------------
// Game over
// ------------------------------------------------------------
function drawOver(g, dt) {
  G.over += dt;
  drawPlay(g);
  g.globalAlpha = Math.min(0.82, G.over * 1.5);
  g.fillStyle = '#12081f'; g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  if (G.over < 0.4) return;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#e5484d'; g.font = 'bold 18px monospace';
  g.fillText('CLOSING TIME!', W / 2, 150);
  g.fillStyle = '#ffffff'; g.font = 'bold 11px monospace';
  g.fillText('SCORE  ' + G.score, W / 2, 186);
  g.fillStyle = '#c8cede'; g.font = '9px monospace';
  g.fillText('BEST COMBO  x' + G.bestCombo, W / 2, 204);
  g.fillText('CARS SERVED  ' + G.served, W / 2, 218);
  coinIcon(g, W / 2 - 34, 232);
  g.fillStyle = '#ffd76a'; g.font = 'bold 10px monospace';
  g.fillText('+' + G.earned + ' COINS', W / 2 + 8, 237);
  if (G.score >= save.best && G.score > 0) {
    g.fillStyle = '#7dffb0'; g.font = 'bold 9px monospace';
    g.fillText('★ NEW BEST! ★', W / 2, 258);
  }
  button(g, 60, 286, 150, 32, '#3c8828', 'PLAY AGAIN', '#ffffff', startPlay);
  button(g, 60, 326, 150, 26, '#3f78d8', 'MENU', '#ffffff', () => { mode = 'menu'; musicStart(); SFX.tap(); });
}

// ------------------------------------------------------------
// Input
// ------------------------------------------------------------
let ptr = null;
function canvasPos(e) {
  const r = cv.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return { x: (t.clientX - r.left) / r.width * W, y: (t.clientY - r.top) / r.height * H };
}
function onDown(e) {
  e.preventDefault();
  audio();
  if (!music.timer && !save.muted) musicStart();
  const p = canvasPos(e);
  ptr = { x0: p.x, y0: p.y, x: p.x, y: p.y, t: performance.now() };
  for (const h of hits) {
    if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) {
      h.cb();
      ptr = null;
      return;
    }
  }
}
function onMove(e) {
  if (!ptr) return;
  const p = canvasPos(e);
  ptr.x = p.x; ptr.y = p.y;
  // fast swipe up = serve, resolved mid-gesture for snappy feel
  if (mode === 'play' && ptr.y0 > KITCHEN_TOP - 30 && ptr.y0 - ptr.y > 42) {
    const dx = ptr.x - ptr.x0;
    tossBag(dx * 2.2);
    ptr = null;
  }
}
function onUp() {
  if (!ptr) return;
  if (mode === 'play' && ptr.y0 > KITCHEN_TOP - 30) {
    const dy = ptr.y0 - ptr.y, dx = ptr.x - ptr.x0;
    if (dy > 26 && dy > Math.abs(dx) * 0.8) tossBag(dx * 2.2);
  }
  ptr = null;
}
cv.addEventListener('mousedown', onDown);
cv.addEventListener('mousemove', onMove);
addEventListener('mouseup', onUp);
cv.addEventListener('touchstart', onDown, { passive: false });
cv.addEventListener('touchmove', onMove, { passive: false });
cv.addEventListener('touchend', onUp);

addEventListener('keydown', e => {
  if (mode === 'play') {
    const i = '12345'.indexOf(e.key);
    if (i >= 0) addIngredient(ING[i]);
    if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); tossBag(0); }
    if (e.key === 'Backspace' || e.key === 'x') scrapStack();
  } else if (e.key === ' ' || e.key === 'Enter') {
    if (mode === 'menu' || mode === 'over') startPlay();
  }
  if (e.key === 'Escape' && mode !== 'menu') { mode = 'menu'; if (mode !== 'play') musicStart(); }
});

// ------------------------------------------------------------
// Main loop
// ------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  hits = [];
  cx.save();
  if (mode === 'play' && G.shake > 0) {
    cx.translate((Math.random() - 0.5) * 4 * G.shake * 3, (Math.random() - 0.5) * 4 * G.shake * 3);
  }
  cx.clearRect(-4, -4, W + 8, H + 8);
  if (mode === 'play') { updatePlay(dt); drawPlay(cx); }
  else if (mode === 'menu') drawMenu(cx);
  else if (mode === 'shop') drawShop(cx);
  else if (mode === 'over') drawOver(cx, dt);
  cx.restore();
  requestAnimationFrame(frame);
}
resetRun();
requestAnimationFrame(frame);

// tiny debug/test handle
window.__DTD = { G, save, addIngredient, tossBag, startPlay, carWinCenter, carTop, TOSS_X, TOSS_Y };

})();
