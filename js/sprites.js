'use strict';
// ---------------------------------------------------------------
// sprites.js — procedural sprite-sheet generation.
// Every character gets a real sprite sheet (rows = animations,
// columns = frames) built at boot from smooth vector shapes so the
// result reads as fluid 32-bit era art, never blocky pixels.
// ---------------------------------------------------------------
const Sprites = (() => {

  // ---- palettes ------------------------------------------------
  const KAYA = {
    skin: '#e2a476', skinSh: '#c4855a', skinDk: '#a06840',
    hair: '#e05a1e', hairLt: '#f8873a', hairDk: '#a33a0e',
    leather: '#7a5433', leatherDk: '#573b21', leatherLt: '#997049',
    eye: '#a9cde4', white: '#f7f1e7', dark: '#3a2417', gold: '#e8c15a',
    claw: '#4e3322'
  };

  // ---- generic canvas helpers ---------------------------------
  function blob(g, c, x, y, rx, ry, rot) {
    g.fillStyle = c; g.beginPath();
    g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); g.fill();
  }
  function limb(g, c, w, x1, y1, x2, y2, bend) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len, k = bend || 0;
    g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x1, y1);
    g.quadraticCurveTo(mx + px * k, my + py * k, x2, y2); g.stroke();
  }
  function spike(g, c, x, y, ang, len, w) {
    const tx = x + Math.cos(ang) * len, ty = y + Math.sin(ang) * len;
    const px = -Math.sin(ang) * w, py = Math.cos(ang) * w;
    g.fillStyle = c; g.beginPath();
    g.moveTo(x + px, y + py);
    g.quadraticCurveTo(x + Math.cos(ang) * len * 0.6 + px * 1.1, y + Math.sin(ang) * len * 0.6 + py * 1.1, tx, ty);
    g.quadraticCurveTo(x + Math.cos(ang) * len * 0.6 - px * 1.1, y + Math.sin(ang) * len * 0.6 - py * 1.1, x - px, y - py);
    g.closePath(); g.fill();
  }
  function glowEye(g, x, y, r, col) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 2.4, 0, Math.PI * 2); g.fill();
    blob(g, '#ffffff', x, y, r * 0.55, r * 0.55, 0);
    blob(g, col, x, y, r * 0.35, r * 0.35, 0);
  }

  // ---- sheet builder -------------------------------------------
  // anims: { name: {n, fps, loop} }  drawFn(g, name, i, n)
  function makeSheet(cw, ch, anims, drawFn) {
    const names = Object.keys(anims);
    const cols = Math.max.apply(null, names.map(k => anims[k].n));
    const cv = document.createElement('canvas');
    cv.width = cw * cols; cv.height = ch * names.length;
    const g = cv.getContext('2d');
    const meta = {};
    names.forEach((name, ri) => {
      const a = anims[name];
      meta[name] = { row: ri, n: a.n, fps: a.fps || 10, loop: a.loop !== false };
      for (let i = 0; i < a.n; i++) {
        g.save();
        g.translate(i * cw, ri * ch);
        g.beginPath(); g.rect(0, 0, cw, ch); g.clip();
        drawFn(g, name, i, a.n);
        g.restore();
      }
    });
    return { cv, cw, ch, meta };
  }

  // draw a frame: (x, yBottom) is the sprite's ground anchor
  function draw(g, sh, name, fi, x, yBottom, flip, scale) {
    const m = sh.meta[name] || sh.meta.idle;
    const f = (m.col0 || 0) + Math.max(0, Math.min(m.n - 1, fi | 0));
    g.save();
    g.translate(Math.round(x), Math.round(yBottom));
    if (flip) g.scale(-1, 1);
    if (scale && scale !== 1) g.scale(scale, scale);
    g.drawImage(sh.cv, f * sh.cw, m.row * sh.ch, sh.cw, sh.ch,
      -sh.cw / 2, -sh.ch, sh.cw, sh.ch);
    g.restore();
  }
  function frame(sh, name, t) {
    const m = sh.meta[name] || sh.meta.idle;
    const f = Math.floor(t * m.fps);
    return m.loop ? f % m.n : Math.min(m.n - 1, f);
  }

  // ================================================================
  // KAYA — the heroine. Cell 72x78, feet at y=74.
  // ================================================================
  function hairDo(g, hx, hy, flow, wild) {
    const P = KAYA;
    blob(g, P.hairDk, hx - 3 + flow * 0.3, hy - 4, 10.5, 9.5, 0);
    const angs = [-2.6, -2.1, -1.65, -1.15, -0.65, -0.2];
    for (let k = 0; k < angs.length; k++) {
      const a = angs[k] + flow * 0.02;
      const L = 11 + (k % 2) * 4 + (wild || 0);
      spike(g, P.hair, hx - 2 + flow * 0.35, hy - 5, a, L, 4.2);
    }
    spike(g, P.hairLt, hx - 5 + flow * 0.4, hy - 8, -2.2 + flow * 0.02, 9, 2.6);
    spike(g, P.hairLt, hx + 1 + flow * 0.3, hy - 10, -1.1 + flow * 0.02, 8, 2.4);
    // front bang over the brow
    spike(g, P.hair, hx + 4, hy - 6, 0.5, 8, 3);
    blob(g, P.hair, hx - 3 + flow * 0.3, hy - 6, 8.5, 7, 0);
  }

  function kayaHead(g, hx, hy, o) {
    const P = KAYA;
    o = o || {};
    // ear + earring behind head
    spike(g, P.skinSh, hx - 3, hy - 6, -1.9, 7, 3);
    g.strokeStyle = P.gold; g.lineWidth = 1.6;
    g.beginPath(); g.arc(hx - 5.5, hy + 5.5, 3, 0, Math.PI * 2); g.stroke();
    // face
    blob(g, P.skin, hx, hy, 8, 7.6, 0);
    blob(g, '#efc79b', hx + 5, hy + 2.2, 4.4, 3.4, 0); // muzzle
    blob(g, '#6b4630', hx + 8.6, hy + 1.2, 2, 1.6, 0); // nose
    if (o.eyesClosed) {
      g.strokeStyle = P.dark; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(hx + 1.4, hy - 1.4); g.lineTo(hx + 4.6, hy - 1); g.stroke();
    } else {
      blob(g, P.white, hx + 3, hy - 1.4, 2.3, 2.8, 0.15);
      blob(g, P.eye, hx + 3.7, hy - 1.2, 1.3, 1.7, 0);
      blob(g, P.dark, hx + 3.9, hy - 1.2, 0.6, 0.9, 0);
    }
    // sly brow
    g.strokeStyle = P.hairDk; g.lineWidth = 1.7;
    g.beginPath(); g.moveTo(hx + 0.6, hy - 4.6); g.lineTo(hx + 5.6, hy - 3.6); g.stroke();
    // mouth
    g.strokeStyle = '#7c4a33'; g.lineWidth = 1.3;
    if (o.mouthOpen) { blob(g, '#7c3b2c', hx + 5.4, hy + 4.6, 1.8, 2.2, 0); }
    else { g.beginPath(); g.moveTo(hx + 3.4, hy + 4.6); g.quadraticCurveTo(hx + 5.6, hy + 5.6, hx + 7.4, hy + 4.2); g.stroke(); }
    hairDo(g, hx, hy, o.flow || 0, o.wild || 0);
    // hanging earring on visible side
    g.strokeStyle = P.gold; g.lineWidth = 1.6;
    g.beginPath(); g.arc(hx + 0.5, hy + 6.5, 3, 0, Math.PI * 2); g.stroke();
  }

  function foot(g, x, y, dir) {
    const P = KAYA;
    blob(g, P.skinSh, x + dir * 1.5, y - 1.2, 4.6, 2.6, 0);
    for (let k = -1; k <= 1; k++) blob(g, P.claw, x + dir * 5 + k * 1.6, y - 0.6, 0.9, 1.1, 0);
  }
  function hand(g, x, y) { blob(g, KAYA.skinSh, x, y, 2.8, 2.8, 0); }

  // paint the standard side-view rig from a pose description
  function kayaPaint(g, p) {
    const P = KAYA;
    const sway = p.sway || 0;
    // back arm
    if (p.armB) { limb(g, P.skinSh, 5, p.sho.x - 2, p.sho.y + 2, p.armB.x, p.armB.y, p.armB.k || 3); hand(g, p.armB.x, p.armB.y); }
    // back leg
    limb(g, P.skinSh, 6.5, p.hip.x - 1, p.hip.y, p.legB.x, p.legB.y - 2, p.legB.k != null ? p.legB.k : 4);
    foot(g, p.legB.x, p.legB.y, 1);
    // torso
    limb(g, P.skin, 13, p.hip.x, p.hip.y - 1, p.sho.x, p.sho.y + 3, 0);
    // loincloth
    g.fillStyle = P.leather; g.beginPath();
    g.moveTo(p.hip.x - 7, p.hip.y - 2);
    g.lineTo(p.hip.x + 7, p.hip.y - 2);
    g.quadraticCurveTo(p.hip.x + 6 + sway, p.hip.y + 10, p.hip.x + sway, p.hip.y + 15);
    g.quadraticCurveTo(p.hip.x - 6 + sway, p.hip.y + 10, p.hip.x - 7, p.hip.y - 2);
    g.fill();
    g.fillStyle = P.leatherDk; g.fillRect(p.hip.x - 8, p.hip.y - 4, 16, 3.4); // belt
    // front leg
    limb(g, P.skin, 6.5, p.hip.x + 1, p.hip.y, p.legF.x, p.legF.y - 2, p.legF.k != null ? p.legF.k : 4);
    foot(g, p.legF.x, p.legF.y, 1);
    // leather top
    const ca = Math.atan2(p.sho.y - p.hip.y, p.sho.x - p.hip.x) + Math.PI / 2;
    blob(g, P.leather, p.sho.x + 0.5, p.sho.y + 6.5, 7.6, 4.6, ca);
    blob(g, P.leatherLt, p.sho.x + 3, p.sho.y + 5.5, 3, 3.4, ca);
    g.strokeStyle = P.leather; g.lineWidth = 2;
    g.beginPath(); g.moveTo(p.sho.x - 3, p.sho.y + 3.5); g.lineTo(p.sho.x - 1, p.sho.y - 1); g.stroke();
    // head
    kayaHead(g, p.head.x, p.head.y, p.face);
    // front arm (+ optional pistol)
    if (p.armF) {
      limb(g, P.skin, 5, p.sho.x + 2, p.sho.y + 3, p.armF.x, p.armF.y, p.armF.k || -3);
      hand(g, p.armF.x, p.armF.y);
      if (p.gun) {
        g.save(); g.translate(p.armF.x, p.armF.y); g.rotate(p.gunAng || 0);
        g.fillStyle = '#5d6b78'; g.fillRect(0, -2.6, 10, 4.4);
        g.fillStyle = '#3fd6c0'; g.fillRect(7.4, -1.8, 2.6, 2.8);
        g.fillStyle = '#46525d'; g.fillRect(0.5, 1, 3.4, 5);
        g.restore();
      }
    }
  }

  // back view (climbing)
  function kayaPaintBack(g, p) {
    const P = KAYA;
    limb(g, P.skinSh, 6.5, p.hip.x - 3, p.hip.y, p.legB.x, p.legB.y, 0); foot(g, p.legB.x, p.legB.y, -1);
    limb(g, P.skinSh, 6.5, p.hip.x + 3, p.hip.y, p.legF.x, p.legF.y, 0); foot(g, p.legF.x, p.legF.y, 1);
    limb(g, P.skin, 14, p.hip.x, p.hip.y, p.sho.x, p.sho.y + 3, 0);
    g.fillStyle = P.leather; g.beginPath();
    g.moveTo(p.hip.x - 7, p.hip.y - 3); g.lineTo(p.hip.x + 7, p.hip.y - 3);
    g.lineTo(p.hip.x + 4, p.hip.y + 12); g.lineTo(p.hip.x - 4, p.hip.y + 12); g.closePath(); g.fill();
    g.fillStyle = P.leatherDk; g.fillRect(p.hip.x - 8, p.hip.y - 4, 16, 3.2);
    g.fillStyle = P.leather; g.fillRect(p.sho.x - 7.5, p.sho.y + 4, 15, 4); // bra strap
    limb(g, P.skinSh, 5, p.sho.x - 4, p.sho.y + 3, p.armB.x, p.armB.y, 3); hand(g, p.armB.x, p.armB.y);
    limb(g, P.skin, 5, p.sho.x + 4, p.sho.y + 3, p.armF.x, p.armF.y, -3); hand(g, p.armF.x, p.armF.y);
    // back of head = hair ball
    blob(g, P.skin, p.head.x, p.head.y + 2, 7.4, 7, 0);
    blob(g, P.hairDk, p.head.x, p.head.y - 1, 10, 9.5, 0);
    for (let k = 0; k < 6; k++) spike(g, P.hair, p.head.x, p.head.y - 2, -2.7 + k * 0.5, 12, 4);
    blob(g, P.hair, p.head.x, p.head.y - 2, 8.6, 8, 0);
    spike(g, P.hairLt, p.head.x - 2, p.head.y - 4, -1.9, 8, 2.2);
  }

  function kayaDraw(g, name, i, n) {
    const cx = 34, gy = 74;
    const t = n > 1 ? i / n : 0, ph = t * Math.PI * 2;
    const P = KAYA;
    let p;
    switch (name) {
      case 'idle': {
        const bob = Math.sin(ph) * 1.3;
        p = {
          hip: { x: cx, y: 49 + bob * 0.4 }, sho: { x: cx + 1, y: 33 + bob },
          head: { x: cx + 3, y: 22 + bob },
          legB: { x: cx - 5, y: gy }, legF: { x: cx + 5, y: gy },
          armB: { x: cx - 8, y: 50 + bob, k: 4 },
          armF: { x: cx + 8, y: 47 + bob * 0.6, k: -6 }, // hand on hip, sassy
          sway: Math.sin(ph) * 1.2, face: { flow: Math.sin(ph) * 1.5 }
        };
        kayaPaint(g, p); break;
      }
      case 'walk': {
        const s = Math.sin(ph), c = Math.cos(ph);
        p = {
          hip: { x: cx, y: 48 + Math.abs(c) * 1.2 }, sho: { x: cx + 2, y: 32 + Math.abs(c) },
          head: { x: cx + 4, y: 21 + Math.abs(c) },
          legB: { x: cx - s * 9, y: gy - Math.max(0, -c) * 6, k: 5 },
          legF: { x: cx + s * 9, y: gy - Math.max(0, c) * 6, k: 5 },
          armB: { x: cx - 2 + s * 8, y: 49, k: 4 },
          armF: { x: cx - s * 8, y: 49, k: -4 },
          sway: -s * 2.5, face: { flow: -1 - s }
        };
        kayaPaint(g, p); break;
      }
      case 'run': {
        const s = Math.sin(ph), c = Math.cos(ph);
        p = {
          hip: { x: cx - 2, y: 47 + Math.abs(c) * 2 }, sho: { x: cx + 5, y: 32 + Math.abs(c) * 1.5 },
          head: { x: cx + 8, y: 22 + Math.abs(c) },
          legB: { x: cx - 2 - s * 14, y: gy - Math.max(0, -c) * 10, k: 7 },
          legF: { x: cx - 2 + s * 14, y: gy - Math.max(0, c) * 10, k: 7 },
          armB: { x: cx + s * 11, y: 44 - Math.max(0, s) * 6, k: 6 },
          armF: { x: cx - s * 11, y: 44 - Math.max(0, -s) * 6, k: -6 },
          sway: -4 - s * 2, face: { flow: -4 - Math.abs(s) * 2, wild: 2 }
        };
        kayaPaint(g, p); break;
      }
      case 'jump':
        kayaPaint(g, {
          hip: { x: cx, y: 46 }, sho: { x: cx + 3, y: 30 }, head: { x: cx + 6, y: 19 },
          legB: { x: cx - 9, y: gy - 6, k: 8 }, legF: { x: cx + 9, y: gy - 16, k: 9 },
          armB: { x: cx - 11, y: 30, k: 5 }, armF: { x: cx + 12, y: 26, k: -5 },
          sway: -4, face: { flow: -3, wild: 2 }
        }); break;
      case 'fall': {
        const w = i % 2 ? 3 : -3;
        kayaPaint(g, {
          hip: { x: cx, y: 45 }, sho: { x: cx + 1, y: 29 }, head: { x: cx + 4, y: 18 },
          legB: { x: cx - 8, y: gy - 3, k: 6 }, legF: { x: cx + 10, y: gy - 8, k: 6 },
          armB: { x: cx - 12, y: 24 + w, k: 4 }, armF: { x: cx + 11, y: 22 - w, k: -4 },
          sway: -2, face: { flow: -2 + w, mouthOpen: true, wild: 3 }
        }); break;
      }
      case 'slide':
        kayaPaint(g, {
          hip: { x: cx - 2, y: 63 }, sho: { x: cx - 11, y: 53 }, head: { x: cx - 9, y: 42 },
          legB: { x: cx + 6, y: gy - 1, k: 6 }, legF: { x: cx + 17, y: gy, k: 1 },
          armB: { x: cx - 16, y: gy - 2, k: 3 }, armF: { x: cx + 2, y: 56, k: -3 },
          sway: -7, face: { flow: -7, wild: 3 }
        }); break;
      case 'kick': {
        const ext = [0, 0.85, 1, 0.7, 0.25][i] || 0;
        kayaPaint(g, {
          hip: { x: cx - 1, y: 48 }, sho: { x: cx - 4 - ext * 2, y: 31 }, head: { x: cx - 1 - ext * 2, y: 20 },
          legB: { x: cx - 4, y: gy, k: 3 },
          legF: { x: cx + 4 + ext * 17, y: gy - 8 - ext * 20, k: 5 - ext * 5 },
          armB: { x: cx - 12, y: 36, k: 4 }, armF: { x: cx + 8, y: 34, k: -4 },
          sway: -3 - ext * 3, face: { flow: -2 - ext * 3, mouthOpen: ext > 0.6 }
        }); break;
      }
      case 'throw': {
        const q = i / (n - 1);
        const ax = U.lerp(cx - 11, cx + 15, q), ay = 30 - Math.sin(q * Math.PI) * 20;
        kayaPaint(g, {
          hip: { x: cx, y: 48 }, sho: { x: cx + 1 + q * 3, y: 32 }, head: { x: cx + 4 + q * 2, y: 21 },
          legB: { x: cx - 6, y: gy, k: 4 }, legF: { x: cx + 7, y: gy, k: 4 },
          armB: { x: cx - 8, y: 46, k: 4 }, armF: { x: ax, y: ay, k: -4 },
          sway: -2 - q * 3, face: { flow: -1 - q * 3, mouthOpen: q > 0.5 }
        }); break;
      }
      case 'shoot': {
        const rec = i === 0 ? 2.5 : (i === 1 ? 1 : 0);
        kayaPaint(g, {
          hip: { x: cx - 1, y: 48 }, sho: { x: cx, y: 32 }, head: { x: cx + 3, y: 21 },
          legB: { x: cx - 7, y: gy, k: 4 }, legF: { x: cx + 6, y: gy, k: 4 },
          armB: { x: cx - 7, y: 44, k: 5 },
          armF: { x: cx + 15 - rec, y: 33, k: -1 },
          gun: true, gunAng: -0.06,
          sway: -2, face: { flow: -1 - rec }
        }); break;
      }
      case 'crouch':
        kayaPaint(g, {
          hip: { x: cx, y: 60 }, sho: { x: cx + 3, y: 46 }, head: { x: cx + 6, y: 35 },
          legB: { x: cx - 6, y: gy, k: 8 }, legF: { x: cx + 7, y: gy, k: 8 },
          armB: { x: cx - 6, y: 58, k: 3 }, armF: { x: cx + 9, y: 57, k: -3 },
          sway: 0, face: { flow: 0 }
        }); break;
      case 'pickup': {
        const q = Math.sin((i / (n - 1)) * Math.PI);
        kayaPaint(g, {
          hip: { x: cx, y: 58 + q * 3 }, sho: { x: cx + 4, y: 45 + q * 3 }, head: { x: cx + 7, y: 34 + q * 3 },
          legB: { x: cx - 6, y: gy, k: 8 }, legF: { x: cx + 7, y: gy, k: 8 },
          armB: { x: cx - 5, y: 57, k: 3 },
          armF: { x: cx + 11, y: 55 + q * 16, k: -2 },
          sway: 0, face: { flow: 0 }
        }); break;
      }
      case 'climb': {
        const s = Math.sin(ph);
        kayaPaintBack(g, {
          hip: { x: cx, y: 50 }, sho: { x: cx, y: 33 }, head: { x: cx, y: 22 },
          legB: { x: cx - 6, y: gy - 4 - Math.max(0, s) * 8 },
          legF: { x: cx + 6, y: gy - 4 - Math.max(0, -s) * 8 },
          armB: { x: cx - 7, y: 22 - Math.max(0, -s) * 7 },
          armF: { x: cx + 7, y: 22 - Math.max(0, s) * 7 }
        }); break;
      }
      case 'swim': {
        const s = Math.sin(ph);
        // horizontal pose, head to the right
        const hy = 50;
        p = {
          hip: { x: cx - 6, y: hy + 2 }, sho: { x: cx + 8, y: hy - 2 }, head: { x: cx + 19, y: hy - 4 },
          legB: { x: cx - 20, y: hy + 2 + s * 7, k: 4 },
          legF: { x: cx - 20, y: hy + 2 - s * 7, k: -4 },
          armB: { x: cx + 8 + Math.cos(ph) * 10, y: hy - 2 + Math.sin(ph) * 9, k: 3 },
          armF: { x: cx + 8 + Math.cos(ph + Math.PI) * 11, y: hy - 3 + Math.sin(ph + Math.PI) * 9, k: -3 },
          sway: -8, face: { flow: -6, wild: 2 }
        };
        kayaPaint(g, p); break;
      }
      case 'hurt':
        kayaPaint(g, {
          hip: { x: cx + 1, y: 49 }, sho: { x: cx - 5, y: 34 }, head: { x: cx - 4, y: 23 },
          legB: { x: cx - 8, y: gy, k: 4 }, legF: { x: cx + 8, y: gy - 4, k: 5 },
          armB: { x: cx - 14, y: 30, k: 4 }, armF: { x: cx + 10, y: 30, k: -4 },
          sway: 4, face: { flow: 4, mouthOpen: true, eyesClosed: true, wild: 3 }
        }); break;
    }
  }

  // ================================================================
  // ENEMIES — each species gets its own generated sheet.
  // ================================================================
  const ENEMY_PAL = {
    crawler: { body: '#5d7a3a', shade: '#41582a', glow: '#c5ff5e', spot: '#8ba24e' },
    spitter: { body: '#4e8a6e', shade: '#35604c', glow: '#7effc9', spot: '#77b393' },
    wisp:    { body: 'rgba(150,120,220,0.55)', shade: '#6a4fb0', glow: '#d9b8ff', spot: '#b596ff' },
    imp:     { body: '#8a5a8f', shade: '#5f3a64', glow: '#ffb1f1', spot: '#a877ad' },
    brute:   { body: '#6d6a4a', shade: '#4a4832', glow: '#ffd75e', spot: '#8f8a5f' },
    stalker: { body: '#546178', shade: '#3a4356', glow: '#7ec9ff', spot: '#71809c' }
  };

  function drawCrawler(g, pal, name, i, n, cx, gy) {
    const ph = (i / n) * Math.PI * 2;
    const rear = name === 'attack' ? Math.sin((i / (n - 1)) * Math.PI) : 0;
    const wig = name === 'walk' ? 1 : 0.3;
    for (let s = -1; s <= 1; s += 2)
      for (let k = 0; k < 3; k++) {
        const lx = cx - 8 + k * 8, off = Math.sin(ph + k * 2.1) * 4 * wig;
        limb(g, pal.shade, 3, lx, gy - 8, lx + off + s * 3, gy, s * 3);
      }
    blob(g, pal.body, cx, gy - 9 - rear * 4, 14, 8, -rear * 0.5);
    blob(g, pal.spot, cx - 3, gy - 12 - rear * 4, 5, 3, 0);
    blob(g, pal.shade, cx + 9, gy - 8 - rear * 8, 5.5, 4.5, 0);
    glowEye(g, cx + 11, gy - 9 - rear * 8, 1.6, pal.glow);
    limb(g, pal.shade, 2, cx + 12, gy - 5 - rear * 8, cx + 15, gy - 2 - rear * 8, 1);
    if (name === 'hurt') blob(g, 'rgba(255,255,255,0.5)', cx, gy - 9, 14, 8, 0);
  }

  function drawSpitter(g, pal, name, i, n, cx, gy) {
    const ph = (i / n) * Math.PI * 2, s = Math.sin(ph);
    const open = name === 'attack' ? Math.sin((i / (n - 1)) * Math.PI) : 0;
    limb(g, pal.shade, 5, cx - 4, gy - 16, cx - 16, gy - 20, -6); // tail
    limb(g, pal.shade, 4, cx - 3, gy - 12, cx - 5 - s * 4, gy, 3);
    limb(g, pal.body, 4, cx + 1, gy - 12, cx + 3 + s * 4, gy, 3);
    limb(g, pal.body, 10, cx - 2, gy - 13, cx + 3, gy - 24, 2); // torso
    blob(g, pal.spot, cx, gy - 18, 4, 5, 0);
    // head with hinged jaw
    blob(g, pal.body, cx + 6, gy - 27, 6.5, 4.5, 0.2);
    g.save(); g.translate(cx + 6, gy - 25); g.rotate(open * 0.9);
    blob(g, pal.shade, 4, 1.5, 5.5, 2.5, 0.15); g.restore();
    for (let k = 0; k < 3; k++) spike(g, pal.shade, cx + 2 - k * 3, gy - 29 + k, -1.8, 5, 1.5);
    glowEye(g, cx + 8, gy - 28.5, 1.5, pal.glow);
    if (open > 0.3) blob(g, pal.glow, cx + 11, gy - 24, 2 + open * 2, 2 + open * 2, 0);
    limb(g, pal.shade, 3, cx + 3, gy - 20, cx + 8 + open * 3, gy - 16, -2);
    if (name === 'hurt') blob(g, 'rgba(255,255,255,0.5)', cx, gy - 20, 12, 12, 0);
  }

  function drawWisp(g, pal, name, i, n, cx, gy) {
    const ph = (i / n) * Math.PI * 2;
    const bob = Math.sin(ph) * 3, flash = name === 'attack' ? Math.sin((i / (n - 1)) * Math.PI) : 0;
    const cy = gy - 30 + bob;
    for (let k = 0; k < 4; k++) {
      const tx = cx - 9 + k * 6;
      limb(g, pal.shade, 2.2, tx, cy + 6, tx + Math.sin(ph + k * 1.4) * 5, cy + 20 + Math.cos(ph + k) * 2, 4);
    }
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 16);
    gr.addColorStop(0, pal.spot); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 16, 0, Math.PI * 2); g.fill();
    blob(g, pal.body, cx, cy, 11, 9 + flash * 2, 0);
    blob(g, pal.shade, cx, cy + 3, 8, 4, 0);
    glowEye(g, cx, cy - 1, 2.2 + flash * 1.5, pal.glow);
    if (name === 'hurt') blob(g, 'rgba(255,255,255,0.55)', cx, cy, 11, 9, 0);
  }

  function drawImp(g, pal, name, i, n, cx, gy) {
    const ph = (i / n) * Math.PI * 2, s = Math.sin(ph);
    const lunge = name === 'attack' ? Math.sin((i / (n - 1)) * Math.PI) : 0;
    limb(g, pal.shade, 3.5, cx - 4, gy - 10, cx - 4 - s * 6, gy, 3);
    limb(g, pal.body, 3.5, cx + 2, gy - 10, cx + 2 + s * 6, gy, 3);
    blob(g, pal.body, cx, gy - 13, 9, 7.5, -0.2 - lunge * 0.2);
    blob(g, pal.spot, cx - 2, gy - 15, 4, 3, 0);
    blob(g, pal.body, cx + 7 + lunge * 4, gy - 18, 5.5, 5, 0);
    spike(g, pal.shade, cx + 4 + lunge * 4, gy - 21, -2.2, 8, 2); // ears
    spike(g, pal.shade, cx + 7 + lunge * 4, gy - 22, -1.6, 8, 2);
    glowEye(g, cx + 9 + lunge * 4, gy - 19, 1.5, pal.glow);
    limb(g, pal.shade, 2.5, cx + 4, gy - 12, cx + 10 + lunge * 6, gy - 7 - lunge * 4, -2);
    for (let k = 0; k < 2; k++) blob(g, '#fff', cx + 11 + lunge * 6 + k * 1.5, gy - 7 - lunge * 4, 0.8, 1.2, 0);
    if (name === 'hurt') blob(g, 'rgba(255,255,255,0.5)', cx, gy - 14, 12, 10, 0);
  }

  function drawBrute(g, pal, name, i, n, cx, gy) {
    const ph = (i / n) * Math.PI * 2, s = Math.sin(ph);
    const slam = name === 'attack' ? Math.sin((i / (n - 1)) * Math.PI) : 0;
    // legs
    limb(g, pal.shade, 9, cx - 8, gy - 26, cx - 12 - s * 7, gy, 4);
    limb(g, pal.body, 9, cx + 2, gy - 26, cx + 4 + s * 7, gy, 4);
    // hulking torso with hump
    blob(g, pal.body, cx - 2, gy - 36, 22, 18, -0.15);
    blob(g, pal.shade, cx - 8, gy - 46, 15, 10, -0.2);
    for (let k = 0; k < 4; k++) spike(g, pal.shade, cx - 16 + k * 7, gy - 50 + Math.abs(k - 1.5) * 2, -1.6 + k * 0.14, 10 + slam * 3, 2.5);
    // mutation warts
    for (let k = 0; k < 5; k++) blob(g, pal.spot, cx - 14 + k * 7, gy - 32 + (k % 2) * 6, 2.5, 2.5, 0);
    // small head slung low
    blob(g, pal.body, cx + 16, gy - 30 + slam * 2, 7, 6, 0.2);
    glowEye(g, cx + 18, gy - 31, 1.8, pal.glow);
    glowEye(g, cx + 14, gy - 33, 1.2, pal.glow);
    g.strokeStyle = pal.shade; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx + 12, gy - 26); g.lineTo(cx + 21, gy - 26); g.stroke();
    // long knuckle arms (raise on slam)
    const ay = slam > 0.4 ? gy - 44 : gy - 2;
    limb(g, pal.shade, 8, cx - 10, gy - 40, cx - 20 + s * 3, slam > 0.4 ? ay : gy - 2, -5);
    limb(g, pal.body, 8, cx + 8, gy - 40, cx + 22 - s * 3, ay, 5);
    blob(g, pal.shade, cx + 22 - s * 3, ay, 5.5, 4.5, 0);
    blob(g, pal.shade, cx - 20 + s * 3, slam > 0.4 ? ay : gy - 2, 5.5, 4.5, 0);
    if (name === 'hurt') blob(g, 'rgba(255,255,255,0.45)', cx, gy - 34, 26, 22, 0);
  }

  function drawStalker(g, pal, name, i, n, cx, gy) {
    const ph = (i / n) * Math.PI * 2, s = Math.sin(ph);
    const sweep = name === 'attack' ? Math.sin((i / (n - 1)) * Math.PI) : 0;
    limb(g, pal.shade, 6, cx - 3, gy - 34, cx - 6 - s * 9, gy, 6);
    limb(g, pal.body, 6, cx + 3, gy - 34, cx + 6 + s * 9, gy, 6);
    limb(g, pal.body, 11, cx, gy - 32, cx + 3, gy - 56, -3);
    for (let k = 0; k < 4; k++) blob(g, pal.spot, cx - 2 + (k % 2) * 6, gy - 38 - k * 5, 2, 2, 0);
    // long neck + narrow head
    limb(g, pal.shade, 5, cx + 3, gy - 56, cx + 9, gy - 66, -3);
    blob(g, pal.body, cx + 12, gy - 68, 8, 4.5, 0.25);
    glowEye(g, cx + 14, gy - 69, 1.6, pal.glow);
    glowEye(g, cx + 10, gy - 70, 1.2, pal.glow);
    spike(g, pal.shade, cx + 6, gy - 71, -2, 7, 2);
    // scythe arms
    const ang = -0.7 + sweep * 1.6;
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      const sx = cx + sgn * 4, sy = gy - 52;
      const ex = sx + Math.cos(ang) * 20 * (sgn === 1 ? 1 : 0.8), ey = sy + Math.sin(ang) * 20 + 6;
      limb(g, sgn === 1 ? pal.body : pal.shade, 4.5, sx, sy, ex, ey, sgn * 6);
      spike(g, '#cdd6e2', ex, ey, ang + 0.9, 13, 2.5);
    }
    if (name === 'hurt') blob(g, 'rgba(255,255,255,0.45)', cx, gy - 45, 18, 28, 0);
  }

  const ENEMY_DRAW = {
    crawler: drawCrawler, spitter: drawSpitter, wisp: drawWisp,
    imp: drawImp, brute: drawBrute, stalker: drawStalker
  };
  const ENEMY_CELL = { crawler: 56, spitter: 60, wisp: 60, imp: 56, brute: 108, stalker: 108 };

  function makeEnemySheet(type) {
    const cell = ENEMY_CELL[type], pal = ENEMY_PAL[type];
    const anims = { idle: { n: 4, fps: 6 }, walk: { n: 6, fps: 10 }, attack: { n: 4, fps: 10, loop: false }, hurt: { n: 1 } };
    return makeSheet(cell, cell, anims, (g, name, i, n) =>
      ENEMY_DRAW[type](g, pal, name, i, n, cell / 2, cell - 4));
  }

  // ================================================================
  // BOSSES — 5 mutated-alien archetypes, tinted per level.
  // ================================================================
  const BOSS_DEFS = [
    { id: 1, key: 'sporefather', name: 'THE SPOREFATHER',   pal: { body: '#6d7a45', shade: '#47502c', cap: '#a44a3f', capLt: '#c96b52', glow: '#d8ff7a' } },
    { id: 2, key: 'leviathan',   name: 'FEN LEVIATHAN',     pal: { body: '#3f7a6e', shade: '#2a544c', cap: '#7ac9a8', capLt: '#a8e8cd', glow: '#8affd8' } },
    { id: 3, key: 'tyrant',      name: 'CRYSTAL TYRANT',    pal: { body: '#5d5470', shade: '#3d374b', cap: '#9a7ae0', capLt: '#c9b2ff', glow: '#c9a2ff' } },
    { id: 4, key: 'warlord',     name: 'VOID WARLORD',      pal: { body: '#4a4a5e', shade: '#30303f', cap: '#3fd6c0', capLt: '#8affe9', glow: '#4bffdf' } },
    { id: 5, key: 'empress',     name: 'THE HIVE EMPRESS',  pal: { body: '#8a4a6e', shade: '#5c2f49', cap: '#e0b23f', capLt: '#ffe08a', glow: '#ffd24b' } }
  ];

  function drawSporefather(g, pal, name, i, n, cx, gy) {
    const ph = (i / n) * Math.PI * 2, s = Math.sin(ph);
    const slam = name === 'attack' ? Math.sin((i / (n - 1)) * Math.PI) : 0;
    limb(g, pal.shade, 14, cx - 16, gy - 42, cx - 24 - s * 9, gy, 6);
    limb(g, pal.body, 14, cx + 8, gy - 42, cx + 14 + s * 9, gy, 6);
    blob(g, pal.body, cx - 4, gy - 58, 34, 30, -0.1);           // massive torso
    for (let k = 0; k < 7; k++) blob(g, pal.glow, cx - 26 + k * 9, gy - 50 + (k % 3) * 8, 3, 3, 0); // spore sacs
    blob(g, pal.shade, cx + 18, gy - 52 + slam * 4, 11, 9, 0.15); // head
    glowEye(g, cx + 22, gy - 54, 2.6, pal.glow);
    glowEye(g, cx + 15, gy - 57, 1.8, pal.glow);
    glowEye(g, cx + 19, gy - 48, 1.5, pal.glow);
    // fungal cap crown
    blob(g, pal.cap, cx - 6, gy - 86 - slam * 4, 32, 13, 0);
    blob(g, pal.capLt, cx - 14, gy - 90 - slam * 4, 12, 5, 0);
    for (let k = 0; k < 5; k++) blob(g, pal.capLt, cx - 26 + k * 11, gy - 84 - slam * 4, 2.5, 2.5, 0);
    limb(g, pal.shade, 10, cx - 4, gy - 78 - slam * 4, cx - 4, gy - 72, 0); // stalk
    // arms
    const ay = slam > 0.4 ? gy - 78 : gy - 4;
    limb(g, pal.shade, 11, cx - 22, gy - 66, cx - 38 + s * 4, slam > 0.4 ? ay : gy - 4, -6);
    limb(g, pal.body, 11, cx + 14, gy - 66, cx + 36 - s * 4, ay, 6);
    blob(g, pal.shade, cx + 36 - s * 4, ay, 8, 7, 0);
    blob(g, pal.shade, cx - 38 + s * 4, slam > 0.4 ? ay : gy - 4, 8, 7, 0);
    if (name === 'hurt') blob(g, 'rgba(255,255,255,0.4)', cx, gy - 58, 40, 36, 0);
  }

  function drawLeviathan(g, pal, name, i, n, cx, gy) {
    const ph = (i / n) * Math.PI * 2;
    const strike = name === 'attack' ? Math.sin((i / (n - 1)) * Math.PI) : 0;
    // coiled serpent body
    g.strokeStyle = pal.body; g.lineCap = 'round';
    g.lineWidth = 26; g.beginPath();
    g.moveTo(cx - 44, gy - 10);
    g.bezierCurveTo(cx - 10, gy - 4 + Math.sin(ph) * 4, cx + 14, gy - 30, cx + 2, gy - 46);
    g.bezierCurveTo(cx - 8, gy - 60, cx + 10, gy - 74 - strike * 10, cx + 26, gy - 70 - strike * 16);
    g.stroke();
    g.strokeStyle = pal.shade; g.lineWidth = 12; g.beginPath();
    g.moveTo(cx - 44, gy - 6);
    g.bezierCurveTo(cx - 10, gy + 2 + Math.sin(ph) * 4, cx + 16, gy - 28, cx + 4, gy - 44);
    g.stroke();
    // fins along spine
    for (let k = 0; k < 5; k++) spike(g, pal.cap, cx - 34 + k * 12, gy - 20 - k * 8, -1.9 + Math.sin(ph + k) * 0.1, 14, 3);
    // head
    const hx = cx + 30, hy = gy - 72 - strike * 16;
    blob(g, pal.body, hx, hy, 15, 10, 0.2);
    g.save(); g.translate(hx + 4, hy + 4); g.rotate(strike * 0.8);
    blob(g, pal.shade, 10, 3, 12, 5, 0.2); g.restore();
    if (strike > 0.3) blob(g, pal.glow, hx + 14, hy + 6, 3 + strike * 3, 3 + strike * 3, 0);
    glowEye(g, hx + 4, hy - 4, 2.6, pal.glow);
    glowEye(g, hx - 4, hy - 6, 1.8, pal.glow);
    spike(g, pal.cap, hx - 8, hy - 8, -2.2, 12, 3);
    // whisker tentacles
    for (let k = -1; k <= 1; k += 2)
      limb(g, pal.capLt, 3, hx + 10, hy + 5, hx + 20 + Math.sin(ph) * 4, hy + 14 + k * 5, k * 5);
    if (name === 'hurt') blob(g, 'rgba(255,255,255,0.4)', cx, gy - 45, 44, 40, 0);
  }

  function drawTyrant(g, pal, name, i, n, cx, gy) {
    const ph = (i / n) * Math.PI * 2, s = Math.sin(ph);
    const charge = name === 'attack' ? Math.sin((i / (n - 1)) * Math.PI) : 0;
    // four heavy legs
    for (let k = 0; k < 2; k++) {
      limb(g, pal.shade, 11, cx - 22 + k * 8, gy - 34, cx - 26 + k * 8 - s * 8, gy, 5);
      limb(g, pal.body, 11, cx + 10 + k * 8, gy - 34, cx + 12 + k * 8 + s * 8, gy, 5);
    }
    // armored bulk, lowered when charging
    blob(g, pal.body, cx - 2, gy - 48 + charge * 6, 36, 24, -0.08 - charge * 0.12);
    // crystal shards on back
    for (let k = 0; k < 5; k++) {
      spike(g, pal.cap, cx - 24 + k * 11, gy - 62 + charge * 6 + Math.abs(k - 2) * 3, -1.65 + (k - 2) * 0.12, 18 - Math.abs(k - 2) * 3, 4);
      spike(g, pal.capLt, cx - 24 + k * 11, gy - 62 + charge * 6 + Math.abs(k - 2) * 3, -1.65 + (k - 2) * 0.12, 10 - Math.abs(k - 2) * 2, 1.8);
    }
    // armored head with horns
    const hx = cx + 28, hy = gy - 40 + charge * 8;
    blob(g, pal.shade, hx, hy, 13, 10, 0.15);
    blob(g, pal.body, hx + 2, hy - 3, 9, 5, 0.15);
    spike(g, pal.capLt, hx + 6, hy - 8, -0.5 - charge * 0.3, 16, 3.5);
    spike(g, pal.capLt, hx - 2, hy - 10, -1 - charge * 0.2, 12, 3);
    glowEye(g, hx + 5, hy + 1, 2.4, pal.glow);
    // plates
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = pal.shade; g.lineWidth = 3;
      g.beginPath(); g.arc(cx - 8 + k * 10, gy - 44 + charge * 6, 14, -0.6, 0.9); g.stroke();
    }
    if (name === 'hurt') blob(g, 'rgba(255,255,255,0.4)', cx, gy - 48, 42, 30, 0);
  }

  function drawWarlord(g, pal, name, i, n, cx, gy) {
    const ph = (i / n) * Math.PI * 2, s = Math.sin(ph);
    const aim = name === 'attack' ? Math.sin((i / (n - 1)) * Math.PI) : 0;
    // membrane cloak
    g.fillStyle = pal.shade; g.beginPath();
    g.moveTo(cx - 2, gy - 84);
    g.quadraticCurveTo(cx - 34 + Math.sin(ph) * 3, gy - 50, cx - 26, gy - 2);
    g.lineTo(cx + 6, gy - 10);
    g.closePath(); g.fill();
    // digitigrade legs
    limb(g, pal.shade, 8, cx - 4, gy - 44, cx - 10 - s * 5, gy, 7);
    limb(g, pal.body, 8, cx + 6, gy - 44, cx + 10 + s * 5, gy, 7);
    // tall thin torso
    limb(g, pal.body, 16, cx + 2, gy - 44, cx + 4, gy - 78, -2);
    for (let k = 0; k < 3; k++) blob(g, pal.cap, cx + 2, gy - 50 - k * 10, 3, 2.2, 0); // chest lights
    // elongated head
    blob(g, pal.body, cx + 6, gy - 88, 7, 9, 0.15);
    spike(g, pal.shade, cx + 2, gy - 94, -2.6, 18, 4); // cranial crest sweeping back
    glowEye(g, cx + 9, gy - 90, 2.2, pal.glow);
    glowEye(g, cx + 5, gy - 93, 1.4, pal.glow);
    // cannon arm (raises to aim)
    const aAng = -0.15 - aim * 0.1;
    const ax = cx + 8, ay = gy - 72;
    const ex = ax + Math.cos(aAng) * 26, ey = ay + Math.sin(aAng) * 26;
    limb(g, pal.shade, 7, ax, ay, ex, ey, 3);
    g.save(); g.translate(ex, ey); g.rotate(aAng);
    g.fillStyle = pal.shade; g.fillRect(-4, -5, 16, 10);
    g.fillStyle = pal.cap; g.fillRect(9, -3, 5, 6);
    if (aim > 0.5) blob(g, pal.glow, 15, 0, 4 + aim * 3, 4 + aim * 3, 0);
    g.restore();
    // off arm with claws
    limb(g, pal.body, 6, cx - 2, gy - 70, cx - 16, gy - 52, -5);
    for (let k = 0; k < 3; k++) spike(g, pal.capLt, cx - 16, gy - 52, 1.2 + k * 0.5, 8, 1.5);
    if (name === 'hurt') blob(g, 'rgba(255,255,255,0.4)', cx, gy - 60, 30, 42, 0);
  }

  function drawEmpress(g, pal, name, i, n, cx, gy) {
    const ph = (i / n) * Math.PI * 2;
    const dive = name === 'attack' ? Math.sin((i / (n - 1)) * Math.PI) : 0;
    const cy = gy - 56 + Math.sin(ph) * 4 + dive * 10;
    // wings (fast flap)
    const flap = Math.sin(ph * 2) * 0.7;
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      g.save(); g.translate(cx - 4, cy - 16); g.rotate(flap * sgn * 0.5 - sgn * 0.4);
      g.fillStyle = 'rgba(220,240,255,0.35)';
      g.beginPath(); g.ellipse(sgn * 24, -6, 26, 10, sgn * 0.3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(220,240,255,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(sgn * 44, -12); g.stroke();
      g.restore();
    }
    // segmented abdomen hanging below
    blob(g, pal.body, cx - 14, cy + 18, 16, 22, 0.5);
    for (let k = 0; k < 4; k++) {
      g.strokeStyle = pal.shade; g.lineWidth = 3;
      g.beginPath(); g.arc(cx - 16 - k * 3, cy + 14 + k * 7, 13 - k * 2, -0.5, 1.4); g.stroke();
    }
    blob(g, pal.glow, cx - 22, cy + 32, 4, 5, 0.4); // stinger glow
    // thorax + head
    blob(g, pal.body, cx, cy, 15, 12, -0.2);
    for (let k = 0; k < 4; k++) blob(g, pal.cap, cx - 8 + k * 5, cy - 6, 2, 2, 0);
    blob(g, pal.shade, cx + 13, cy - 6 + dive * 4, 8, 7, 0.2);
    // many eyes
    glowEye(g, cx + 16, cy - 8 + dive * 4, 2.2, pal.glow);
    glowEye(g, cx + 11, cy - 10 + dive * 4, 1.5, pal.glow);
    glowEye(g, cx + 13, cy - 3 + dive * 4, 1.3, pal.glow);
    // crown antennae
    spike(g, pal.cap, cx + 10, cy - 12, -1.9, 14, 2);
    spike(g, pal.cap, cx + 14, cy - 12, -1.5, 14, 2);
    // grasping legs
    for (let k = 0; k < 3; k++)
      limb(g, pal.shade, 3, cx + 2 + k * 4, cy + 8, cx + 6 + k * 5, cy + 20 + Math.sin(ph + k) * 3, 4);
    if (name === 'hurt') blob(g, 'rgba(255,255,255,0.4)', cx, cy + 4, 34, 34, 0);
  }

  const BOSS_DRAW = {
    sporefather: drawSporefather, leviathan: drawLeviathan,
    tyrant: drawTyrant, warlord: drawWarlord, empress: drawEmpress
  };

  function makeBossSheet(def) {
    const cell = 150;
    const anims = { idle: { n: 4, fps: 6 }, walk: { n: 6, fps: 9 }, attack: { n: 5, fps: 10, loop: false }, hurt: { n: 1 } };
    return makeSheet(cell, cell, anims, (g, name, i, n) =>
      BOSS_DRAW[def.key](g, def.pal, name, i, n, cell / 2, cell - 6));
  }

  // ================================================================
  // PROPS
  // ================================================================
  function makeProps() {
    const P = {};
    P.orb = makeSheet(28, 28, { idle: { n: 4, fps: 6 } }, (g, name, i, n) => {
      const q = Math.sin((i / n) * Math.PI * 2) * 0.5 + 0.5;
      const gr = g.createRadialGradient(14, 14, 1, 14, 14, 12);
      gr.addColorStop(0, '#f0d9ff'); gr.addColorStop(0.4, '#b45aff'); gr.addColorStop(1, 'rgba(120,40,200,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(14, 14, 11 + q * 2, 0, Math.PI * 2); g.fill();
      blob(g, '#e2b8ff', 14, 14, 4.5 + q, 4.5 + q, 0);
      blob(g, '#ffffff', 12.5, 12.5, 1.6, 1.6, 0);
    });
    P.rock = makeSheet(24, 24, { idle: { n: 1 } }, (g) => {
      blob(g, '#8a8d95', 12, 15, 8, 6.5, 0.2);
      blob(g, '#6b6e76', 14, 17, 5, 4, 0.2);
      blob(g, '#a5a8b0', 9, 12.5, 3, 2, 0.3);
    });
    P.skull = makeSheet(24, 24, { idle: { n: 1 } }, (g) => {
      blob(g, '#ddd3bd', 12, 13, 7.5, 6.5, 0);
      g.fillStyle = '#ddd3bd'; g.fillRect(8, 16, 8, 4);
      blob(g, '#3a3630', 9.5, 12.5, 2, 2.4, 0);
      blob(g, '#3a3630', 15, 12.5, 2, 2.4, 0);
      g.fillStyle = '#3a3630'; g.fillRect(9, 17.5, 1.4, 2); g.fillRect(12, 17.5, 1.4, 2); g.fillRect(15, 17.5, 1.4, 2);
    });
    P.spear = makeSheet(36, 12, { idle: { n: 1 } }, (g) => {
      limb(g, '#7a5433', 2.6, 3, 7, 27, 5, 0);
      spike(g, '#cdd6e2', 27, 5, -0.07, 8, 2.4);
      limb(g, '#a33a0e', 1.4, 6, 4, 8, 9, 0);
    });
    P.ammo = makeSheet(20, 20, { idle: { n: 2, fps: 3 } }, (g, name, i) => {
      g.fillStyle = '#46525d'; g.fillRect(5, 4, 10, 13);
      g.fillStyle = i ? '#4bffdf' : '#2aa891'; g.fillRect(7, 6, 6, 9);
      g.fillStyle = '#8a97a3'; g.fillRect(5, 3, 10, 2.4);
    });
    P.gun = makeSheet(30, 22, { idle: { n: 2, fps: 3 } }, (g, name, i) => {
      g.fillStyle = '#5d6b78'; g.fillRect(4, 6, 17, 7);
      g.fillStyle = '#3fd6c0'; g.fillRect(17, 8, 5, 4);
      g.fillStyle = '#46525d'; g.fillRect(6, 12, 5, 8);
      if (i) blob(g, 'rgba(75,255,223,0.5)', 13, 9, 10, 7, 0);
    });
    P.portal = makeSheet(72, 96, { idle: { n: 6, fps: 8 } }, (g, name, i, n) => {
      const ph = (i / n) * Math.PI * 2;
      for (let k = 4; k > 0; k--) {
        const r = k * 8 + Math.sin(ph + k) * 3;
        g.strokeStyle = k % 2 ? 'rgba(120,80,220,0.8)' : 'rgba(80,220,200,0.8)';
        g.lineWidth = 4;
        g.beginPath(); g.ellipse(36, 50, r * 0.55, r, 0, 0, Math.PI * 2); g.stroke();
      }
      const gr = g.createRadialGradient(36, 50, 2, 36, 50, 30);
      gr.addColorStop(0, 'rgba(240,225,255,0.95)'); gr.addColorStop(1, 'rgba(130,60,220,0.1)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(36, 50, 18, 34, 0, 0, Math.PI * 2); g.fill();
    });
    P.totem = makeSheet(40, 72, { off: { n: 1 }, on: { n: 2, fps: 4 } }, (g, name, i) => {
      g.fillStyle = '#6b4a2e'; g.fillRect(15, 14, 12, 56);
      g.fillStyle = '#57391f'; g.fillRect(15, 30, 12, 4); g.fillRect(15, 48, 12, 4);
      // carved bird totem head (nod to the reference art)
      blob(g, '#8a5a34', 21, 12, 11, 8, 0);
      spike(g, '#e0b23f', 30, 12, 0.15, 8, 3);
      spike(g, '#a44a3f', 14, 4, -2.2, 9, 3); spike(g, '#3f7a8a', 24, 3, -1.4, 9, 3);
      if (name === 'on') {
        glowEye(g, 17, 11, 2.4, i ? '#d9b8ff' : '#b45aff');
        blob(g, 'rgba(180,90,255,0.25)', 21, 34, 14, 34, 0);
      } else blob(g, '#3a2c1e', 17, 11, 2, 2, 0);
    });
    P.gem = makeSheet(18, 18, { idle: { n: 4, fps: 5 } }, (g, name, i, n) => {
      const q = Math.sin((i / n) * Math.PI * 2);
      g.save(); g.translate(9, 9); g.rotate(q * 0.2);
      g.fillStyle = '#4bd6ff'; g.beginPath();
      g.moveTo(0, -7); g.lineTo(5.5, 0); g.lineTo(0, 7); g.lineTo(-5.5, 0); g.closePath(); g.fill();
      g.fillStyle = '#b8f0ff'; g.beginPath();
      g.moveTo(0, -7); g.lineTo(5.5, 0); g.lineTo(0, 0); g.closePath(); g.fill();
      g.restore();
    });
    P.heart = makeSheet(22, 22, { idle: { n: 2, fps: 3 } }, (g, name, i) => {
      const s = i ? 1.1 : 1;
      g.save(); g.translate(11, 11); g.scale(s, s);
      g.fillStyle = '#c94b8a'; g.beginPath();
      g.moveTo(0, 6); g.bezierCurveTo(-9, -2, -5, -9, 0, -3.5);
      g.bezierCurveTo(5, -9, 9, -2, 0, 6); g.fill();
      g.restore();
    });
    return P;
  }

  // ================================================================
  // TILE ATLAS — one per theme, organic edges (never flat squares)
  // ================================================================
  function makeTiles(theme) {
    const T = 32;
    const cv = document.createElement('canvas');
    cv.width = T * 8; cv.height = T * 2;
    const g = cv.getContext('2d');
    function cell(ix, iy, fn) {
      g.save(); g.translate(ix * T, iy * T);
      g.beginPath(); g.rect(0, 0, T, T); g.clip(); fn(); g.restore();
    }
    // 0: solid with mossy top
    cell(0, 0, () => {
      g.fillStyle = theme.rock; g.fillRect(0, 6, T, T);
      g.fillStyle = theme.rockDk;
      blob(g, theme.rockDk, 8, 18, 5, 3.5, 0.4); blob(g, theme.rockDk, 24, 26, 6, 4, -0.3);
      g.fillStyle = theme.moss;
      g.beginPath(); g.moveTo(-2, 12);
      g.quadraticCurveTo(6, 2, 16, 7); g.quadraticCurveTo(26, 11, 34, 5);
      g.lineTo(34, 0); g.lineTo(-2, 0); g.closePath(); g.fill();
      g.fillStyle = theme.mossLt;
      blob(g, theme.mossLt, 6, 4, 5, 2.5, 0.2); blob(g, theme.mossLt, 22, 3, 6, 2.5, -0.15);
    });
    // 1: solid interior (textured variant)
    cell(1, 0, () => {
      g.fillStyle = theme.rock; g.fillRect(0, 0, T, T);
      g.globalAlpha = 0.35;
      blob(g, theme.rockDk, 10, 12, 6, 4, 0.5);
      blob(g, theme.rockLt, 23, 24, 4, 2.5, 0.3);
      g.globalAlpha = 1;
    });
    // 2: one-way platform (mossy ledge)
    cell(2, 0, () => {
      g.fillStyle = theme.rock;
      g.beginPath(); g.moveTo(0, 8); g.quadraticCurveTo(16, 4, 32, 8);
      g.lineTo(30, 16); g.quadraticCurveTo(16, 20, 2, 16); g.closePath(); g.fill();
      g.fillStyle = theme.moss;
      g.beginPath(); g.moveTo(-2, 10); g.quadraticCurveTo(8, 2, 18, 6);
      g.quadraticCurveTo(26, 9, 34, 4); g.lineTo(34, 0); g.lineTo(-2, 0); g.closePath(); g.fill();
      blob(g, theme.mossLt, 10, 3, 4, 2, 0.2);
    });
    // 3: vine
    cell(3, 0, () => {
      g.strokeStyle = theme.vine; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(16, -2); g.quadraticCurveTo(20, 10, 15, 18); g.quadraticCurveTo(12, 26, 17, 34); g.stroke();
      g.strokeStyle = theme.vineLt; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(16, -2); g.quadraticCurveTo(19, 10, 15, 18); g.stroke();
      blob(g, theme.vineLt, 11, 8, 4, 2, 0.7); blob(g, theme.vineLt, 21, 22, 4, 2, -0.7);
      blob(g, theme.vine, 22, 6, 3.5, 1.8, -0.6);
    });
    // 4: spikes (bone-thorn)
    cell(4, 0, () => {
      g.fillStyle = theme.rockDk; g.fillRect(0, 26, T, 6);
      for (let k = 0; k < 4; k++) {
        spike(g, theme.spike, 5 + k * 8, 28, -Math.PI / 2 + (k % 2 ? 0.12 : -0.12), 17, 3);
        spike(g, theme.spikeLt, 5 + k * 8, 28, -Math.PI / 2 + (k % 2 ? 0.12 : -0.12), 10, 1.2);
      }
    });
    // 5: solid top-left rounded / 6: top-right rounded (edge caps)
    cell(5, 0, () => {
      g.fillStyle = theme.rock;
      g.beginPath(); g.moveTo(32, 32); g.lineTo(32, 6); g.quadraticCurveTo(20, 4, 12, 10);
      g.quadraticCurveTo(2, 18, 4, 32); g.closePath(); g.fill();
      g.fillStyle = theme.moss;
      g.beginPath(); g.moveTo(34, 12); g.quadraticCurveTo(22, 2, 12, 10); g.quadraticCurveTo(6, 16, 6, 24);
      g.lineTo(0, 24); g.quadraticCurveTo(4, 8, 14, 4); g.quadraticCurveTo(24, 0, 34, 4); g.closePath(); g.fill();
    });
    cell(6, 0, () => {
      g.fillStyle = theme.rock;
      g.beginPath(); g.moveTo(0, 32); g.lineTo(0, 6); g.quadraticCurveTo(12, 4, 20, 10);
      g.quadraticCurveTo(30, 18, 28, 32); g.closePath(); g.fill();
      g.fillStyle = theme.moss;
      g.beginPath(); g.moveTo(-2, 12); g.quadraticCurveTo(10, 2, 20, 10); g.quadraticCurveTo(26, 16, 26, 24);
      g.lineTo(32, 24); g.quadraticCurveTo(28, 8, 18, 4); g.quadraticCurveTo(8, 0, -2, 4); g.closePath(); g.fill();
    });
    // 7: solid interior (plain variant — most of the fill)
    cell(7, 0, () => {
      const gr = g.createLinearGradient(0, 0, 8, T);
      gr.addColorStop(0, theme.rock); gr.addColorStop(1, theme.rockDk);
      g.fillStyle = gr; g.globalAlpha = 1; g.fillRect(0, 0, T, T);
      g.globalAlpha = 0.12; blob(g, theme.rockLt, 16, 10, 7, 4, 0.4); g.globalAlpha = 1;
    });
    return { cv, T };
  }

  // ---- public ---------------------------------------------------
  const S = {
    player: null, enemies: {}, props: null,
    bossDefs: BOSS_DEFS, bossSheets: {},
    draw, frame, makeTiles, KAYA,

    build() {
      if (typeof KAYA_SHEET !== 'undefined') {
        // Kaya's real sprite sheet, cut from the player's reference art
        const img = new Image();
        img.src = KAYA_SHEET.src;
        this.player = { cv: img, cw: KAYA_SHEET.cw, ch: KAYA_SHEET.ch, meta: KAYA_SHEET.meta };
      } else {
        this.player = makeSheet(72, 78, {
          idle: { n: 6, fps: 7 }, walk: { n: 8, fps: 12 }, run: { n: 8, fps: 15 },
          jump: { n: 1 }, fall: { n: 2, fps: 7 }, slide: { n: 1 },
          kick: { n: 5, fps: 18, loop: false }, throw: { n: 5, fps: 16, loop: false },
          shoot: { n: 3, fps: 14, loop: false }, crouch: { n: 1 }, pickup: { n: 4, fps: 12, loop: false },
          climb: { n: 6, fps: 9 }, swim: { n: 6, fps: 9 }, hurt: { n: 1 }
        }, kayaDraw);
      }
      Object.keys(ENEMY_DRAW).forEach(t => { this.enemies[t] = makeEnemySheet(t); });
      this.props = makeProps();
    },

    boss(id) {
      if (!this.bossSheets[id]) this.bossSheets[id] = makeBossSheet(BOSS_DEFS[id - 1]);
      return this.bossSheets[id];
    }
  };
  return S;
})();
