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
  { name: 'Classic Red',  price: 0,    awn1: '#e5484d', awn2: '#f7f3e6', wall: '#c98652', wallSh: '#a2683c', mortar: '#b0754a', counter: '#8a5a33', frame: '#5b3a20', glow: null },
  { name: 'Neon Nights',  price: 400,  awn1: '#22d3ee', awn2: '#182448', wall: '#2a3355', wallSh: '#1d2440', mortar: '#232c48', counter: '#232c4a', frame: '#22d3ee', glow: '#22d3ee' },
  { name: 'Mint Retro',   price: 700,  awn1: '#43bd82', awn2: '#fdf6e3', wall: '#e8dcc4', wallSh: '#c9bda2', mortar: '#d6c9ae', counter: '#4f9e74', frame: '#2f6a4b', glow: null },
  { name: 'Gold Deluxe',  price: 1200, awn1: '#f0b429', awn2: '#6e4812', wall: '#8a5a33', wallSh: '#6e4527', mortar: '#7a4e2c', counter: '#b98a2e', frame: '#f0b429', glow: '#ffd76a' },
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
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, v + amt));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('');
}
// deterministic pseudo-random for stable textures
function prand(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// ------------------------------------------------------------
// The main character — human, clean & simple 32-bit sprite.
// Blonde bob, purple eyes & earrings, freckles, simple brown nose.
// ------------------------------------------------------------
const CHAR_MAP = [
  '...OOOOOOOOO......',
  '..OHAAAHHHHHOO....',
  '.OHAAHHHHHHHHHO...',
  '.OHAHHHHHHHHHHHO..',
  'OHAHHHHHHHHHHHHO..',
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
    O: '#2a1a26', H: '#f2d16b', h: '#d3a83f', A: '#fbe89a',
    S: '#dda071', s: '#bd8154', f: '#c07b46',
    W: '#ffffff', E: '#8a4fd0', N: '#6b4632', p: '#a05fe0',
    T: outfit.top, t: outfit.topSh,
    K: outfit.skirt, k: outfit.skirtSh,
    C: outfit.shoe, w: '#e8e6df',
  };
}
const blinkMap = rows => rows.map((r, i) => i === 8 ? r.replace('SWES', 'SssS') : r);
const charSprites = OUTFITS.map(o => spriteFromMap(CHAR_MAP, charPalette(o)));
const charTorsos  = OUTFITS.map(o =>
  spriteFromMap(CHAR_MAP.slice(0, CHAR_TORSO_ROWS), charPalette(o)));
