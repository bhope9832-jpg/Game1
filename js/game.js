'use strict';
// ---------------------------------------------------------------
// game.js — engine: loop, input, camera, parallax world rendering,
// combat resolution, HUD, menus, progress saving.
// ---------------------------------------------------------------

const VIEW_W = 960, VIEW_H = 540;

const Input = {
  keys: {},
  st: { left: 0, right: 0, up: 0, down: 0, run: 0, jump: 0 },
  hits: { jumpHit: 0, downHit: 0, kickHit: 0, throwHit: 0, shootHit: 0, pauseHit: 0, enterHit: 0, backHit: 0 },

  init() {
    addEventListener('keydown', e => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
      if (e.repeat) return;
      this.keys[e.code] = true;
      SFX.init();
      const c = e.code;
      if (c === 'Space' || c === 'KeyZ') this.hits.jumpHit = 1;
      if (c === 'ArrowDown' || c === 'KeyS') this.hits.downHit = 1;
      if (c === 'KeyX' || c === 'KeyJ') this.hits.kickHit = 1;
      if (c === 'KeyC' || c === 'KeyK') this.hits.throwHit = 1;
      if (c === 'KeyV' || c === 'KeyL') this.hits.shootHit = 1;
      if (c === 'Escape' || c === 'KeyP') this.hits.pauseHit = 1;
      if (c === 'Enter') this.hits.enterHit = 1;
      if (c === 'Backspace') this.hits.backHit = 1;
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
  },

  read() {
    const k = this.keys;
    return {
      left: !!(k.ArrowLeft || k.KeyA), right: !!(k.ArrowRight || k.KeyD),
      up: !!(k.ArrowUp || k.KeyW), down: !!(k.ArrowDown || k.KeyS),
      run: !!(k.ShiftLeft || k.ShiftRight), jump: !!(k.Space || k.KeyZ),
      jumpHit: this.hits.jumpHit, downHit: this.hits.downHit,
      kickHit: this.hits.kickHit, throwHit: this.hits.throwHit, shootHit: this.hits.shootHit
    };
  },
  clearHits() { for (const key in this.hits) this.hits[key] = 0; }
};

// =================================================================
const Game = {
  cv: null, g: null,
  state: 'title',          // title | select | play | pause | clear | victory
  level: null, player: null,
  enemies: [], projs: [], orbs: [], pickups: [], movers: [], totems: [], particles: [], popups: [],
  boss: null, portal: null,
  camX: 0, camY: 0, shake: 0, time: 0, levelTime: 0,
  score: 0, gems: 0, orbsCollected: 0, kills: 0, deaths: 0,
  checkpoint: null, bannerT: 0, flashT: 0, lightningT: 0, boltSeed: 0,
  selIdx: 0, curLevel: 1,
  bg: null, tilesAtlas: null, ambient: [],
  save: { unlocked: 1, best: {} },

  init() {
    this.cv = document.getElementById('game');
    this.g = this.cv.getContext('2d');
    Input.init();
    Sprites.build();
    try {
      const s = JSON.parse(localStorage.getItem('emberwild_save') || 'null');
      if (s && s.unlocked) this.save = s;
    } catch (e) { /* fresh save */ }
    this.selIdx = this.save.unlocked - 1;
    let last = performance.now();
    const loop = (now) => {
      const dt = U.clamp((now - last) / 1000, 0, 0.05);
      last = now;
      this.tick(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  persist() { try { localStorage.setItem('emberwild_save', JSON.stringify(this.save)); } catch (e) {} },

  // ---------------- level lifecycle -------------------------------
  startLevel(L) {
    this.curLevel = L;
    this.level = Levels.generate(L);
    const lvl = this.level;
    this.player = new Player(lvl.spawnX, lvl.spawnY);
    this.enemies = lvl.enemies.map(s => new Enemy(s));
    this.pickups = lvl.items.map(s => new Pickup(s.kind, s.x, s.y));
    this.movers = lvl.movers.map(s => new Mover(s));
    this.totems = lvl.checkpoints.map(s => ({ x: s.x, y: s.y, on: false, t: 0 }));
    this.projs = []; this.orbs = []; this.particles = []; this.popups = [];
    this.boss = new Boss(lvl.boss, lvl);
    this.portal = null;
    this.checkpoint = { x: lvl.spawnX, y: lvl.spawnY };
    this.levelTime = 0; this.score = 0; this.gems = 0; this.orbsCollected = 0; this.kills = 0; this.deaths = 0;
    this.bannerT = 3.2; this.shake = 0;
    this.camX = 0; this.camY = Math.max(0, lvl.spawnY - VIEW_H * 0.6);
    this.tilesAtlas = Sprites.makeTiles(lvl.theme);
    this.buildBackground();
    this.state = 'play';
  },

  respawn() {
    const p = this.player;
    p.x = this.checkpoint.x; p.y = this.checkpoint.y - 40;
    p.vx = 0; p.vy = 0;
    if (p.hp <= 0) p.hp = 6;
    p.state = 'normal'; p.invuln = 1.6; p.deadT = 0; p.action = null;
    // a death resets an unfinished boss fight
    if (this.boss && this.boss.active && !this.boss.dead) {
      const b = this.boss;
      b.active = false; b.hp = b.maxHp;
      b.x = b.spec.x; b.y = b.fly ? b.baseY : b.spec.groundY - b.h / 2;
      b.state = 'move'; b.cd = 2;
      this.enemies = this.enemies.filter(e => !e.summoned);
      b.minions = 0;
    }
  },

  // ---------------- helpers used by entities ----------------------
  addProj(pr) { this.projs.push(pr); },
  spawnParticles(x, y, n, col) {
    for (let i = 0; i < n; i++)
      this.particles.push({
        x, y, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.7) * 260,
        life: 0.35 + Math.random() * 0.4, col, r: 1.5 + Math.random() * 2.5
      });
  },
  popupDamage(x, y, n) { this.popups.push({ x, y, t: 0.8, txt: '-' + n }); },
  findThrowable(x, y, r) {
    let best = null, bd = 1e9;
    for (const it of this.pickups) {
      if (it.dead || !it.throwable) continue;
      const d = U.dist(x, y + 20, it.x, it.y);
      if (d < r + 14 && d < bd) { bd = d; best = it; }
    }
    return best;
  },
  dropItem(kind, x, y) { this.pickups.push(new Pickup(kind, x, y)); },
  enemyKilled(e) {
    this.kills++;
    this.score += e.st.big ? 150 : 50;
    const n = e.st.big ? 2 + (Math.random() < 0.6 ? 1 : 0) : 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) this.orbs.push(new Orb(e.x, e.y - 6));
    if (Math.random() < 0.18) this.pickups.push(new Pickup('ammo', e.x, e.y - 6));
    if (e.summoned) e.summoned.minions--;
    this.spawnParticles(e.x, e.y, 14, '#b45aff');
    SFX.play('boom');
  },
  bossKilled(b) {
    this.kills++;
    this.score += 1000;
    for (let i = 0; i < 10; i++) this.orbs.push(new Orb(b.x + (Math.random() - 0.5) * 60, b.y - 20));
    this.portal = { x: b.x, y: b.spec.groundY, t: 0 };
    this.enemies = this.enemies.filter(e => !e.summoned);
    this.shake = 14;
    SFX.play('roar'); SFX.play('portal');
    this.spawnParticles(b.x, b.y, 40, b.flashColor());
  },

  // ---------------- per-frame -------------------------------------
  tick(dt) {
    this.time += dt;
    const g = this.g;

    if (this.state === 'title') { this.drawTitle(g); this.menuInput('title'); }
    else if (this.state === 'select') { this.drawSelect(g); this.menuInput('select'); }
    else if (this.state === 'play') {
      if (Input.hits.pauseHit) { this.state = 'pause'; Input.clearHits(); this.render(g); return; }
      this.update(dt);
      this.render(g);
    }
    else if (this.state === 'pause') {
      this.render(g);
      this.drawOverlayPanel(g, 'PAUSED', ['Enter — resume', 'Backspace — quit to map']);
      if (Input.hits.enterHit || Input.hits.pauseHit) this.state = 'play';
      if (Input.hits.backHit) this.state = 'select';
    }
    else if (this.state === 'clear') { this.render(g); this.drawClear(g); this.menuInput('clear'); }
    else if (this.state === 'victory') { this.drawVictory(g); this.menuInput('victory'); }

    Input.clearHits();
  },

  menuInput(which) {
    const h = Input.hits;
    if (which === 'title') {
      if (h.enterHit || h.jumpHit) { SFX.play('select'); this.state = 'select'; }
    } else if (which === 'select') {
      const cols = 5;
      if (Input.keys.ArrowRight && !this._navHold) { this.selIdx = Math.min(19, this.selIdx + 1); SFX.play('select'); }
      if (Input.keys.ArrowLeft && !this._navHold) { this.selIdx = Math.max(0, this.selIdx - 1); SFX.play('select'); }
      if (Input.keys.ArrowDown && !this._navHold) { this.selIdx = Math.min(19, this.selIdx + cols); SFX.play('select'); }
      if (Input.keys.ArrowUp && !this._navHold) { this.selIdx = Math.max(0, this.selIdx - cols); SFX.play('select'); }
      this._navHold = Input.keys.ArrowRight || Input.keys.ArrowLeft || Input.keys.ArrowDown || Input.keys.ArrowUp;
      if (h.enterHit && this.selIdx < this.save.unlocked) this.startLevel(this.selIdx + 1);
      if (h.backHit) this.state = 'title';
    } else if (which === 'clear') {
      if (h.enterHit) {
        if (this.curLevel >= Levels.count) this.state = 'victory';
        else this.startLevel(this.curLevel + 1);
      }
      if (h.backHit) this.state = 'select';
    } else if (which === 'victory') {
      if (h.enterHit || h.backHit) this.state = 'select';
    }
  },

  update(dt) {
    const lvl = this.level, p = this.player;
    this.levelTime += dt;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.bannerT = Math.max(0, this.bannerT - dt);
    this.flashT = Math.max(0, this.flashT - dt);

    // occasional mystical lightning
    if (lvl.theme.lightning && Math.random() < dt * lvl.theme.lightning) {
      this.flashT = 0.28; this.boltSeed = Math.floor(Math.random() * 1e6);
      this.lightningT = this.time;
    }

    const input = Input.read();
    p.update(dt, input, this);

    // movers + carrying the player
    for (const m of this.movers) {
      m.update(dt);
      const onTop = p.vy >= 0 &&
        p.x + p.w / 2 > m.x && p.x - p.w / 2 < m.x + m.w &&
        Math.abs((p.y + p.h / 2) - m.y) < 14;
      if (onTop) {
        p.y = m.y - p.h / 2; p.vy = 0; p.onGround = true; p.coyote = 0.1;
        p.x += (m.x - m.px); p.y += (m.y - m.py);
      }
    }

    // boss trigger + arena lock
    const boss = this.boss;
    if (!boss.active && !boss.dead && p.x > lvl.arenaX + 60) {
      boss.active = true;
      SFX.play('roar');
      this.shake = 8;
    }
    if (boss.active && !boss.dead) {
      p.x = Math.max(p.x, boss.spec.arenaL + p.w / 2 + 4);
    }
    boss.update(dt, this);

    // enemies: only simulate near the camera
    for (const e of this.enemies) {
      if (Math.abs(e.x - p.x) < VIEW_W * 0.9) e.update(dt, this);
    }
    this.enemies = this.enemies.filter(e => !e.dead);

    // combat: player melee
    const mb = p.meleeBox();
    if (mb) {
      for (const e of this.enemies) {
        if (!p.kickHit.has(e) && U.aabb(mb.x, mb.y, mb.w, mb.h, e.x, e.y, e.w, e.h)) {
          p.kickHit.add(e); e.hurt(mb.dmg, p.x, this);
        }
      }
      if (boss.active && !boss.dead && !p.kickHit.has(boss) &&
          U.aabb(mb.x, mb.y, mb.w, mb.h, boss.x, boss.y, boss.w, boss.h)) {
        p.kickHit.add(boss); boss.hurt(mb.dmg, p.x, this);
      }
    }

    // enemy contact + attack boxes
    for (const e of this.enemies) {
      if (p.state === 'dead') break;
      if (U.aabb(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) p.damage(e.st.dmg, e.x, this);
      const ab = e.attackBox && e.attackBox();
      if (ab && U.aabb(p.x, p.y, p.w, p.h, ab.x, ab.y, ab.w, ab.h)) p.damage(ab.dmg, e.x, this);
    }
    if (boss.active && !boss.dead && p.state !== 'dead' &&
        U.aabb(p.x, p.y, p.w, p.h, boss.x, boss.y, boss.w, boss.h))
      p.damage(boss.contactDamage(), boss.x, this);

    // projectiles
    for (const pr of this.projs) {
      pr.update(dt, this);
      if (pr.dead) continue;
      if (pr.friendly) {
        for (const e of this.enemies) {
          // generous target box (min 36 tall, anchored to the feet) so
          // level shots connect with squat crawlers too
          const eb = Math.max(e.h, 36);
          const ey2 = e.y + e.h / 2 - eb / 2;
          if (U.aabb(pr.x, pr.y, pr.r * 2 + 4, pr.r * 2 + 4, e.x, ey2, e.w + 6, eb)) {
            e.hurt(pr.dmg, pr.x - pr.vx, this); pr.dead = true; break;
          }
        }
        if (!pr.dead && boss.active && !boss.dead &&
            U.aabb(pr.x, pr.y, pr.r * 2, pr.r * 2, boss.x, boss.y, boss.w, boss.h)) {
          boss.hurt(pr.dmg, pr.x - pr.vx, this); pr.dead = true;
        }
      } else if (p.state !== 'dead' &&
          U.aabb(pr.x, pr.y, pr.r * 2, pr.r * 2, p.x, p.y, p.w, p.h)) {
        p.damage(pr.dmg, pr.x - pr.vx, this); pr.dead = true;
      }
    }
    this.projs = this.projs.filter(pr => !pr.dead);

    // orbs & pickups
    for (const o of this.orbs) o.update(dt, this);
    this.orbs = this.orbs.filter(o => !o.dead);
    for (const it of this.pickups) it.update(dt, this);
    this.pickups = this.pickups.filter(it => !it.dead);

    // checkpoints
    for (const t of this.totems) {
      t.t += dt;
      if (!t.on && Math.abs(p.x - t.x) < 24 && Math.abs(p.y - t.y + 30) < 60) {
        t.on = true;
        this.checkpoint = { x: t.x, y: t.y };
        p.heal(3);
        SFX.play('checkpoint');
        this.spawnParticles(t.x, t.y - 40, 12, '#b45aff');
      }
    }

    // exit portal
    if (this.portal) {
      this.portal.t += dt;
      if (Math.random() < dt * 8) this.spawnParticles(this.portal.x + (Math.random() - 0.5) * 40, this.portal.y - Math.random() * 80, 1, '#b48aff');
      if (U.aabb(p.x, p.y, p.w, p.h, this.portal.x, this.portal.y - 45, 50, 90)) {
        this.completeLevel();
      }
    }

    // particles & popups
    for (const pt of this.particles) {
      pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 300 * dt;
    }
    this.particles = this.particles.filter(pt => pt.life > 0);
    for (const pp of this.popups) { pp.t -= dt; pp.y -= 40 * dt; }
    this.popups = this.popups.filter(pp => pp.t > 0);

    // ambient drift
    for (const a of this.ambient) {
      a.x += a.vx * dt; a.y += Math.sin(this.time * a.s + a.ph) * 12 * dt;
    }

    // camera
    const targX = U.clamp(p.x + p.facing * 46 - VIEW_W / 2, 0, lvl.W * TILE - VIEW_W);
    const targY = U.clamp(p.y - VIEW_H * 0.58, 0, lvl.H * TILE - VIEW_H);
    let minX = 0;
    if (boss.active && !boss.dead) minX = Math.max(0, boss.spec.arenaL - 20);
    this.camX += (Math.max(targX, minX) - this.camX) * Math.min(1, dt * 6);
    this.camY += (targY - this.camY) * Math.min(1, dt * 5);
  },

  completeLevel() {
    SFX.play('portal');
    const L = this.curLevel;
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(Levels.count, L + 1));
    const t = Math.floor(this.levelTime);
    if (!this.save.best[L] || t < this.save.best[L]) this.save.best[L] = t;
    this.persist();
    this.state = 'clear';
  },

  // ---------------- background building ---------------------------
  buildBackground() {
    const th = this.level.theme;
    const rnd = U.rng(this.level.L * 31 + 7);
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

    // far hills strip
    const far = mk(1400, VIEW_H); {
      const q = far.getContext('2d');
      q.fillStyle = th.hillsFar;
      q.beginPath(); q.moveTo(0, VIEW_H);
      for (let x = 0; x <= 1400; x += 40)
        q.lineTo(x, 330 - Math.sin(x * 0.006 + 2) * 60 - U.hash2(x, 1) * 40);
      q.lineTo(1400, VIEW_H); q.closePath(); q.fill();
      q.fillStyle = th.hills;
      q.beginPath(); q.moveTo(0, VIEW_H);
      for (let x = 0; x <= 1400; x += 30)
        q.lineTo(x, 400 - Math.sin(x * 0.009) * 50 - U.hash2(x, 9) * 50);
      q.lineTo(1400, VIEW_H); q.closePath(); q.fill();
    }

    // mid forest strip
    const mid = mk(1800, VIEW_H); {
      const q = mid.getContext('2d');
      for (let i = 0; i < 26; i++) {
        const x = rnd() * 1800, base = 470 + rnd() * 60, ht = 130 + rnd() * 160;
        q.strokeStyle = th.trees; q.lineWidth = 8 + rnd() * 10; q.lineCap = 'round';
        q.beginPath(); q.moveTo(x, base); q.quadraticCurveTo(x + (rnd() * 30 - 15), base - ht * 0.6, x + (rnd() * 40 - 20), base - ht); q.stroke();
        const fol = th.foliage[Math.floor(rnd() * th.foliage.length)];
        for (let b = 0; b < 4; b++) {
          q.fillStyle = b % 2 ? fol : th.treesLt;
          q.globalAlpha = 0.9;
          q.beginPath();
          q.ellipse(x + (rnd() * 90 - 45), base - ht + (rnd() * 60 - 40), 34 + rnd() * 30, 22 + rnd() * 16, rnd(), 0, Math.PI * 2);
          q.fill();
        }
        q.globalAlpha = 1;
      }
    }

    // near strip — bushes, standing stones, glow flora
    const near = mk(2200, VIEW_H); {
      const q = near.getContext('2d');
      for (let i = 0; i < 30; i++) {
        const x = rnd() * 2200, base = 540;
        const kind = rnd();
        if (kind < 0.4) {
          const fol = th.foliage[Math.floor(rnd() * th.foliage.length)];
          q.fillStyle = fol; q.globalAlpha = 0.85;
          q.beginPath(); q.ellipse(x, base - 14, 30 + rnd() * 26, 18 + rnd() * 10, 0, 0, Math.PI * 2); q.fill();
          q.globalAlpha = 1;
        } else if (kind < 0.7) {
          q.fillStyle = th.rockDk;
          q.beginPath(); q.ellipse(x, base - 20, 14 + rnd() * 10, 24 + rnd() * 16, rnd() * 0.3 - 0.15, 0, Math.PI * 2); q.fill();
          q.fillStyle = th.particle; q.globalAlpha = 0.5;
          q.fillRect(x - 3, base - 40 - rnd() * 10, 6, 3); q.globalAlpha = 1;
        } else {
          q.strokeStyle = th.trees; q.lineWidth = 14 + rnd() * 12; q.lineCap = 'round';
          q.beginPath(); q.moveTo(x, base); q.lineTo(x + rnd() * 30 - 15, base - 220 - rnd() * 120); q.stroke();
        }
      }
    }
    this.bg = { far, mid, near };

    // ambient floating motes
    this.ambient = [];
    for (let i = 0; i < 46; i++)
      this.ambient.push({
        x: Math.random() * this.level.W * TILE, y: Math.random() * VIEW_H * 1.4,
        vx: 6 + Math.random() * 14, s: 0.5 + Math.random() * 1.5,
        ph: Math.random() * 6, r: 1 + Math.random() * 2, a: 0.3 + Math.random() * 0.5
      });

    // drifting clouds
    this.clouds = [];
    for (let i = 0; i < 9; i++)
      this.clouds.push({
        x: Math.random() * 1400, y: 30 + Math.random() * 180,
        w: 120 + Math.random() * 180, sp: 6 + Math.random() * 12, a: 0.14 + Math.random() * 0.18
      });
  },

  // ---------------- rendering --------------------------------------
  render(g) {
    const lvl = this.level, th = lvl.theme, p = this.player;
    const shx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const shy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const cx = this.camX + shx, cy = this.camY + shy;

    // sky
    const sky = g.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, th.skyTop); sky.addColorStop(1, th.skyBot);
    g.fillStyle = sky; g.fillRect(0, 0, VIEW_W, VIEW_H);

    // twin moons
    g.globalAlpha = 0.8;
    g.fillStyle = '#f2ecd8'; g.beginPath(); g.arc(760 - cx * 0.02, 90, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = th.particle; g.globalAlpha = 0.35;
    g.beginPath(); g.arc(200 - cx * 0.015, 140, 16, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;

    // clouds (always drifting)
    for (const c of this.clouds) {
      const x = ((c.x + this.time * c.sp - cx * 0.06) % (1400 + c.w)) - c.w;
      g.fillStyle = 'rgba(240,244,250,' + c.a + ')';
      g.beginPath();
      g.ellipse(x, c.y, c.w / 2, c.w / 7, 0, 0, Math.PI * 2);
      g.ellipse(x + c.w * 0.25, c.y - 10, c.w / 3.2, c.w / 9, 0, 0, Math.PI * 2);
      g.fill();
    }

    // lightning flash
    if (this.flashT > 0) {
      g.fillStyle = 'rgba(240,248,255,' + (this.flashT * 1.6) + ')';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      const r2 = U.rng(this.boltSeed);
      let bx = 200 + r2() * 560, by = 0;
      g.strokeStyle = 'rgba(220,240,255,' + (this.flashT * 3) + ')';
      g.lineWidth = 3; g.beginPath(); g.moveTo(bx, by);
      while (by < 320) { bx += r2() * 60 - 30; by += 30 + r2() * 30; g.lineTo(bx, by); }
      g.stroke();
    }

    // parallax strips
    const tile = (img, fac, extraDrift) => {
      const w = img.width;
      let off = ((cx * fac + (extraDrift || 0)) % w + w) % w;
      g.drawImage(img, -off, 0); g.drawImage(img, -off + w, 0);
    };
    tile(this.bg.far, 0.15);
    tile(this.bg.mid, 0.35, this.time * 2);
    tile(this.bg.near, 0.6);

    // fog band (slow drift)
    g.fillStyle = th.fog;
    const fy = 300 + Math.sin(this.time * 0.4) * 20;
    g.beginPath();
    g.moveTo(0, fy);
    for (let x = 0; x <= VIEW_W; x += 60)
      g.quadraticCurveTo(x + 30, fy + Math.sin(x * 0.02 + this.time * 0.7) * 26, x + 60, fy);
    g.lineTo(VIEW_W, VIEW_H); g.lineTo(0, VIEW_H); g.closePath(); g.fill();

    // ---- world space -----------------------------------------------
    g.save();
    g.translate(-Math.round(cx), -Math.round(cy));

    this.drawTiles(g, cx, cy);

    for (const m of this.movers) m.draw(g, th);

    for (const t of this.totems) {
      const sh2 = Sprites.props.totem;
      const anim = t.on ? 'on' : 'off';
      Sprites.draw(g, sh2, anim, t.on ? Sprites.frame(sh2, 'on', t.t) : 0, t.x, t.y, false);
    }

    if (this.portal) {
      const sh2 = Sprites.props.portal;
      Sprites.draw(g, sh2, 'idle', Sprites.frame(sh2, 'idle', this.portal.t), this.portal.x, this.portal.y, false);
    }

    for (const it of this.pickups) it.draw(g);
    for (const e of this.enemies) {
      if (e.x > cx - 80 && e.x < cx + VIEW_W + 80) e.draw(g, this);
    }
    if (this.boss && !this.boss.dead && this.boss.x > cx - 200 && this.boss.x < cx + VIEW_W + 200)
      this.boss.draw(g);

    p.draw(g, this);

    for (const pr of this.projs) pr.draw(g);
    for (const o of this.orbs) o.draw(g);

    // water overlay (over entities so they read as submerged)
    this.drawWater(g, cx, cy);

    // energy wall while the boss lives
    if (this.boss.active && !this.boss.dead) {
      const wx = this.boss.spec.arenaL;
      g.fillStyle = 'rgba(180,90,255,' + (0.25 + Math.sin(this.time * 6) * 0.1) + ')';
      g.fillRect(wx - 6, cy - 40, 8, VIEW_H + 80);
    }

    // particles
    for (const pt of this.particles) {
      g.globalAlpha = Math.max(0, pt.life * 2);
      g.fillStyle = pt.col;
      g.beginPath(); g.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;

    // damage popups
    g.font = 'bold 13px monospace'; g.textAlign = 'center';
    for (const pp of this.popups) {
      g.globalAlpha = Math.min(1, pp.t * 2);
      g.fillStyle = '#1c1420'; g.fillText(pp.txt, pp.x + 1, pp.y + 1);
      g.fillStyle = '#ffd24b'; g.fillText(pp.txt, pp.x, pp.y);
    }
    g.globalAlpha = 1;

    // ambient motes over everything in-world
    for (const a of this.ambient) {
      if (a.x < cx - 20 || a.x > cx + VIEW_W + 20) continue;
      const yy = cy * 0.2 + a.y;
      g.globalAlpha = a.a * (0.6 + Math.sin(this.time * a.s * 2 + a.ph) * 0.4);
      g.fillStyle = th.particle;
      g.beginPath(); g.arc(a.x, yy, a.r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;

    g.restore();

    this.drawHUD(g);
  },

  drawTiles(g, cx, cy) {
    const lvl = this.level, atlas = this.tilesAtlas.cv;
    const x0 = Math.max(0, Math.floor(cx / TILE) - 1), x1 = Math.min(lvl.W - 1, Math.ceil((cx + VIEW_W) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cy / TILE) - 1), y1 = Math.min(lvl.H - 1, Math.ceil((cy + VIEW_H) / TILE) + 1);
    const th = this.level.theme;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = lvl.tiles[ty * lvl.W + tx];
        if (t === T_EMPTY || t === T_WATER) continue;
        const px = tx * TILE, py = ty * TILE;
        let cell = 1;
        if (t === T_SOLID) {
          const above = Phys.tileAt(lvl, tx, ty - 1);
          if (above !== T_SOLID) {
            const l = Phys.tileAt(lvl, tx - 1, ty), r = Phys.tileAt(lvl, tx + 1, ty);
            cell = (l !== T_SOLID) ? 5 : (r !== T_SOLID ? 6 : 0);
          } else cell = U.hash2(tx, ty) < 0.28 ? 1 : 7;
        } else if (t === T_PLAT) cell = 2;
        else if (t === T_VINE) cell = 3;
        else if (t === T_SPIKE) cell = 4;
        g.drawImage(atlas, cell * TILE, 0, TILE, TILE, px, py, TILE, TILE);

        // decorative flora on exposed mossy tops
        if (t === T_SOLID && Phys.tileAt(lvl, tx, ty - 1) === T_EMPTY) {
          const h2 = U.hash2(tx, ty);
          if (h2 < 0.38) {
            const fol = th.foliage[Math.floor(h2 * 20) % th.foliage.length];
            if (h2 < 0.16) { // grass blades
              g.strokeStyle = th.mossLt; g.lineWidth = 1.6;
              for (let b = 0; b < 3; b++) {
                const bx = px + 6 + b * 9, sw = Math.sin(this.time * 2 + tx + b) * 2;
                g.beginPath(); g.moveTo(bx, py + 2);
                g.quadraticCurveTo(bx + sw, py - 5, bx + sw * 1.6, py - 9); g.stroke();
              }
            } else if (h2 < 0.28) { // mushroom
              g.fillStyle = th.rockLt; g.fillRect(px + 13, py - 7, 4, 8);
              g.fillStyle = fol; g.beginPath(); g.ellipse(px + 15, py - 8, 8, 4.5, 0, Math.PI, 0); g.fill();
              g.fillStyle = 'rgba(255,255,255,0.6)';
              g.beginPath(); g.arc(px + 12, py - 9, 1.4, 0, Math.PI * 2); g.fill();
            } else { // flowers
              g.fillStyle = fol;
              g.beginPath(); g.arc(px + 8, py - 4, 2.6, 0, Math.PI * 2); g.fill();
              g.beginPath(); g.arc(px + 22, py - 3, 2.2, 0, Math.PI * 2); g.fill();
              g.fillStyle = '#fff8e0';
              g.beginPath(); g.arc(px + 8, py - 4, 1, 0, Math.PI * 2); g.fill();
            }
          }
        }
      }
    }
  },

  drawWater(g, cx, cy) {
    const lvl = this.level, th = lvl.theme;
    const x0 = Math.max(0, Math.floor(cx / TILE) - 1), x1 = Math.min(lvl.W - 1, Math.ceil((cx + VIEW_W) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cy / TILE) - 1), y1 = Math.min(lvl.H - 1, Math.ceil((cy + VIEW_H) / TILE) + 1);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (lvl.tiles[ty * lvl.W + tx] !== T_WATER) continue;
        const px = tx * TILE, py = ty * TILE;
        const surface = Phys.tileAt(lvl, tx, ty - 1) !== T_WATER;
        g.fillStyle = surface ? th.water : th.waterDeep;
        if (surface) {
          const w1 = Math.sin(this.time * 2.4 + tx * 1.3) * 3;
          const w2 = Math.sin(this.time * 2.4 + (tx + 1) * 1.3) * 3;
          g.beginPath();
          g.moveTo(px, py + 6 + w1);
          g.quadraticCurveTo(px + TILE / 2, py + 6 + (w1 + w2) / 2 - 2, px + TILE, py + 6 + w2);
          g.lineTo(px + TILE, py + TILE); g.lineTo(px, py + TILE); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(px, py + 6 + w1);
          g.quadraticCurveTo(px + TILE / 2, py + 6 + (w1 + w2) / 2 - 2, px + TILE, py + 6 + w2);
          g.stroke();
        } else {
          g.fillRect(px, py, TILE, TILE);
        }
      }
    }
  },

  // ---------------- HUD & menus ------------------------------------
  drawHUD(g) {
    const p = this.player, lvl = this.level;
    // portrait
    g.fillStyle = 'rgba(12,10,20,0.65)';
    this.rr(g, 12, 12, 250, 64, 10); g.fill();
    g.save();
    g.beginPath(); g.arc(44, 44, 24, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#2a2438'; g.fillRect(20, 20, 48, 48);
    g.drawImage(Sprites.player.cv, 12, 0, 52, 52, 16, 16, 56, 56);
    g.restore();
    g.strokeStyle = '#b45aff'; g.lineWidth = 2;
    g.beginPath(); g.arc(44, 44, 24, 0, Math.PI * 2); g.stroke();
    // hp bar (purple, orb-fed)
    g.fillStyle = 'rgba(0,0,0,0.6)'; this.rr(g, 78, 26, 172, 14, 7); g.fill();
    const q = p.hp / p.maxHp;
    if (q > 0) {
      const grad = g.createLinearGradient(78, 0, 250, 0);
      grad.addColorStop(0, '#8a3aff'); grad.addColorStop(1, '#d9a2ff');
      g.fillStyle = grad;
      this.rr(g, 80, 28, 168 * q, 10, 5); g.fill();
    }
    for (let i = 1; i < p.maxHp; i++) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(80 + (168 / p.maxHp) * i, 28, 1, 10);
    }
    // ammo + held
    g.font = 'bold 13px monospace'; g.textAlign = 'left'; g.fillStyle = '#cfd4dc';
    if (p.hasGun) {
      Sprites.draw(g, Sprites.props.gun, 'idle', 0, 96, 66, false, 0.9);
      g.fillStyle = p.ammo ? '#4bffdf' : '#ff5e5e';
      g.fillText('x' + p.ammo, 108, 62);
    }
    if (p.held) {
      const map = { rock: 'rock', skull: 'skull', spear: 'spear' };
      Sprites.draw(g, Sprites.props[map[p.held]], 'idle', 0, 170, 68, false, 0.9);
      g.fillStyle = '#cfd4dc'; g.fillText('held', 184, 62);
    }

    // right panel
    g.textAlign = 'right';
    g.fillStyle = 'rgba(12,10,20,0.65)';
    this.rr(g, VIEW_W - 262, 12, 250, 64, 10); g.fill();
    g.fillStyle = '#f0e8ff'; g.font = 'bold 15px monospace';
    g.fillText('LEVEL ' + lvl.L + ' — ' + lvl.name, VIEW_W - 24, 34);
    g.fillStyle = '#9a92b0'; g.font = '13px monospace';
    g.fillText(U.fmtTime(this.levelTime) + '   ♦' + this.gems + '   score ' + this.score, VIEW_W - 24, 56);
    g.textAlign = 'left';

    // boss bar
    const b = this.boss;
    if (b && b.active && !b.dead) {
      const bw = 460, bx = (VIEW_W - bw) / 2, by = VIEW_H - 46;
      g.fillStyle = 'rgba(12,10,20,0.7)'; this.rr(g, bx - 8, by - 22, bw + 16, 44, 8); g.fill();
      g.fillStyle = '#ffcccc'; g.font = 'bold 13px monospace'; g.textAlign = 'center';
      g.fillText(b.name, VIEW_W / 2, by - 6);
      g.fillStyle = 'rgba(0,0,0,0.6)'; this.rr(g, bx, by, bw, 12, 6); g.fill();
      const grad = g.createLinearGradient(bx, 0, bx + bw, 0);
      grad.addColorStop(0, '#ff3a5e'); grad.addColorStop(1, '#ff9a3a');
      g.fillStyle = grad;
      if (b.hp > 0) { this.rr(g, bx + 2, by + 2, (bw - 4) * (b.hp / b.maxHp), 8, 4); g.fill(); }
      g.textAlign = 'left';
    }

    // level intro banner
    if (this.bannerT > 0) {
      const a2 = Math.min(1, this.bannerT > 2.7 ? (3.2 - this.bannerT) * 2.2 : this.bannerT * 0.6);
      g.globalAlpha = Math.max(0, Math.min(1, a2));
      g.fillStyle = 'rgba(10,8,18,0.75)'; g.fillRect(0, VIEW_H / 2 - 58, VIEW_W, 108);
      g.fillStyle = '#d9b8ff'; g.font = 'bold 34px monospace'; g.textAlign = 'center';
      g.fillText(lvl.name.toUpperCase(), VIEW_W / 2, VIEW_H / 2 - 6);
      g.fillStyle = '#8a82a0'; g.font = '15px monospace';
      g.fillText(lvl.theme.name + '  •  Level ' + lvl.L + ' of 20', VIEW_W / 2, VIEW_H / 2 + 26);
      g.globalAlpha = 1; g.textAlign = 'left';
    }
  },

  rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  },

  drawMenuBg(g) {
    const th = THEMES[Math.floor(this.time / 8) % THEMES.length];
    const sky = g.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, th.skyTop); sky.addColorStop(1, th.skyBot);
    g.fillStyle = sky; g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.fillStyle = th.hills;
    g.beginPath(); g.moveTo(0, VIEW_H);
    for (let x = 0; x <= VIEW_W; x += 30)
      g.lineTo(x, 380 - Math.sin(x * 0.008 + this.time * 0.1) * 50 - U.hash2(x, 3) * 60);
    g.lineTo(VIEW_W, VIEW_H); g.closePath(); g.fill();
    for (let i = 0; i < 24; i++) {
      const x = ((i * 137 + this.time * 12) % (VIEW_W + 40)) - 20;
      const y = 80 + (i * 71) % 380 + Math.sin(this.time + i) * 10;
      g.globalAlpha = 0.35 + Math.sin(this.time * 2 + i) * 0.25;
      g.fillStyle = th.particle;
      g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  },

  drawTitle(g) {
    this.drawMenuBg(g);
    g.textAlign = 'center';
    g.fillStyle = 'rgba(10,8,18,0.55)'; g.fillRect(0, 90, VIEW_W, 190);
    g.fillStyle = '#d9b8ff'; g.font = 'bold 58px monospace';
    g.fillText('EMBERWILD', VIEW_W / 2, 170);
    g.fillStyle = '#8a82a0'; g.font = '18px monospace';
    g.fillText('— Kaya and the Hive Moon —', VIEW_W / 2, 205);
    g.fillStyle = '#c9c2da'; g.font = '14px monospace';
    g.fillText('20 levels · 5 mystical worlds · mutant alien bosses', VIEW_W / 2, 250);

    // Kaya, larger than life
    if (Sprites.player)
      Sprites.draw(g, Sprites.player, 'idle', Sprites.frame(Sprites.player, 'idle', this.time), VIEW_W / 2, 460, false, 2.2);

    g.fillStyle = 'rgba(10,8,18,0.6)'; this.rr(g, 40, 320, 260, 190, 10); g.fill();
    g.textAlign = 'left'; g.font = '13px monospace'; g.fillStyle = '#b8b0cc';
    const lines = ['←→ / AD    move', 'Shift      run', 'Space / Z  jump', '↓ / S      slide · stoop · pick up', 'X / J      kick', 'C / K      throw held item', 'V / L      fire laser pistol', '↑↓ on vines: climb  ·  in water: swim'];
    lines.forEach((l, i) => g.fillText(l, 56, 348 + i * 20));

    g.fillStyle = 'rgba(10,8,18,0.6)'; this.rr(g, VIEW_W - 300, 320, 260, 110, 10); g.fill();
    g.fillStyle = '#b8b0cc';
    g.fillText('Purple orbs from fallen foes', VIEW_W - 286, 348);
    g.fillText('restore Kaya\'s life force.', VIEW_W - 286, 368);
    g.fillText('A mutated horror guards the', VIEW_W - 286, 396);
    g.fillText('portal at each level\'s end.', VIEW_W - 286, 416);

    g.textAlign = 'center';
    g.fillStyle = Math.sin(this.time * 4) > 0 ? '#ffe9a8' : '#c9a13b';
    g.font = 'bold 20px monospace';
    g.fillText('PRESS ENTER', VIEW_W / 2, 528);
    g.textAlign = 'left';
  },

  drawSelect(g) {
    this.drawMenuBg(g);
    g.textAlign = 'center';
    g.fillStyle = '#d9b8ff'; g.font = 'bold 30px monospace';
    g.fillText('CHOOSE YOUR PATH', VIEW_W / 2, 52);
    g.font = '13px monospace'; g.fillStyle = '#9a92b0';
    g.fillText('arrows: navigate · Enter: play · Backspace: title', VIEW_W / 2, 78);

    const cols = 5, cw = 168, ch = 92, gx = (VIEW_W - cols * cw - (cols - 1) * 12) / 2, gyy = 100;
    for (let i = 0; i < 20; i++) {
      const cxx = gx + (i % cols) * (cw + 12), cyy = gyy + Math.floor(i / cols) * (ch + 12);
      const th = THEMES[Math.floor(i / 4)];
      const unlocked = i < this.save.unlocked;
      const sel = i === this.selIdx;
      g.fillStyle = unlocked ? 'rgba(16,12,28,0.8)' : 'rgba(10,8,16,0.85)';
      this.rr(g, cxx, cyy, cw, ch, 8); g.fill();
      if (sel) { g.strokeStyle = '#ffe9a8'; g.lineWidth = 3; this.rr(g, cxx, cyy, cw, ch, 8); g.stroke(); }
      g.fillStyle = unlocked ? th.moss : '#3a3644';
      this.rr(g, cxx, cyy, cw, 8, 4); g.fill();
      g.textAlign = 'left';
      g.fillStyle = unlocked ? '#f0e8ff' : '#55506a'; g.font = 'bold 15px monospace';
      g.fillText((i + 1) + '.', cxx + 10, cyy + 32);
      g.font = '12px monospace';
      g.fillStyle = unlocked ? '#c9c2da' : '#4a4660';
      g.fillText(unlocked ? LEVEL_NAMES[i] : '· · · locked · · ·', cxx + 10, cyy + 52);
      g.fillStyle = '#8a82a0'; g.font = '11px monospace';
      if (unlocked) {
        g.fillText(th.name, cxx + 10, cyy + 70);
        if (this.save.best[i + 1]) g.fillText('best ' + U.fmtTime(this.save.best[i + 1]), cxx + 10, cyy + 84);
      }
      if (!unlocked) {
        g.fillStyle = '#55506a'; g.font = '18px monospace';
        g.fillText('🔒'.codePointAt ? '✕' : 'x', cxx + cw - 26, cyy + 32);
      }
      g.textAlign = 'center';
    }
    g.textAlign = 'left';
  },

  drawOverlayPanel(g, title, lines) {
    g.fillStyle = 'rgba(8,6,14,0.72)'; g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.textAlign = 'center';
    g.fillStyle = '#d9b8ff'; g.font = 'bold 40px monospace';
    g.fillText(title, VIEW_W / 2, VIEW_H / 2 - 40);
    g.font = '16px monospace'; g.fillStyle = '#b8b0cc';
    lines.forEach((l, i) => g.fillText(l, VIEW_W / 2, VIEW_H / 2 + 10 + i * 28));
    g.textAlign = 'left';
  },

  drawClear(g) {
    const L = this.curLevel;
    this.drawOverlayPanel(g, 'LEVEL ' + L + ' CLEARED', [
      'time  ' + U.fmtTime(this.levelTime) + (this.save.best[L] ? '   (best ' + U.fmtTime(this.save.best[L]) + ')' : ''),
      'kills ' + this.kills + '   orbs ' + this.orbsCollected + '   gems ' + this.gems,
      'score ' + this.score + '   deaths ' + this.deaths,
      '',
      L >= 20 ? 'Enter — witness the ending' : 'Enter — venture deeper   ·   Backspace — map'
    ]);
  },

  drawVictory(g) {
    this.drawMenuBg(g);
    g.textAlign = 'center';
    g.fillStyle = 'rgba(8,6,14,0.6)'; g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.fillStyle = '#ffe9a8'; g.font = 'bold 44px monospace';
    g.fillText('THE HIVE MOON FALLS', VIEW_W / 2, 160);
    g.fillStyle = '#c9c2da'; g.font = '16px monospace';
    g.fillText('Twenty trials. Five worlds. One barefoot huntress.', VIEW_W / 2, 210);
    g.fillText('Kaya kicks the Empress\'s crown into the swamp and goes home.', VIEW_W / 2, 238);
    if (Sprites.player)
      Sprites.draw(g, Sprites.player, 'idle', Sprites.frame(Sprites.player, 'idle', this.time), VIEW_W / 2, 430, false, 2.4);
    g.fillStyle = '#9a92b0'; g.font = '15px monospace';
    g.fillText('Enter — return to the map', VIEW_W / 2, 500);
    g.textAlign = 'left';
  }
};

window.addEventListener('load', () => Game.init());