const charTorsosBlink = OUTFITS.map(o =>
  spriteFromMap(blinkMap(CHAR_MAP).slice(0, CHAR_TORSO_ROWS), charPalette(o)));

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
    g.fillStyle = '#fff3d1'; g.fillRect(x + 2, y, r(w / 4), 1);
  } else if (type === 'patty') {
    g.fillStyle = '#7a4a28'; g.fillRect(x, y, w, h);
    g.fillStyle = '#5f3820'; g.fillRect(x, y + h - r(h / 3), w, r(h / 3));
    g.fillStyle = '#8f5c35';
    for (let i = x + 2; i < x + w - 2; i += 4) g.fillRect(i, y + 1, 1, 1);
    g.fillStyle = '#4a2b18'; g.fillRect(x, y + h - 1, w, 1);
  } else if (type === 'cheese') {
    g.fillStyle = '#ffc933'; g.fillRect(x, y, w, h);
    g.fillStyle = '#ffe27a'; g.fillRect(x + 1, y, w - 2, 1);
    g.fillStyle = '#e8a614';
    g.fillRect(x, y + h - 1, w, 1);
    g.fillRect(x + r(w / 5), y + h - 1, 2, 2);
    g.fillRect(x + w - r(w / 4), y + h - 1, 2, 2);
  } else if (type === 'lettuce') {
    g.fillStyle = '#6fce4e'; g.fillRect(x, y, w, h);
    g.fillStyle = '#95e276'; g.fillRect(x + 1, y, w - 2, 1);
    g.fillStyle = '#4da834';
    for (let i = x; i < x + w; i += 3) g.fillRect(i, y + h - 1, 2, 1);
  } else if (type === 'bun_t') {
    const hh = h + r(h / 2);
    const yy = y - r(h / 2);
    g.fillStyle = '#e8a54b'; g.fillRect(x, yy + 1, w, hh - 1);
    g.fillStyle = '#f3bc6a'; g.fillRect(x + 1, yy, w - 2, 2);
    g.fillStyle = '#fbd692'; g.fillRect(x + 2, yy, r(w / 3), 1);
    g.fillStyle = '#fff3d1'; // sesame
    for (let i = x + 3; i < x + w - 3; i += 5) g.fillRect(i, yy + 2, 1, 1);
    for (let i = x + 5; i < x + w - 3; i += 5) g.fillRect(i, yy + 4, 1, 1);
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
// Cars — procedural pixel sprites with shading, glass shine,
// drivers, and 2-frame spinning wheels
// ------------------------------------------------------------
const CAR_TYPES = {
  minivan: { w: 76, h: 38, spd: [30, 42],  winX: 46, winW: 14, cabX: 8,  cabW: 58, cabH: 14, wheels: [11, 55] },
  sedan:   { w: 64, h: 32, spd: [46, 60],  winX: 38, winW: 13, cabX: 12, cabW: 40, cabH: 11, wheels: [9, 45] },
  pickup:  { w: 72, h: 34, spd: [54, 70],  winX: 40, winW: 13, cabX: 30, cabW: 26, cabH: 12, wheels: [10, 52] },
  sports:  { w: 62, h: 26, spd: [82, 104], winX: 34, winW: 14, cabX: 16, cabW: 34, cabH: 9,  wheels: [8, 44] },
};
const CAR_COLORS = ['#d63e43', '#3f78d8', '#43bd82', '#e8963a', '#9a63d8', '#4fc3d8', '#b8bcc8', '#e0ca3c'];
const DRIVER_SKIN = ['#dda071', '#b97f52', '#8a5a3c', '#e8b88a'];
const DRIVER_HAIR = ['#2a2028', '#6b4632', '#f2d16b', '#b0453a', '#888888', '#3f2a5c'];

function drawWheel(g, x, y, alt) {
  // 12x11 tire with rim + spokes (two rotation frames)
  g.fillStyle = '#14161c';
  g.fillRect(x + 1, y, 10, 11); g.fillRect(x, y + 1, 12, 9);
  g.fillStyle = '#2c313d';
  g.fillRect(x + 2, y + 1, 8, 1); // tire highlight
  g.fillStyle = '#9aa3b8';
  g.fillRect(x + 4, y + 3, 4, 5); g.fillRect(x + 3, y + 4, 6, 3); // rim
  g.fillStyle = '#5a6274';
  if (alt) { g.fillRect(x + 5, y + 3, 2, 5); g.fillRect(x + 3, y + 5, 6, 1); }
  else     { g.fillRect(x + 4, y + 4, 1, 1); g.fillRect(x + 7, y + 4, 1, 1);
             g.fillRect(x + 4, y + 6, 1, 1); g.fillRect(x + 7, y + 6, 1, 1); }
  g.fillStyle = '#c8cede'; g.fillRect(x + 5, y + 5, 2, 1); // hub
}

function makeCarSprite(typeName, color, seed) {
  const T = CAR_TYPES[typeName];
  const dark = shade(color, -50), mid = color, light = shade(color, 38), lighter = shade(color, 78);
  return [0, 1].map(alt => {
    const [c, g] = makeCanvas(T.w, T.h);
    const bodyY = T.h - 16;      // top of the 12px body band; wheels overlap below
    const cabTop = bodyY - T.cabH;

    // ---- cabin ----
    g.fillStyle = mid;   g.fillRect(T.cabX, cabTop + 1, T.cabW, T.cabH);
    g.fillStyle = light; g.fillRect(T.cabX + 2, cabTop, T.cabW - 4, 2);
    g.fillStyle = lighter; g.fillRect(T.cabX + 3, cabTop, Math.max(4, T.cabW >> 2), 1);
    // glass (closed sections)
    g.fillStyle = '#274a66'; g.fillRect(T.cabX + 3, cabTop + 3, T.cabW - 6, T.cabH - 3);
    g.fillStyle = '#3f6f8f'; g.fillRect(T.cabX + 3, cabTop + 3, T.cabW - 6, 2);
    g.fillStyle = '#bfe8ff'; // diagonal shine
    for (let i = 0; i < 3; i++) g.fillRect(T.cabX + 6 + i, cabTop + 5 - Math.min(2, i), 1, 3);
    // pillars
    g.fillStyle = dark;
    g.fillRect(T.cabX + 1, cabTop + 2, 2, T.cabH - 1);
    g.fillRect(T.cabX + T.cabW - 3, cabTop + 2, 2, T.cabH - 1);

    // ---- open window + driver ----
    const wx = T.winX, ww = T.winW;
    g.fillStyle = '#0d1118'; g.fillRect(wx, cabTop + 2, ww, T.cabH - 2);
    const skin = DRIVER_SKIN[seed % DRIVER_SKIN.length];
    const hair = DRIVER_HAIR[seed % DRIVER_HAIR.length];
    g.fillStyle = skin; g.fillRect(wx + 4, cabTop + 5, 6, 6);
    g.fillStyle = hair; g.fillRect(wx + 3, cabTop + 4, 8, 3);
    g.fillStyle = shade(hair, -30); g.fillRect(wx + 3, cabTop + 6, 2, 3); // sideburn
    g.fillStyle = '#2a1a26'; g.fillRect(wx + 8, cabTop + 7, 1, 1);        // eye
    g.fillStyle = lighter; g.fillRect(wx - 1, cabTop + 2, 1, T.cabH - 2); // frame shine

    // ---- body ----
    g.fillStyle = mid;  g.fillRect(0, bodyY, T.w, 12);
    g.fillStyle = mid;  g.fillRect(1, bodyY - 1, T.w - 2, 1);             // rounded top edge
    g.fillStyle = light; g.fillRect(2, bodyY, T.w - 4, 2);                // top highlight
    g.fillStyle = lighter; g.fillRect(4, bodyY, (T.w / 3) | 0, 1);        // specular streak
    g.fillStyle = dark; g.fillRect(0, bodyY + 8, T.w, 2);                 // lower shade
    g.fillStyle = '#1a1d26'; g.fillRect(1, bodyY + 10, T.w - 2, 2);       // skirt
    // hood slope (front-right corner cut)
    g.clearRect(T.w - 2, bodyY - 1, 2, 1);
    g.fillStyle = light; g.fillRect(T.w - 6, bodyY, 4, 1);
    // door seam & handle
    g.fillStyle = dark;
    g.fillRect(wx - 2, bodyY, 1, 8);
    g.fillRect(wx + ww + 2, bodyY, 1, 8);
    g.fillStyle = '#e8e6df'; g.fillRect(wx + 2, bodyY + 3, 4, 1);         // handle
    g.fillStyle = skin; g.fillRect(wx + 2, bodyY - 1, ww - 4, 2);         // arm on sill
    g.fillStyle = shade(skin, -30); g.fillRect(wx + 2, bodyY, ww - 4, 1);

    // ---- type extras ----
    if (typeName === 'pickup') {   // truck bed
      g.fillStyle = dark; g.fillRect(2, bodyY - 8, T.cabX - 5, 8);
      g.fillStyle = mid;  g.fillRect(2, bodyY - 8, T.cabX - 5, 2);
      g.fillStyle = light; g.fillRect(3, bodyY - 8, T.cabX - 7, 1);
    }
    if (typeName === 'sports') {   // spoiler + vent
      g.fillStyle = dark; g.fillRect(0, bodyY - 6, 9, 2); g.fillRect(3, bodyY - 4, 2, 4);
      g.fillStyle = light; g.fillRect(1, bodyY - 6, 7, 1);
      g.fillStyle = dark;
      for (let i = 0; i < 3; i++) g.fillRect(T.w - 14 + i * 3, bodyY + 4, 1, 3);
    }
    if (typeName === 'minivan') {  // roof rack
      g.fillStyle = '#4a5261';
      g.fillRect(T.cabX + 6, cabTop - 1, T.cabW - 20, 1);
      g.fillRect(T.cabX + 8, cabTop, 2, 1); g.fillRect(T.cabX + T.cabW - 18, cabTop, 2, 1);
    }

    // ---- chrome, lights ----
    g.fillStyle = '#c8cede';
    g.fillRect(T.w - 3, bodyY + 6, 3, 3);   // front bumper
    g.fillRect(0, bodyY + 6, 2, 3);         // rear bumper
    g.fillStyle = '#fff3d1'; g.fillRect(T.w - 2, bodyY + 2, 2, 3);  // headlight
    g.fillStyle = '#ffe27a'; g.fillRect(T.w - 1, bodyY + 2, 1, 3);
    g.fillStyle = '#e5484d'; g.fillRect(0, bodyY + 2, 2, 3);        // tail light

    // ---- wheel wells + wheels ----
    for (const wxp of T.wheels) {
      g.fillStyle = '#1a1d26'; g.fillRect(wxp - 2, T.h - 12, 16, 6);
      drawWheel(g, wxp, T.h - 11, alt);
    }
    return c;
  });
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
// Pre-rendered scenery textures
// ------------------------------------------------------------
const roadTex = (() => {
  const [c, g] = makeCanvas(W, ROAD_BOT - ROAD_TOP);
  g.fillStyle = '#3a3f4a'; g.fillRect(0, 0, W, c.height);
  for (let i = 0; i < 420; i++) {
    const x = (prand(i) * W) | 0, y = (prand(i + 999) * c.height) | 0;
    g.fillStyle = prand(i + 55) > 0.5 ? '#424855' : '#333844';
    g.fillRect(x, y, 1 + (prand(i + 7) * 2 | 0), 1);
  }
  // faint tire tracks along the lane
  g.fillStyle = 'rgba(20,22,28,0.35)';
  g.fillRect(0, 52, W, 3); g.fillRect(0, 66, W, 3);
  // edges
  g.fillStyle = '#565e6e'; g.fillRect(0, 0, W, 2);
  g.fillStyle = '#2c313d'; g.fillRect(0, 2, W, 1);
  g.fillStyle = '#565e6e'; g.fillRect(0, c.height - 2, W, 2);
  return c;
})();

const wallTexCache = {};
function wallTex(i) {
  if (wallTexCache[i]) return wallTexCache[i];
  const WT = WINDOWS[i];
  const h = KITCHEN_TOP - COUNTER_TOP;
  const [c, g] = makeCanvas(W, h);
  g.fillStyle = WT.wall; g.fillRect(0, 0, W, h);
  // running-bond brick pattern
  for (let row = 0; row * 7 < h; row++) {
    const y = row * 7;
    g.fillStyle = WT.mortar; g.fillRect(0, y + 6, W, 1);
    const off = (row % 2) * 9;
    for (let x = off; x < W; x += 18) {
      g.fillStyle = WT.mortar; g.fillRect(x, y, 1, 7);
      if (prand(row * 31 + x) > 0.7) { g.fillStyle = WT.wallSh; g.fillRect(x + 2, y + 1, 14, 2); }
      if (prand(row * 17 + x) > 0.8) { g.fillStyle = shade(WT.wall, 18); g.fillRect(x + 2, y + 3, 8, 1); }
    }
  }
  wallTexCache[i] = c;
  return c;
}

const vignette = (() => {
  const [c, g] = makeCanvas(W, H);
  const grad = g.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, H * 0.72);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(8,4,16,0.32)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  return c;
})();

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
    stack: [], cars: [], bag: null, floats: [], parts: [], shake: 0, flash: 0,
    btnFlash: {}, spawnIn: 1.2, served: 0, tut: !save.tutorialDone, over: 0,
  });
}

// ------------------------------------------------------------
// Particles
// ------------------------------------------------------------
function spawnParts(x, y, n, colors, spd, life, grav = 90) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random() * 0.7) * spd;
    G.parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.4,
      t: 0, life: life * (0.6 + Math.random() * 0.7),
      color: colors[(Math.random() * colors.length) | 0],
      size: Math.random() < 0.3 ? 2 : 1, grav,
    });
  }
}
function puff(x, y, drift) {
  G.parts.push({
    x, y, vx: drift + (Math.random() - 0.5) * 8, vy: -8 - Math.random() * 10,
    t: 0, life: 0.7 + Math.random() * 0.4,
    color: ['#8a93a8', '#a8b0c0', '#c8cede'][(Math.random() * 3) | 0],
    size: 2, grav: -14,
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
    served: false, angry: false, puffIn: 0,
  });
}
function carWinCenter(car) { return car.x + car.T.winX + car.T.winW / 2; }
function carTop(car) { return CAR_BASE - car.T.h; }

// ------------------------------------------------------------
// Play actions
// ------------------------------------------------------------
function addIngredient(type) {
  if (G.bag) return;
  G.btnFlash[type] = 0.14;
  if (G.stack.length >= MAX_STACK) { SFX.scrap(); return; }
  G.stack.push(type);
  SFX.stack(G.stack.length);
}
function scrapStack() {
  if (!G.stack.length) return;
  spawnParts(STACK_CX, STACK_BASE - 12, 10, ['#e8a54b', '#7a4a28', '#ffc933', '#6fce4e'], 60, 0.5);
  G.stack = [];
  SFX.scrap();
}
function tossBag(vx) {
  if (G.bag || !G.stack.length) return;
  G.bag = { x: TOSS_X, y: TOSS_Y, vx: Math.max(-95, Math.min(95, vx)), vy: -330, stack: G.stack, spin: 0 };
  G.stack = [];
  puff(TOSS_X - 4, TOSS_Y, -6); puff(TOSS_X + 4, TOSS_Y, 6);
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
  const wcx = carWinCenter(car), wcy = carTop(car) + 6;
  addFloat('+' + pts, wcx, wcy - 12, '#ffd76a');
  spawnParts(wcx, wcy, 12, ['#ffd76a', '#fff3d1', '#f0b429'], 70, 0.6);
  if (perfect) {
    addFloat('PERFECT!', wcx, wcy - 22, '#7dffb0');
    spawnParts(wcx, wcy, 10, ['#7dffb0', '#c6ffe0'], 90, 0.7);
    SFX.perfect();
  }
  SFX.register();
  if (G.tut) { G.tut = false; save.tutorialDone = true; persist(); }
}
function loseLife(reason, x, y) {
  G.combo = 0;
  music.tempoMult = 1;
  G.lives--;
  G.shake = 0.35; G.flash = 0.4;
  addFloat(reason, x, y, '#ff7d7d');
  spawnParts(x, y + 8, 8, ['#ff7d7d', '#e5484d'], 60, 0.5);
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
  for (const k in G.btnFlash) G.btnFlash[k] = Math.max(0, G.btnFlash[k] - dt);

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
    car.puffIn -= dt;
    if (car.puffIn <= 0) {
      puff(car.x + 1, CAR_BASE - 6, -14);
      car.puffIn = car.served ? 0.08 : 0.22 + Math.random() * 0.2;
    }
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
    b.spin += dt * 10;
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

  // steam over a hot stack
  if (G.stack.includes('patty') && Math.random() < dt * 6) {
    puff(STACK_CX + (Math.random() - 0.5) * 30, STACK_BASE - G.stack.length * 10 - 8, 0);
  }

  // floats & particles
  for (let i = G.floats.length - 1; i >= 0; i--) {
    const f = G.floats[i];
    f.t += dt; f.y -= 14 * dt;
    if (f.t > 1.1) G.floats.splice(i, 1);
  }
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt;
    if (p.t > p.life) G.parts.splice(i, 1);
  }
}
function sameOrder(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ------------------------------------------------------------
// Drawing — background & scene
// ------------------------------------------------------------
function drawSky(g) {
  // banded sky with dithered transitions
  const bands = ['#3f8fdd', '#58a3e6', '#74b8ec', '#93cdf1', '#b5e0f6'];
  const bh = Math.ceil(ROAD_TOP / bands.length);
  bands.forEach((col, i) => {
    g.fillStyle = col; g.fillRect(0, i * bh, W, bh);
    if (i) { // 1px checker dither between bands
      g.fillStyle = bands[i - 1];
      for (let x = 0; x < W; x += 2) g.fillRect(x + (i % 2), i * bh, 1, 1);
    }
  });
  // sun with glow
  g.fillStyle = 'rgba(255,240,170,0.25)'; g.fillRect(228, 18, 22, 22);
  g.fillStyle = '#fff3b8'; g.fillRect(232, 22, 14, 14);
  g.fillStyle = '#fff9dc'; g.fillRect(234, 24, 10, 10);
  g.fillStyle = '#fff3b8';
  g.fillRect(238, 18, 2, 2); g.fillRect(238, 38, 2, 2);
  g.fillRect(226, 29, 2, 2); g.fillRect(250, 29, 2, 2);
  // birds
  g.fillStyle = '#3a5a7a';
  const bt = (time * 8) % (W + 60) - 30;
  for (const [ox, oy] of [[bt, 22], [bt + 14, 27], [bt - 90 + W, 14]]) {
    g.fillRect(ox, oy, 2, 1); g.fillRect(ox + 3, oy - 1, 2, 1); g.fillRect(ox + 6, oy, 2, 1);
  }
  // far skyline (light haze)
  g.fillStyle = '#9cc2de';
  for (let i = 0; i < 11; i++) {
    const bw = 18 + (i * 29) % 16, bhh = 10 + (i * 41) % 16;
    g.fillRect(i * 26 - 8, ROAD_TOP - 10 - bhh, bw, bhh + 10);
  }
  // near skyline with lit windows
  for (let i = 0; i < 8; i++) {
    const bx = i * 36 - 10, bw = 24 + (i * 37) % 14, bhh = 16 + (i * 53) % 24;
    const by = ROAD_TOP - 12 - bhh;
    g.fillStyle = '#6f9cc0'; g.fillRect(bx, by, bw, bhh + 12);
    g.fillStyle = '#5d88ab'; g.fillRect(bx, by, 2, bhh + 12);
    g.fillStyle = '#ffe98a';
    for (let wy = by + 3; wy < ROAD_TOP - 6; wy += 5)
      for (let wx2 = bx + 3; wx2 < bx + bw - 2; wx2 += 5)
        if (prand(i * 131 + wy * 7 + wx2) > 0.55) g.fillRect(wx2, wy, 2, 2);
  }
  // clouds (drift, 2-tone)
  const cxo = (time * 4) % (W + 80) - 60;
  for (const [ox, oy, w] of [[cxo, 20, 34], [(cxo + 130) % (W + 80) - 40, 36, 26], [(cxo + 210) % (W + 80) - 40, 10, 22]]) {
    g.fillStyle = '#ffffff';
    g.fillRect(ox, oy, w, 6); g.fillRect(ox + 5, oy - 4, w - 12, 5);
    g.fillRect(ox + 9, oy - 6, w - 20, 3);
    g.fillStyle = '#dceaf5'; g.fillRect(ox + 1, oy + 4, w - 2, 2);
  }
  // billboard
  g.fillStyle = '#4a2f18'; g.fillRect(160, 32, 4, 18); g.fillRect(190, 32, 4, 18);
  g.fillStyle = '#2a1a26'; g.fillRect(146, 10, 62, 26);
  g.fillStyle = '#e5484d'; g.fillRect(148, 12, 58, 22);
  g.fillStyle = '#fff3d1'; g.fillRect(151, 15, 52, 16);
  g.fillStyle = '#e5484d';
  g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('DASH', 177, 20); g.fillText('BURGER', 177, 28);
  g.fillStyle = '#ffd76a'; // blinking bulbs
  for (let i = 0; i < 7; i++)
    if ((time * 3 + i) % 7 > 1) g.fillRect(149 + i * 9, 13, 1, 1);
  // hedge with flowers
  g.fillStyle = '#4da834'; g.fillRect(0, ROAD_TOP - 8, W, 8);
  g.fillStyle = '#3c8828';
  for (let i = 0; i < W; i += 7) g.fillRect(i, ROAD_TOP - 8 + (i % 3), 4, 3);
  g.fillStyle = '#63c24a';
  for (let i = 3; i < W; i += 11) g.fillRect(i, ROAD_TOP - 8, 2, 2);
  for (let i = 0; i < W; i += 23) {
    g.fillStyle = ['#ff8ab0', '#ffd76a', '#e8e6df'][(i / 23 | 0) % 3];
    g.fillRect(i + (i % 5), ROAD_TOP - 6 + (i % 2), 2, 2);
  }
}
function drawRoad(g) {
  g.drawImage(roadTex, 0, ROAD_TOP);
  g.fillStyle = '#e8e6df';
  const off = -((time * 30) % 24);
  for (let x = off; x < W; x += 24) g.fillRect(x, ROAD_TOP + 37, 12, 2);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  for (let x = off + 12; x < W; x += 24) g.fillRect(x, ROAD_TOP + 37, 2, 2);
}
function drawCounterZone(g) {
  const WT = WINDOWS[save.eq.window];
  g.drawImage(wallTex(save.eq.window), 0, COUNTER_TOP);
  // awning with scalloped edge
  const ay = COUNTER_TOP - 8;
  for (let x = 0; x < W; x += 20) {
    g.fillStyle = WT.awn1; g.fillRect(x, ay, 10, 12);
    g.fillStyle = WT.awn2; g.fillRect(x + 10, ay, 10, 12);
    // scallops
    g.fillStyle = WT.awn1; g.fillRect(x + 2, ay + 12, 6, 2);
    g.fillStyle = WT.awn2; g.fillRect(x + 12, ay + 12, 6, 2);
  }
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, ay, W, 2);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, ay + 10, W, 2);
  // menu board (left of window)
  g.fillStyle = '#2a1a26'; g.fillRect(24, COUNTER_TOP + 12, 50, 32);
  g.fillStyle = '#1b1626'; g.fillRect(26, COUNTER_TOP + 14, 46, 28);
  g.fillStyle = '#ffd76a'; g.font = 'bold 6px monospace'; g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillText('MENU', 30, COUNTER_TOP + 16);
  drawLayer(g, 'bun_t', 56, COUNTER_TOP + 20, 12, 3);
  drawLayer(g, 'patty', 56, COUNTER_TOP + 22, 12, 3);
  g.fillStyle = '#8a93a8';
  for (let i = 0; i < 3; i++) g.fillRect(30, COUNTER_TOP + 26 + i * 5, 22 - i * 4, 2);
  // potted plant (right)
  g.fillStyle = '#8a4b2c'; g.fillRect(232, COUNTER_TOP + 34, 14, 10);
  g.fillStyle = '#a2683c'; g.fillRect(232, COUNTER_TOP + 34, 14, 2);
  g.fillStyle = '#3c8828';
  g.fillRect(235, COUNTER_TOP + 24, 3, 10); g.fillRect(240, COUNTER_TOP + 26, 3, 8);
  g.fillStyle = '#63c24a';
  g.fillRect(233, COUNTER_TOP + 22, 4, 4); g.fillRect(240, COUNTER_TOP + 23, 4, 4);
  // serving window
  const wx = CHAR_X - 12, ww = 60, wy = COUNTER_TOP + 8, wh = KITCHEN_TOP - COUNTER_TOP - 12;
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(wx - 1, wy + wh + 3, ww + 8, 3); // drop shadow
  g.fillStyle = WT.frame; g.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
  g.fillStyle = shade(WT.frame, 35); g.fillRect(wx - 4, wy - 4, ww + 8, 2);
  g.fillStyle = shade(WT.frame, -35); g.fillRect(wx - 4, wy + wh + 2, ww + 8, 2);
  // warm interior
  const ig = g.createLinearGradient(0, wy, 0, wy + wh);
  ig.addColorStop(0, '#3a2a3c'); ig.addColorStop(1, '#241b30');
  g.fillStyle = ig; g.fillRect(wx, wy, ww, wh);
  g.fillStyle = 'rgba(255,220,150,0.12)'; g.fillRect(wx, wy, ww, 8);
  // hanging lamp
  g.fillStyle = '#2a1a26'; g.fillRect(wx + ww / 2 - 1, wy, 2, 4);
  g.fillStyle = '#ffd76a'; g.fillRect(wx + ww / 2 - 3, wy + 4, 6, 3);
  if (WT.glow) {
    const pulse = 0.55 + Math.sin(time * 4) * 0.25;
    g.fillStyle = WT.glow; g.globalAlpha = pulse;
    g.fillRect(wx - 4, wy - 7, ww + 8, 2);
    g.fillRect(wx - 7, wy - 4, 2, wh + 8);
    g.fillRect(wx + ww + 5, wy - 4, 2, wh + 8);
    g.globalAlpha = 1;
  }
  // character behind the window (torso, scale 2), with blink
  const blink = (time % 3.7) < 0.14;
  const spr = (blink ? charTorsosBlink : charTorsos)[save.eq.outfit];
  const bob = Math.round(Math.sin(time * 3) * 1);
  g.drawImage(spr, CHAR_X - 6, CHAR_Y + bob, spr.width * 2, spr.height * 2);
  // counter sill
  g.fillStyle = WT.counter; g.fillRect(wx - 6, KITCHEN_TOP - 8, ww + 12, 8);
  g.fillStyle = shade(WT.counter, 35); g.fillRect(wx - 6, KITCHEN_TOP - 8, ww + 12, 2);
  g.fillStyle = shade(WT.counter, -35); g.fillRect(wx - 6, KITCHEN_TOP - 2, ww + 12, 2);
  // tiny register on the sill
  g.fillStyle = '#4a5261'; g.fillRect(wx + ww - 12, KITCHEN_TOP - 14, 10, 6);
  g.fillStyle = '#7dffb0'; g.fillRect(wx + ww - 10, KITCHEN_TOP - 13, 4, 2);
}
function drawBagSprite(g, x, y, spin) {
  const lean = Math.round(Math.sin(spin) * 1);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 4, y + 7, 8, 2);
  g.fillStyle = '#d8a35c'; g.fillRect(x - 5 + lean, y - 6, 10, 12);
  g.fillStyle = '#e8bc7c'; g.fillRect(x - 5 + lean, y - 6, 3, 12);
  g.fillStyle = '#b9843d'; g.fillRect(x - 5 + lean, y - 6, 10, 2);
  g.fillStyle = '#f3d9a8'; g.fillRect(x - 3 + lean, y - 1, 6, 4);
  g.fillStyle = '#e5484d'; g.fillRect(x - 2 + lean, y, 4, 2);
}
function drawOrderBubble(g, car) {
  const layers = car.order.length;
  const bh = layers * 4 + 12, bw = 30;
  const bx = Math.round(Math.max(4, Math.min(W - bw - 4, carWinCenter(car) - bw / 2)));
  const by = Math.round(carTop(car) - bh - 8);
  const bg = car.angry ? '#ffdada' : '#ffffff';
  // soft shadow
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(bx + 2, by + 2, bw, bh);
  // rounded bubble (corner pixels cut)
  g.fillStyle = bg;
  g.fillRect(bx + 1, by, bw - 2, bh);
  g.fillRect(bx, by + 1, bw, bh - 2);
  g.fillStyle = '#2a1a26';
  g.fillRect(bx + 1, by - 1, bw - 2, 1); g.fillRect(bx + 1, by + bh, bw - 2, 1);
  g.fillRect(bx - 1, by + 1, 1, bh - 2); g.fillRect(bx + bw, by + 1, 1, bh - 2);
  g.fillRect(bx, by, 1, 1); g.fillRect(bx + bw - 1, by, 1, 1);
  g.fillRect(bx, by + bh - 1, 1, 1); g.fillRect(bx + bw - 1, by + bh - 1, 1, 1);
  // tail
  const tx = Math.round(carWinCenter(car)) - 2;
  g.fillStyle = bg; g.fillRect(tx, by + bh, 4, 3);
  g.fillStyle = '#2a1a26'; g.fillRect(tx - 1, by + bh, 1, 3); g.fillRect(tx + 4, by + bh, 1, 3);
  g.fillRect(tx, by + bh + 3, 4, 1);
  // mini burger
  drawBurger(g, car.order, bx + bw / 2, by + bh - 3, 18, 3, 1);
  if (car.angry && (time * 4 | 0) % 2) {
    g.fillStyle = '#e5484d'; g.font = 'bold 8px monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('!', bx + bw - 4, by + 7);
  }
}
function drawKitchen(g) {
  // tiled backsplash
  g.fillStyle = '#2c3340'; g.fillRect(0, KITCHEN_TOP, W, 36);
  g.fillStyle = '#343c4c';
  for (let y = KITCHEN_TOP; y < KITCHEN_TOP + 36; y += 9)
    for (let x = ((y / 9 | 0) % 2) * 9; x < W; x += 18) g.fillRect(x + 1, y + 1, 16, 7);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = KITCHEN_TOP; y < KITCHEN_TOP + 36; y += 9) g.fillRect(0, y + 1, W, 2);
  // brushed steel counter
  g.fillStyle = '#39404e'; g.fillRect(0, KITCHEN_TOP + 36, W, H - KITCHEN_TOP - 36);
  g.fillStyle = '#434b5c'; g.fillRect(0, KITCHEN_TOP + 36, W, 3);
  g.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = KITCHEN_TOP + 44; y < BTN_Y - 6; y += 7) g.fillRect(0, y, W, 2);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = KITCHEN_TOP + 48; y < BTN_Y - 6; y += 14) g.fillRect(0, y, W, 1);
  // tray with shine + shadow
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(STACK_CX - 42, STACK_BASE + 7, 88, 3);
  g.fillStyle = '#59637a'; g.fillRect(STACK_CX - 44, STACK_BASE + 2, 88, 6);
  g.fillStyle = '#6d7892'; g.fillRect(STACK_CX - 44, STACK_BASE + 2, 88, 2);
  g.fillStyle = '#8a95ae'; g.fillRect(STACK_CX - 40, STACK_BASE + 2, 26, 1);
  g.fillStyle = '#454e62'; g.fillRect(STACK_CX - 44, STACK_BASE + 6, 88, 2);
  // current stack
  if (G.stack.length) {
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fillRect(STACK_CX - 26, STACK_BASE, 52, 3);
    drawBurger(g, G.stack, STACK_CX, STACK_BASE + 2, 56, 9, 1);
  }
  // serve hint
  if (G.stack.length >= 2 && !G.bag) {
    const pulse = (Math.sin(time * 6) + 1) / 2;
    g.globalAlpha = 0.5 + pulse * 0.5;
    g.fillStyle = '#7dffb0';
    const ax = STACK_CX + 62, ay = 300 + Math.round(pulse * -3);
    g.fillRect(ax - 2, ay, 4, 14);
    g.fillRect(ax - 5, ay + 2, 10, 3);
    g.fillRect(ax - 3, ay - 2, 6, 3);
    g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText('SWIPE', ax, ay + 20);
    g.fillText('UP!', ax, ay + 28);
    g.globalAlpha = 1;
  }
  // scrap button
  if (G.stack.length) {
    button(g, 8, KITCHEN_TOP + 44, 40, 18, '#5c3038', 'SCRAP', '#ffb0b0', () => scrapStack(), true);
  }
  // ingredient button deck
  g.fillStyle = '#1a1f2a'; g.fillRect(0, BTN_Y - 6, W, H - BTN_Y + 6);
  g.fillStyle = '#242b38'; g.fillRect(0, BTN_Y - 6, W, 2);
  const bw = 50, gap = 3, x0 = (W - (bw * 5 + gap * 4)) / 2;
  ING.forEach((type, i) => {
    const bx = x0 + i * (bw + gap);
    const pressed = (G.btnFlash[type] || 0) > 0;
    const po = pressed ? 2 : 0;
    hits.push({ x: bx, y: BTN_Y, w: bw, h: BTN_H, cb: () => addIngredient(type) });
    g.fillStyle = '#161a24'; g.fillRect(bx, BTN_Y + 3, bw, BTN_H - 3);   // base shadow
    g.fillStyle = pressed ? '#2a3346' : '#232936';
    g.fillRect(bx, BTN_Y + po, bw, BTN_H - 3 - po + 3);
    g.fillStyle = pressed ? '#3a4560' : '#323b50';
    g.fillRect(bx, BTN_Y + po, bw, 3);
    g.fillStyle = '#10131b'; g.fillRect(bx, BTN_Y + BTN_H - 2, bw, 2);
    // icon with shadow
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(bx + 11, BTN_Y + 22 + po, 30, 3);
    drawLayer(g, type, bx + 10, BTN_Y + 14 + po, 30, 8);
    g.fillStyle = '#12081f'; g.font = '7px monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText(ING_LABEL[type], bx + bw / 2 + 1, BTN_Y + 38 + po);
    g.fillStyle = '#d8deea';
    g.fillText(ING_LABEL[type], bx + bw / 2, BTN_Y + 37 + po);
    g.fillStyle = '#5a6478';
    g.fillText(ING_KEY[type], bx + bw / 2, BTN_Y + 47 + po);
  });
}
function drawHeart(g, x, y, on) {
  const main = on ? '#e5484d' : '#3a3f4a';
  const hi   = on ? '#ff8a8a' : '#4a5261';
  const dk   = on ? '#a82c30' : '#2c313d';
  g.fillStyle = main;
  g.fillRect(x, y + 1, 4, 4); g.fillRect(x + 6, y + 1, 4, 4);
  g.fillRect(x + 1, y, 2, 1); g.fillRect(x + 7, y, 2, 1);
  g.fillRect(x, y + 4, 10, 3); g.fillRect(x + 2, y + 7, 6, 2);
  g.fillRect(x + 4, y + 9, 2, 1);
  g.fillStyle = hi; g.fillRect(x + 1, y + 1, 2, 2);
  g.fillStyle = dk; g.fillRect(x + 3, y + 8, 4, 1); g.fillRect(x + 4, y + 9, 2, 1);
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
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(mx - 1, my - 1, mw + 2, 6);
  g.fillStyle = '#232936'; g.fillRect(mx, my, mw, 4);
  const fill = Math.round(mw * Math.min(G.combo, 20) / 20);
  if (fill > 0) {
    g.fillStyle = G.combo >= 20 ? '#ff7d3a' : '#ffd76a';
    g.fillRect(mx, my, fill, 4);
    g.fillStyle = G.combo >= 20 ? '#ffb98a' : '#fff3d1';
    g.fillRect(mx, my, fill, 1);
  }
  // lives
  for (let i = 0; i < 3; i++) drawHeart(g, W - 16 - i * 14, 5, i < G.lives);
}
function drawTutorial(g) {
  if (!G.tut || G.t > 14) return;
  g.globalAlpha = 0.9;
  g.fillStyle = '#12081f'; g.fillRect(20, 232, W - 40, 92);
  g.globalAlpha = 1;
  g.strokeStyle = '#ffd76a'; g.strokeRect(20.5, 232.5, W - 41, 91);
  g.strokeStyle = 'rgba(255,215,106,0.3)'; g.strokeRect(22.5, 234.5, W - 45, 87);
  g.fillStyle = '#ffd76a'; g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('HOW TO PLAY', W / 2, 244);
  g.fillStyle = '#ffffff'; g.font = '8px monospace';
  g.fillText('1. Check the car\'s order bubble', W / 2, 262);
  g.fillText('2. Tap ingredients in order', W / 2, 276);
  g.fillText('3. SWIPE UP to toss the bag', W / 2, 290);
  g.fillText('through the car window!', W / 2, 302);
  g.fillStyle = '#7dffb0'; g.fillText('(keys 1-5 + SPACE work too)', W / 2, 316);
}

function drawCars(g) {
  for (const car of G.cars) {
    const xr = Math.round(car.x);
    // drop shadow
    g.fillStyle = 'rgba(10,10,18,0.3)';
    g.fillRect(xr + 3, CAR_BASE - 2, car.T.w - 6, 4);
    // speed lines for fast cars
    if (car.speed > 75) {
      g.fillStyle = 'rgba(255,255,255,0.25)';
      for (let i = 0; i < 3; i++)
        g.fillRect(xr - 8 - i * 7, carTop(car) + 6 + i * 6, 6, 1);
    }
    const frame = car.sprite[((car.x / 6) | 0) % 2 ? 1 : 0];
    g.drawImage(frame, xr, carTop(car));
    if (!car.served) drawOrderBubble(g, car);
  }
}

function drawPlay(g) {
  drawSky(g); drawRoad(g);
  drawCars(g);
  drawCounterZone(g);
  drawKitchen(g);
  if (G.bag) drawBagSprite(g, Math.round(G.bag.x), Math.round(G.bag.y), G.bag.spin);
  for (const p of G.parts) {
    g.globalAlpha = Math.max(0, 1 - p.t / p.life);
    g.fillStyle = p.color;
    g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  g.globalAlpha = 1;
  for (const f of G.floats) {
    g.globalAlpha = Math.max(0, 1 - f.t / 1.1);
    g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#12081f'; g.fillText(f.text, Math.round(f.x) + 1, Math.round(f.y) + 1);
    g.fillStyle = f.color; g.fillText(f.text, Math.round(f.x), Math.round(f.y));
    g.globalAlpha = 1;
  }
  drawHUD(g);
  drawTutorial(g);
  g.drawImage(vignette, 0, 0);
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
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 2, y + 2, w, h);
  g.fillStyle = bg; g.fillRect(x, y, w, h);
  g.fillStyle = shade(bg, 35); g.fillRect(x, y, w, 2);
  g.fillStyle = shade(bg, -45); g.fillRect(x, y + h - 2, w, 2);
  g.font = (small ? '' : 'bold ') + (small ? 7 : 9) + 'px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillText(label, x + w / 2 + 1, y + h / 2 + 2);
  g.fillStyle = fg; g.fillText(label, x + w / 2, y + h / 2 + 1);
}
function coinIcon(g, x, y) {
  g.fillStyle = '#b9862e'; g.fillRect(x, y + 1, 8, 7); g.fillRect(x + 1, y, 6, 9);
  g.fillStyle = '#f0b429'; g.fillRect(x, y + 1, 8, 6); g.fillRect(x + 1, y, 6, 8);
  g.fillStyle = '#ffd76a'; g.fillRect(x + 2, y + 1, 2, 5);
  g.fillStyle = '#c8912e'; g.fillRect(x + 5, y + 2, 1, 4);
}

// ------------------------------------------------------------
// Menu
// ------------------------------------------------------------
function drawMenu(g) {
  drawSky(g); drawRoad(g);
  // parked hero car
  if (!menuCar) menuCar = makeCarSprite('sports', '#d63e43', 3);
  g.fillStyle = 'rgba(10,10,18,0.3)';
  g.fillRect(171, CAR_BASE - 2, CAR_TYPES.sports.w - 6, 4);
  g.drawImage(menuCar[0], 168, CAR_BASE - CAR_TYPES.sports.h);
  drawCounterZone(g);
  // panel
  const pg = g.createLinearGradient(0, KITCHEN_TOP, 0, H);
  pg.addColorStop(0, '#39404e'); pg.addColorStop(1, '#242a36');
  g.fillStyle = pg; g.fillRect(0, KITCHEN_TOP, W, H - KITCHEN_TOP);
  g.fillStyle = '#434b5c'; g.fillRect(0, KITCHEN_TOP, W, 3);

  // title with outline + shine
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 20px monospace';
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 2], [2, 1]]) {
    g.fillStyle = '#12081f';
    g.fillText('DRIVE-THRU', W / 2 + ox, 241 + oy);
    g.fillText('DASH', W / 2 + ox, 263 + oy);
  }
  g.fillStyle = '#ffd76a';
  g.fillText('DRIVE-THRU', W / 2, 241);
  g.fillText('DASH', W / 2, 263);
  g.fillStyle = '#fff3d1';
  g.fillText('DRIVE-THRU', W / 2, 240);
  g.save(); g.beginPath(); g.rect(0, 230, W, 4); g.clip();
  g.fillStyle = '#fff9dc'; g.fillText('DRIVE-THRU', W / 2, 240);
  g.restore();
  g.fillStyle = '#ffd76a'; g.fillText('DRIVE-THRU', W / 2, 241);
  g.fillStyle = '#7dffb0'; g.font = '8px monospace';
  g.fillText('~ serve \'em hot, serve \'em fast ~', W / 2, 282);

  // character full sprite with shadow
  const spr = charSprites[save.eq.outfit];
  const bob = Math.round(Math.sin(time * 3));
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(36, 300 + spr.height * 2 - 3, 26, 4);
  g.drawImage(spr, 30, 300 + bob, spr.width * 2, spr.height * 2);

  // stats
  g.textAlign = 'left'; g.textBaseline = 'top'; g.font = 'bold 9px monospace';
  coinIcon(g, 96, 306);
  g.fillStyle = '#ffd76a'; g.fillText(String(save.coins), 110, 307);
  g.fillStyle = '#c8cede'; g.fillText('BEST ' + save.best, 96, 321);

  button(g, 96, 340, 150, 34, '#3c8828', 'PLAY', '#ffffff', startPlay);
  button(g, 96, 382, 150, 28, '#3f78d8', 'SHOP', '#ffffff', () => { mode = 'shop'; SFX.tap(); });
  button(g, 96, 418, 72, 24, '#4a5261', save.muted ? 'SOUND OFF' : 'SOUND ON', save.muted ? '#8a93a8' : '#7dffb0', toggleMute, true);
  g.fillStyle = '#6d7892'; g.font = '7px monospace'; g.textAlign = 'center';
  g.fillText('32-BIT ARCADE ACTION', W / 2, 464);
  g.drawImage(vignette, 0, 0);
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
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#221840'); bg.addColorStop(1, '#140e28');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.03)';
  for (let y = 0; y < H; y += 8) g.fillRect(0, y, W, 1);
  g.fillStyle = '#2c2050'; g.fillRect(0, 0, W, 34);
  g.fillStyle = '#3a2c66'; g.fillRect(0, 32, W, 2);
  g.fillStyle = '#ffd76a'; g.font = 'bold 12px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('SHOP', W / 2, 14);
  coinIcon(g, W / 2 - 24, 22); g.font = 'bold 9px monospace';
  g.fillText(String(save.coins), W / 2 + 10, 27);
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
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(10, iy + 2, W - 16, 66);
    g.fillStyle = equipped ? '#243a5c' : '#241a40';
    g.fillRect(8, iy, W - 16, 66);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(8, iy, W - 16, 2);
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
      g.fillStyle = WT.mortar;
      for (let yy = iy + 27; yy < iy + 50; yy += 5) g.fillRect(16, yy, 44, 1);
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
  g.drawImage(vignette, 0, 0);
}

// ------------------------------------------------------------
// Game over
// ------------------------------------------------------------
function drawOver(g, dt) {
  G.over += dt;
  drawPlay(g);
  g.globalAlpha = Math.min(0.85, G.over * 1.5);
  g.fillStyle = '#12081f'; g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  if (G.over < 0.4) return;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // banner
  g.fillStyle = '#e5484d'; g.fillRect(20, 132, W - 40, 34);
  g.fillStyle = '#ff8a8a'; g.fillRect(20, 132, W - 40, 2);
  g.fillStyle = '#a82c30'; g.fillRect(20, 164, W - 40, 2);
  g.fillStyle = '#12081f'; g.font = 'bold 18px monospace';
  g.fillText('CLOSING TIME!', W / 2 + 1, 151);
  g.fillStyle = '#fff3d1';
  g.fillText('CLOSING TIME!', W / 2, 150);
  g.fillStyle = '#ffffff'; g.font = 'bold 11px monospace';
  g.fillText('SCORE  ' + G.score, W / 2, 188);
  g.fillStyle = '#c8cede'; g.font = '9px monospace';
  g.fillText('BEST COMBO  x' + G.bestCombo, W / 2, 206);
  g.fillText('CARS SERVED  ' + G.served, W / 2, 220);
  coinIcon(g, W / 2 - 36, 232);
  g.fillStyle = '#ffd76a'; g.font = 'bold 10px monospace';
  g.fillText('+' + G.earned + ' COINS', W / 2 + 10, 237);
  if (G.score >= save.best && G.score > 0) {
    const tw = Math.sin(time * 6) > 0;
    g.fillStyle = tw ? '#7dffb0' : '#c6ffe0'; g.font = 'bold 9px monospace';
    g.fillText('* NEW BEST! *', W / 2, 258);
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
