'use strict';
// ---------------------------------------------------------------
// entities.js — physics + player / enemies / bosses / projectiles
// ---------------------------------------------------------------

const Phys = {
  tileAt(lvl, tx, ty) {
    if (tx < 0 || tx >= lvl.W) return T_SOLID;
    if (ty < 0 || ty >= lvl.H) return T_EMPTY;
    return lvl.tiles[ty * lvl.W + tx];
  },
  rectHitsSolid(lvl, x, y, w, h) {
    const x0 = Math.floor((x - w / 2) / TILE), x1 = Math.floor((x + w / 2 - 0.01) / TILE);
    const y0 = Math.floor((y - h / 2) / TILE), y1 = Math.floor((y + h / 2 - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (this.tileAt(lvl, tx, ty) === T_SOLID) return true;
    return false;
  },
  rectHasTile(lvl, x, y, w, h, kind) {
    const x0 = Math.floor((x - w / 2) / TILE), x1 = Math.floor((x + w / 2 - 0.01) / TILE);
    const y0 = Math.floor((y - h / 2) / TILE), y1 = Math.floor((y + h / 2 - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (this.tileAt(lvl, tx, ty) === kind) return true;
    return false;
  },
  inWater(lvl, x, y) {
    return this.tileAt(lvl, Math.floor(x / TILE), Math.floor(y / TILE)) === T_WATER;
  },
  move(e, lvl, dt, o) {
    o = o || {};
    e.hitWall = false; e.onGround = false;
    const dx = e.vx * dt, dy = e.vy * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0) {
        if (!this.rectHitsSolid(lvl, e.x + sx, e.y, e.w, e.h)) e.x += sx;
        else {
          const s2 = Math.sign(sx); let k = 0;
          while (k < 8 && !this.rectHitsSolid(lvl, e.x + s2, e.y, e.w, e.h)) { e.x += s2; k++; }
          e.hitWall = true; e.vx = 0;
        }
      }
      if (sy !== 0) {
        const bottom = e.y + e.h / 2;
        if (!this.rectHitsSolid(lvl, e.x, e.y + sy, e.w, e.h)) {
          let landed = false;
          if (sy > 0 && !o.drop) {
            const rowOld = Math.floor((bottom - 0.01) / TILE);
            const rowNew = Math.floor((bottom + sy) / TILE);
            if (rowNew !== rowOld) {
              const x0 = Math.floor((e.x - e.w / 2) / TILE), x1 = Math.floor((e.x + e.w / 2 - 0.01) / TILE);
              for (let tx = x0; tx <= x1; tx++) {
                if (this.tileAt(lvl, tx, rowNew) === T_PLAT) {
                  e.y = rowNew * TILE - e.h / 2; e.vy = 0; e.onGround = true; landed = true; break;
                }
              }
            }
          }
          if (!landed) e.y += sy;
        } else {
          const s2 = Math.sign(sy); let k = 0;
          while (k < 8 && !this.rectHitsSolid(lvl, e.x, e.y + s2, e.w, e.h)) { e.y += s2; k++; }
          if (sy > 0) e.onGround = true;
          e.vy = 0;
        }
      }
    }
  },
  groundAhead(lvl, e, dir) {
    const tx = Math.floor((e.x + dir * (e.w / 2 + 6)) / TILE);
    const ty = Math.floor((e.y + e.h / 2 + 8) / TILE);
    const t = this.tileAt(lvl, tx, ty);
    return t === T_SOLID || t === T_PLAT;
  }
};

// =================================================================
// PLAYER — Kaya
// =================================================================
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 20; this.h = 52;
    this.vx = 0; this.vy = 0; this.facing = 1;
    this.hp = 10; this.maxHp = 10;
    this.ammo = 0; this.hasGun = false; this.held = null;
    this.onGround = false; this.hitWall = false;
    this.state = 'normal';                 // normal | slide | climb | swim | dead
    this.anim = 'idle'; this.animT = 0;
    this.actionT = 0; this.action = null;  // kick | throw | shoot | pickup
    this.slideT = 0; this.invuln = 0; this.hurtT = 0;
    this.coyote = 0; this.kickHit = new Set(); this.deadT = 0;
    this.wasInWater = false; this.vineCd = 0;
    this.grabbedBy = null; this.squishT = 0;   // spider latch
    this.downBounced = 0; this.downT = 0;      // knocked-down tumble
  }

  // a latcher spider grabs hold of her
  grab(spider, game) {
    if (this.state === 'dead' || this.state === 'grabbed' || this.state === 'downed') return false;
    this.state = 'grabbed';
    this.grabbedBy = spider;
    this.vx = 0; this.vy = 0;
    this.action = null; this.slideT = 0;
    this.setAnim('grabbed');
    SFX.play('roar');
    game.spawnParticles(this.x, this.y - 10, 8, '#d9b8ff');
    return true;
  }

  // spider lets go — she drops and takes a tumble
  release(game) {
    this.grabbedBy = null;
    this.state = 'downed';
    this.downBounced = 0; this.downT = 0;
    this.vx = -this.facing * 60;
    this.vy = -120;
  }

  box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  setAnim(a) { if (this.anim !== a) { this.anim = a; this.animT = 0; } }

  damage(n, fromX, game) {
    if (this.invuln > 0 || this.state === 'dead') return;
    this.hp -= n;
    this.invuln = 1.1; this.hurtT = 0.35;
    this.vx = (this.x < fromX ? -1 : 1) * 240;
    this.vy = -260;
    SFX.play('hurt');
    game.spawnParticles(this.x, this.y, 8, '#e05a1e');
    game.shake = Math.max(game.shake, 5);
    if (this.hp <= 0) { this.hp = 0; this.die(game); }
  }

  die(game) {
    if (this.state === 'dead') return;
    this.state = 'dead'; this.deadT = 0; this.vx = 0; this.vy = -380;
    SFX.play('die');
    game.deaths++;
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  update(dt, input, game) {
    const lvl = game.level;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.animT += dt;

    if (this.state === 'dead') {
      this.deadT += dt;
      this.vy = Math.min(this.vy + 1900 * dt, 900);
      this.y += this.vy * dt;
      if (this.deadT > 1.6) game.respawn();
      return;
    }

    if (this.state === 'grabbed') {
      // helpless while the spider squeezes — it moves us nowhere
      this.squishT = Math.max(0, this.squishT - dt);
      this.setAnim('grabbed');
      if (!this.grabbedBy || this.grabbedBy.dead) this.release(game);
      return;
    }

    if (this.state === 'downed') {
      // dropped by the spider: fall, bounce on her side, take a hit
      this.downT += dt;
      const wasAir = !this.onGround;
      this.vy = Math.min(this.vy + 1900 * dt, 900);
      Phys.move(this, lvl, dt);
      this.vx *= 0.96;
      if (this.onGround && wasAir) {
        if (this.downBounced === 0) {
          this.downBounced = 1;
          this.vy = -170; this.vx = -this.facing * 50;
          this.hp = Math.max(0, this.hp - 1);
          SFX.play('hurt');
          game.shake = Math.max(game.shake, 5);
          game.spawnParticles(this.x, this.y + this.h / 2, 8, '#d9ac74');
          this.downT = 0;
          if (this.hp <= 0) { this.die(game); return; }
        } else if (this.downBounced === 1) {
          this.downBounced = 2; this.downT = 0;
        }
      }
      if (this.downBounced >= 2 && this.downT > 0.55) {
        this.state = 'normal'; this.invuln = 1.8;
      }
      this.setAnim('hurt');
      return;
    }

    const inWater = Phys.inWater(lvl, this.x, this.y);
    const onVine = Phys.rectHasTile(lvl, this.x, this.y, this.w, this.h, T_VINE);

    // splash on entering / leaving water
    if (inWater !== this.wasInWater) {
      SFX.play('splash');
      game.spawnParticles(this.x, this.y + (inWater ? -this.h / 2 : this.h / 2), 10, '#bfe8ff');
      this.wasInWater = inWater;
    }

    // ---- state transitions ----
    if (this.state !== 'swim' && inWater) { this.state = 'swim'; this.action = null; this.slideT = 0; }
    if (this.state === 'swim' && !inWater) this.state = 'normal';
    if (this.state === 'climb' && !onVine) this.state = 'normal';

    this.vineCd = Math.max(0, this.vineCd - dt);
    if (this.state === 'normal' && onVine && (input.up || input.down) && !this.action && this.vineCd <= 0) {
      this.state = 'climb'; this.vx = 0; this.vy = 0;
      const tx = Math.floor(this.x / TILE);
      this.x = tx * TILE + TILE / 2;
    }

    // ---- action timers (kick / throw / shoot / pickup lock briefly) ----
    if (this.action) {
      this.actionT -= dt;
      if (this.actionT <= 0) { this.action = null; this.kickHit.clear(); }
    }

    const dir = (input.left ? -1 : 0) + (input.right ? 1 : 0);

    if (this.state === 'swim') {
      // ---------------- swimming ----------------
      const sp = 155;
      this.vx += ((dir * sp) - this.vx) * Math.min(1, dt * 6);
      if (dir) this.facing = dir;
      if (input.up) this.vy += (-150 - this.vy) * Math.min(1, dt * 6);
      else if (input.down) this.vy += (170 - this.vy) * Math.min(1, dt * 6);
      else this.vy += (28 - this.vy) * Math.min(1, dt * 2.2); // gentle sink
      // burst out of the surface
      const headWater = Phys.inWater(lvl, this.x, this.y - this.h / 2 - 4);
      if (input.jumpHit && !headWater) { this.vy = -470; this.state = 'normal'; SFX.play('splash'); }
      Phys.move(this, lvl, dt);
      if (Math.random() < dt * 6) game.spawnParticles(this.x + this.facing * 8, this.y - 8, 1, 'rgba(220,245,255,0.8)');
      this.setAnim('swim');

    } else if (this.state === 'climb') {
      // ---------------- climbing ----------------
      const cs = 135;
      this.vy = (input.up ? -cs : 0) + (input.down ? cs : 0);
      this.vx = dir * 55;
      Phys.move(this, lvl, dt);
      if (input.jumpHit) {
        this.state = 'normal'; this.vy = -470; this.vx = dir * 220;
        this.vineCd = 0.35;
        SFX.play('jump');
      }
      if (this.onGround && input.down) this.state = 'normal';
      this.setAnim('climb');
      // animT gained +dt at the top of update: leave it for climbing up,
      // cancel it to freeze while hanging, run it backwards climbing down
      if (input.down && !input.up) this.animT -= 2 * dt;
      else if (!input.up) this.animT -= dt;

    } else {
      // ---------------- ground / air ----------------
      const run = input.run;
      const top = this.action === 'shoot' ? 60 : (run ? 300 : 172);
      const accel = this.onGround ? 1900 : 1150;

      if (this.state === 'slide') {
        this.slideT -= dt;
        this.vx = this.facing * Math.max(140, 430 * (this.slideT / 0.45));
        if (this.slideT <= 0 || this.hitWall) {
          // don't stand up into a ceiling
          if (!Phys.rectHitsSolid(lvl, this.x, this.y - 12, this.w, 52)) this.state = 'normal';
          else this.slideT = 0.08;
        }
      } else {
        if (dir !== 0 && !this.action) {
          this.vx += dir * accel * dt;
          this.vx = U.clamp(this.vx, -top, top);
          this.facing = dir;
        } else {
          const fr = this.onGround ? 1600 : 300;
          const s = Math.sign(this.vx);
          this.vx -= s * Math.min(Math.abs(this.vx), fr * dt);
        }
      }

      // jumping (with a little coyote time)
      this.coyote = this.onGround ? 0.1 : Math.max(0, this.coyote - dt);
      if (input.jumpHit && (this.onGround || this.coyote > 0) && this.state !== 'slide') {
        this.vy = -620; this.coyote = 0; SFX.play('jump');
        game.spawnParticles(this.x, this.y + this.h / 2, 4, 'rgba(255,255,255,0.5)');
      }
      if (!input.jump && this.vy < -240) this.vy = -240; // variable jump height

      // start slide
      if (input.downHit && this.onGround && Math.abs(this.vx) > 210 && this.state === 'normal' && !this.action) {
        this.state = 'slide'; this.slideT = 0.45; this.kickHit.clear();
        SFX.play('slide');
      }
      if (this.state === 'slide' && !this.onGround) this.state = 'normal';

      // stoop & pick up a throwable
      if (input.downHit && this.onGround && Math.abs(this.vx) < 60 && this.state === 'normal' && !this.action) {
        const it = game.findThrowable(this.x, this.y, 30);
        if (it) {
          this.action = 'pickup'; this.actionT = 0.32; this.setAnim('pickup');
          if (this.held) game.dropItem(this.held, this.x, this.y);
          this.held = it.kind; it.dead = true;
          SFX.play('pickup');
        }
      }

      // attacks
      if (input.kickHit && !this.action && this.state !== 'slide') {
        this.action = 'kick'; this.actionT = 0.3; this.setAnim('kick');
        this.kickHit.clear(); SFX.play('kick');
      }
      if (input.throwHit && !this.action && this.held) {
        this.action = 'throw'; this.actionT = 0.3; this.setAnim('throw');
        const kind = this.held; this.held = null;
        game.addProj(new Projectile(kind, this.x + this.facing * 12, this.y - 14,
          this.facing * (kind === 'spear' ? 520 : 430) + this.vx * 0.4, kind === 'spear' ? -60 : -240, true));
        SFX.play('throw');
      }
      if (input.shootHit && !this.action && this.hasGun && this.state !== 'slide') {
        if (this.ammo > 0) {
          this.ammo--;
          this.action = 'shoot'; this.actionT = 0.26; this.setAnim('shoot');
          game.addProj(new Projectile('laser', this.x + this.facing * 20, this.y - 10, this.facing * 720, 0, true));
          game.spawnParticles(this.x + this.facing * 24, this.y - 10, 4, '#4bffdf');
          SFX.play('laser');
        }
      }

      // gravity
      this.vy = Math.min(this.vy + 1900 * dt, 900);
      const dropThrough = input.down && !input.downHit && this.vy > 0 && this.state !== 'slide';
      const oldH = this.h;
      this.h = this.state === 'slide' ? 28 : 52;
      if (this.h > oldH) this.y -= (this.h - oldH) / 2; else if (this.h < oldH) this.y += (oldH - this.h) / 2;
      Phys.move(this, lvl, dt, { drop: dropThrough && this.isOnPlatformOnly(lvl) });

      // step-up assist: 1-tile rises walk like slopes
      if (this.hitWall && this.onGround && dir !== 0 && this.state === 'normal' && !this.action) {
        const tx = Math.floor((this.x + dir * (this.w / 2 + 4)) / TILE);
        const footRow = Math.floor((this.y + this.h / 2 - 2) / TILE);
        if (Phys.tileAt(lvl, tx, footRow) === T_SOLID &&
            Phys.tileAt(lvl, tx, footRow - 1) !== T_SOLID &&
            Phys.tileAt(lvl, tx, footRow - 2) !== T_SOLID &&
            !Phys.rectHitsSolid(lvl, this.x + dir * 6, footRow * TILE - this.h / 2 - 1, this.w, this.h)) {
          this.y = footRow * TILE - this.h / 2 - 0.5;
          this.x += dir * 6;
          this.vx = dir * Math.max(Math.abs(this.vx), 120);
          this.onGround = true;
        }
      }

      // pick animation
      if (this.action === 'kick') this.setAnim('kick');
      else if (this.action === 'throw') this.setAnim('throw');
      else if (this.action === 'shoot') this.setAnim('shoot');
      else if (this.action === 'pickup') this.setAnim('pickup');
      else if (this.hurtT > 0) this.setAnim('hurt');
      else if (this.state === 'slide') this.setAnim('slide');
      else if (!this.onGround) this.setAnim(this.vy < -60 ? 'jump' : 'fall');
      else if (input.down && Math.abs(this.vx) < 40) this.setAnim('crouch');
      else if (Math.abs(this.vx) > 210) this.setAnim('run');
      else if (Math.abs(this.vx) > 20) this.setAnim('walk');
      else this.setAnim('idle');

      // run dust
      if (this.onGround && Math.abs(this.vx) > 210 && Math.random() < dt * 14)
        game.spawnParticles(this.x - this.facing * 10, this.y + this.h / 2 - 2, 1, 'rgba(200,200,190,0.5)');
    }

    // spikes
    if (Phys.rectHasTile(lvl, this.x, this.y + 6, this.w, this.h - 8, T_SPIKE)) {
      this.damage(2, this.x - this.facing, game);
      this.vy = -420;
    }

    // fell out of the world
    if (this.y > lvl.H * TILE + 160) {
      this.hp -= 2; SFX.play('hurt');
      if (this.hp <= 0) { this.hp = 0; game.deaths++; }
      game.respawn();
    }
  }

  isOnPlatformOnly(lvl) {
    const bottom = this.y + this.h / 2;
    const ty = Math.floor((bottom + 2) / TILE);
    const x0 = Math.floor((this.x - this.w / 2) / TILE), x1 = Math.floor((this.x + this.w / 2 - 0.01) / TILE);
    let plat = false;
    for (let tx = x0; tx <= x1; tx++) {
      const t = Phys.tileAt(lvl, tx, ty);
      if (t === T_SOLID) return false;
      if (t === T_PLAT) plat = true;
    }
    return plat;
  }

  // active melee hitbox (kick or slide)
  meleeBox() {
    if (this.action === 'kick' && this.actionT < 0.26 && this.actionT > 0.06)
      return { x: this.x + this.facing * 24, y: this.y - 6, w: 34, h: 40, dmg: 1 };
    if (this.state === 'slide')
      return { x: this.x + this.facing * 12, y: this.y + 4, w: 30, h: 26, dmg: 1 };
    return null;
  }

  draw(g, game) {
    if (this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0 && this.state !== 'dead') return;
    const sh = Sprites.player;
    const fi = Sprites.frame(sh, this.anim, this.animT);
    let yB = this.y + this.h / 2 + 2;
    // gentle breathing bob on single-frame poses
    if (this.anim === 'idle' || this.anim === 'crouch') yB += Math.sin(this.animT * 2.6) * 1.4;
    if (this.state === 'dead') {
      g.save(); g.globalAlpha = Math.max(0, 1 - this.deadT / 1.4);
      Sprites.draw(g, sh, 'hurt', 0, this.x, yB, this.facing < 0);
      g.restore(); return;
    }
    if (this.state === 'grabbed') {
      // squeezed — squish pulse on her latched pose
      const sq = this.squishT > 0 ? Math.sin(this.squishT * 40) * 0.5 + 0.5 : 0;
      g.save();
      g.translate(Math.round(this.x), Math.round(yB));
      g.scale(1 + sq * 0.08, 1 - sq * 0.14);
      Sprites.draw(g, sh, 'grabbed', 0, 0, 0, this.facing < 0);
      g.restore();
      return;
    }
    if (this.state === 'downed') {
      // tumbling, then flat on her side
      const lying = this.downBounced >= 1;
      g.save();
      g.translate(Math.round(this.x), Math.round(yB));
      g.rotate(-this.facing * (lying ? 1.35 : 0.3 + this.downT * 0.8));
      Sprites.draw(g, sh, 'hurt', 0, 0, lying ? 12 : 0, this.facing < 0);
      g.restore();
      return;
    }
    Sprites.draw(g, sh, this.anim, fi, this.x, yB, this.facing < 0);
    // pistol in her extended hand while firing
    if (this.action === 'shoot' && Sprites.props)
      Sprites.draw(g, Sprites.props.gun, 'idle', 0, this.x + this.facing * 30, this.y - 4, this.facing < 0, 0.8);
    if (this.held && this.action !== 'throw') {
      const pr = Sprites.props[this.held === 'spear' ? 'spear' : this.held];
      if (pr) Sprites.draw(g, pr, 'idle', 0, this.x + this.facing * 4, this.y - this.h / 2 + 2, this.facing < 0);
    }
  }
}

// =================================================================
// ENEMIES
// =================================================================
const ENEMY_STATS = {
  crawler: { w: 30, h: 18, speed: 42, dmg: 1, fly: false, big: false },
  imp:     { w: 24, h: 26, speed: 62, dmg: 1, fly: false, big: false },
  spitter: { w: 26, h: 34, speed: 32, dmg: 1, fly: false, big: false },
  wisp:    { w: 24, h: 24, speed: 55, dmg: 1, fly: true,  big: false },
  brute:   { w: 56, h: 52, speed: 30, dmg: 2, fly: false, big: true },
  stalker: { w: 34, h: 66, speed: 46, dmg: 2, fly: false, big: true },
  // beach-scene creatures (drawn from the reference art)
  dog:     { w: 42, h: 34, speed: 66, dmg: 1, fly: false, big: false, scene: 'dog',     scale: 0.36, side: true },
  alien:   { w: 24, h: 46, speed: 34, dmg: 1, fly: false, big: false, scene: 'alien',   scale: 0.36 },
  octo:    { w: 52, h: 42, speed: 24, dmg: 2, fly: false, big: true,  scene: 'octo',    scale: 0.45 },
  pillbug: { w: 38, h: 26, speed: 32, dmg: 1, fly: false, big: false, scene: 'pillbug', scale: 0.36, side: true },
  crab:    { w: 42, h: 30, speed: 46, dmg: 1, fly: false, big: false, scene: 'crab',    scale: 0.38 },
  spiderW: { w: 34, h: 30, speed: 48, dmg: 1, fly: false, big: false, scene: 'spiderW', scale: 0.33, latcher: true },
  spiderC: { w: 34, h: 28, speed: 54, dmg: 1, fly: false, big: false, scene: 'spiderC', scale: 0.34, latcher: true }
};

class Enemy {
  constructor(spec) {
    const st = ENEMY_STATS[spec.type];
    this.type = spec.type; this.st = st;
    this.x = spec.x; this.y = spec.y - st.h / 2 - 1;
    this.w = st.w; this.h = st.h;
    this.vx = 0; this.vy = 0; this.dir = Math.random() < 0.5 ? -1 : 1;
    this.hp = spec.hp; this.maxHp = spec.hp;
    this.anim = 'walk'; this.animT = Math.random() * 2;
    this.flash = 0; this.attackT = 0; this.cd = 1 + Math.random() * 2;
    this.baseY = this.y; this.t = Math.random() * 6;
    this.dead = false; this.onGround = false; this.hitWall = false;
    this.charging = 0; this.windup = 0;
    this.stun = 0;
    // latcher (spider) fields
    this.leaping = false; this.latched = false;
    this.squeezes = 0; this.squeezeT = 0; this.squishT = 0; this.releaseT = 0;
  }

  hurt(n, fromX, game) {
    if (this.latched) return;          // can't be hit while wrapped around Kaya
    this.hp -= n; this.flash = 0.16;
    SFX.play('hit');
    game.spawnParticles(this.x, this.y, 6, '#d9ffb0');
    if (!this.st.big) { this.vx = (this.x < fromX ? -1 : 1) * -120; this.stun = 0.18; }
    game.popupDamage(this.x, this.y - this.h / 2 - 8, n);
    if (this.hp <= 0) {
      this.dead = true;
      game.enemyKilled(this);
    }
  }

  update(dt, game) {
    const lvl = game.level, p = game.player;
    this.t += dt; this.animT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.cd -= dt;
    const dx = p.x - this.x, dy = p.y - this.y;
    const near = Math.abs(dx) < 260 && Math.abs(dy) < 110;

    if (this.latched) {
      // ---- riding Kaya, squeezing her -----------------------------
      this.x = p.x + p.facing * 2;
      this.y = p.y - 8;
      this.vx = 0; this.vy = 0;
      this.squishT = Math.max(0, this.squishT - dt);
      this.squeezeT -= dt;
      if (this.squeezeT <= 0) {
        this.squeezes++;
        this.squishT = 0.25; p.squishT = 0.25;
        p.hp = Math.max(0, p.hp - 1);
        SFX.play('hurt');
        game.spawnParticles(p.x, p.y - 10, 8, '#e05a1e');
        game.shake = Math.max(game.shake, 4);
        if (p.hp <= 0) { this.detach(p, game); p.die(game); return; }
        if (this.squeezes >= 3) { this.detach(p, game); return; }
        this.squeezeT = 0.75;
      }
      return;
    }
    if (this.st.latcher) {
      this.releaseT = Math.max(0, this.releaseT - dt);
      if (this.leaping) {
        this.vy = Math.min(this.vy + 1900 * dt, 900);
        Phys.move(this, lvl, dt);
        // grab her mid-flight
        if (p.state !== 'dead' && p.state !== 'grabbed' && p.state !== 'downed' &&
            p.invuln <= 0 && U.aabb(this.x, this.y, this.w + 8, this.h + 8, p.x, p.y, p.w, p.h)) {
          if (p.grab(this, game)) {
            this.leaping = false; this.latched = true;
            this.squeezes = 0; this.squeezeT = 0.6;
            return;
          }
        }
        if (this.onGround) { this.leaping = false; this.cd = 1.4; }
        this.anim = 'attack';
        return;
      }
      if (this.windup > 0) {
        this.windup -= dt; this.vx = 0;
        if (this.windup <= 0) {
          this.leaping = true;
          this.vx = U.clamp(dx * 2.4, -330, 330);
          this.vy = -340;
          SFX.play('jump');
        }
      } else if (near && Math.abs(dy) < 80 && this.cd <= 0 && this.releaseT <= 0 &&
                 p.state !== 'dead' && p.state !== 'grabbed' && p.state !== 'downed' && p.invuln <= 0) {
        this.windup = 0.35; this.dir = Math.sign(dx) || 1;
        this.anim = 'attack'; this.animT = 0;
      } else {
        this.patrol(lvl, dt);
      }
      this.vy = Math.min(this.vy + 1900 * dt, 900);
      Phys.move(this, lvl, dt);
      return;
    }
    if (this.type === 'dog') {
      // feral chaser
      const chase = near && Math.abs(dy) < 70 && p.state !== 'dead';
      if (chase) { this.dir = Math.sign(dx) || 1; this.vx = this.dir * 120; this.anim = 'walk'; }
      else this.patrol(lvl, dt);
      this.vy = Math.min(this.vy + 1900 * dt, 900);
      Phys.move(this, lvl, dt);
      if (this.hitWall && this.onGround) this.dir *= -1;
      return;
    }
    if (this.type === 'alien') {
      // grey — lobs psychic spit from range
      if (near && p.state !== 'dead' && this.cd <= 0) {
        this.anim = 'attack'; this.animT = 0; this.cd = 2.6;
        this.attackT = 0.4; this.dir = Math.sign(dx) || 1;
      }
      if (this.attackT > 0) {
        this.attackT -= dt; this.vx = 0;
        if (this.attackT <= 0.2 && !this.spat) {
          game.addProj(new Projectile('spit', this.x + this.dir * 12, this.y - 12,
            this.dir * 220 + dx * 0.4, -190, false));
          this.spat = true;
        }
        if (this.attackT <= 0) { this.spat = false; this.anim = 'walk'; }
      } else this.patrol(lvl, dt);
      this.vy = Math.min(this.vy + 1900 * dt, 900);
      Phys.move(this, lvl, dt);
      return;
    }
    if (this.type === 'octo' || this.type === 'crab') {
      // heavy scuttler with a short lunge
      if (this.charging > 0) {
        this.charging -= dt;
        this.vx = this.dir * (this.type === 'octo' ? 150 : 190);
        this.anim = 'attack';
        if (this.hitWall || this.charging <= 0) { this.charging = 0; this.cd = 2.2; this.anim = 'walk'; }
      } else if (near && Math.abs(dy) < 50 && this.cd <= 0 && p.state !== 'dead') {
        this.dir = Math.sign(dx) || 1; this.charging = 0.55;
        this.anim = 'attack'; this.animT = 0;
      } else this.patrol(lvl, dt);
      this.vy = Math.min(this.vy + 1900 * dt, 900);
      Phys.move(this, lvl, dt);
      return;
    }
    if (this.type === 'pillbug') {
      this.patrol(lvl, dt);
      this.vy = Math.min(this.vy + 1900 * dt, 900);
      Phys.move(this, lvl, dt);
      if (this.hitWall && this.onGround) this.dir *= -1;
      return;
    }

    if (this.st.fly) {
      // wisp — hovers, drifts toward the player
      const targY = this.baseY + Math.sin(this.t * 2.2) * 14;
      if (Math.abs(dx) < 240 && Math.abs(dy) < 200 && p.state !== 'dead') {
        this.vx += Math.sign(dx) * 140 * dt;
        this.vy += Math.sign(p.y - 10 - this.y) * 90 * dt;
      } else {
        this.vx *= 0.98; this.vy += Math.sign(targY - this.y) * 60 * dt;
      }
      this.vx = U.clamp(this.vx, -this.st.speed, this.st.speed);
      this.vy = U.clamp(this.vy, -50, 50);
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (Math.abs(dx) > 4) this.dir = Math.sign(dx);
      this.anim = 'idle';
    } else if (this.stun > 0) {
      this.vy = Math.min(this.vy + 1900 * dt, 900);
      Phys.move(this, lvl, dt);
    } else if (this.type === 'spitter') {
      if (near && p.state !== 'dead' && this.cd <= 0) {
        this.anim = 'attack'; this.animT = 0; this.cd = 2.4 - game.level.d * 0.8;
        this.attackT = 0.4; this.dir = Math.sign(dx) || 1;
      }
      if (this.attackT > 0) {
        this.attackT -= dt; this.vx = 0;
        if (this.attackT <= 0.2 && !this.spat) {
          game.addProj(new Projectile('spit', this.x + this.dir * 14, this.y - 10,
            this.dir * 240 + dx * 0.4, -180, false));
          this.spat = true;
        }
        if (this.attackT <= 0) { this.spat = false; this.anim = 'walk'; }
      } else {
        this.patrol(lvl, dt);
      }
      this.vy = Math.min(this.vy + 1900 * dt, 900);
      Phys.move(this, lvl, dt);
    } else if (this.type === 'brute') {
      if (this.charging > 0) {
        this.charging -= dt;
        this.vx = this.dir * 250;
        this.anim = 'attack';
        if (this.hitWall || this.charging <= 0) { this.charging = 0; this.cd = 2 - game.level.d * 0.6; this.anim = 'walk'; }
      } else if (this.windup > 0) {
        this.windup -= dt; this.vx = 0;
        if (this.windup <= 0) { this.charging = 0.9; SFX.play('roar'); }
      } else if (near && Math.abs(dy) < 60 && this.cd <= 0 && p.state !== 'dead') {
        this.windup = 0.45; this.dir = Math.sign(dx) || 1; this.anim = 'attack'; this.animT = 0;
      } else {
        this.patrol(lvl, dt);
      }
      this.vy = Math.min(this.vy + 1900 * dt, 900);
      Phys.move(this, lvl, dt);
    } else if (this.type === 'stalker') {
      if (near && p.state !== 'dead') {
        this.dir = Math.sign(dx) || 1;
        this.vx = this.dir * (Math.abs(dx) > 50 ? 95 : 30);
        if (Math.abs(dx) < 70 && this.cd <= 0) {
          this.anim = 'attack'; this.animT = 0; this.cd = 1.6 - game.level.d * 0.5; this.attackT = 0.35;
        } else if (this.attackT <= 0) this.anim = 'walk';
      } else this.patrol(lvl, dt);
      if (this.attackT > 0) { this.attackT -= dt; this.vx = this.dir * 30; }
      this.vy = Math.min(this.vy + 1900 * dt, 900);
      Phys.move(this, lvl, dt);
    } else {
      // crawler / imp
      const chase = this.type === 'imp' && near && Math.abs(dy) < 80 && p.state !== 'dead';
      if (chase) { this.dir = Math.sign(dx) || 1; this.vx = this.dir * 128; this.anim = 'walk'; }
      else this.patrol(lvl, dt);
      this.vy = Math.min(this.vy + 1900 * dt, 900);
      Phys.move(this, lvl, dt);
      if (this.hitWall && this.onGround) this.dir *= -1;
    }
  }

  patrol(lvl, dt) {
    if (this.onGround && (!Phys.groundAhead(lvl, this, this.dir) || this.hitWall)) this.dir *= -1;
    this.vx = this.dir * this.st.speed;
    this.anim = 'walk';
  }

  // spider lets go: leaps back off her and drops Kaya
  detach(p, game) {
    this.latched = false;
    this.releaseT = 2.5; this.cd = 2.5;
    this.vx = -p.facing * 260; this.vy = -330;
    this.leaping = true;
    SFX.play('jump');
    game.spawnParticles(this.x, this.y, 6, '#d9b8ff');
    if (p.grabbedBy === this) p.release(game);
  }

  // extra reach for the big attackers
  attackBox() {
    if (this.type === 'stalker' && this.anim === 'attack' && this.attackT > 0 && this.attackT < 0.3)
      return { x: this.x + this.dir * 30, y: this.y - 10, w: 44, h: 40, dmg: 2 };
    return null;
  }

  draw(g, game) {
    if (this.st.scene && Sprites.scene1) {
      // beach-scene creature, animated with bob / tilt / squash
      const walking = Math.abs(this.vx) > 4 && this.onGround;
      const bobPh = this.t * 9;
      const rot = walking ? Math.sin(bobPh) * 0.07 : 0;
      const bob = walking ? Math.abs(Math.sin(bobPh)) * 2 : 0;
      let sy = this.st.scale;
      if (this.windup > 0) sy *= 0.85;                          // coiling to leap
      if (this.squishT > 0) sy *= 0.8 + Math.sin(this.squishT * 40) * 0.08;
      if (this.leaping) { /* stretched in flight */ sy *= 1.08; }
      const flip = this.st.side ? this.dir > 0 : this.dir < 0;  // side art faces left
      g.save();
      if (this.flash > 0) { g.filter = 'brightness(1.9)'; }
      Sprites.drawScene1(g, this.st.scene, this.x, this.y + this.h / 2 + 3 - bob,
        flip, this.st.scale, rot + (this.leaping ? -this.dir * 0.15 : 0), sy);
      g.restore();
    } else {
      const sh = Sprites.enemies[this.type];
      const anim = this.flash > 0 ? 'hurt' : this.anim;
      const fi = Sprites.frame(sh, anim, this.animT);
      g.save();
      const hue = game.level.themeIndex * 18;
      if (hue && !game.level.theme.desert) g.filter = 'hue-rotate(' + hue + 'deg)';
      Sprites.draw(g, sh, anim, fi, this.x, this.y + this.h / 2 + 3, this.dir < 0);
      g.restore();
    }
    // health bar — every enemy has one
    const bw = Math.max(30, this.w + 8);
    const bx = this.x - bw / 2, by = this.y - this.h / 2 - 12;
    g.fillStyle = 'rgba(10,10,16,0.7)'; g.fillRect(bx - 1, by - 1, bw + 2, 6);
    const q = this.hp / this.maxHp;
    g.fillStyle = q > 0.5 ? '#8aff5e' : (q > 0.25 ? '#ffd24b' : '#ff5e5e');
    g.fillRect(bx, by, bw * q, 4);
  }
}

// =================================================================
// BOSSES — one per level, mutated alien horrors (20-30 hits)
// =================================================================
class Boss {
  constructor(spec, level) {
    this.spec = spec; this.id = spec.id; this.key = spec.key; this.name = spec.name;
    this.hp = spec.hp; this.maxHp = spec.hp;
    this.d = level.d;
    const sizes = { sporefather: [86, 92], leviathan: [90, 84], tyrant: [96, 66], warlord: [46, 96], empress: [80, 70] };
    const s = sizes[spec.key];
    this.w = s[0]; this.h = s[1];
    this.x = spec.x; this.groundY = spec.groundY;
    this.y = this.groundY - this.h / 2;
    this.fly = spec.key === 'empress';
    this.baseY = this.fly ? this.groundY - 150 : this.y;
    if (this.fly) this.y = this.baseY;
    this.vx = 0; this.vy = 0; this.dir = -1;
    this.active = false; this.dead = false;
    this.anim = 'idle'; this.animT = 0; this.t = 0;
    this.state = 'move'; this.stateT = 0; this.cd = 2;
    this.flash = 0; this.minions = 0;
    this.onGround = false; this.hitWall = false;
  }

  hurt(n, fromX, game) {
    if (!this.active || this.dead) return;
    this.hp -= n; this.flash = 0.15;
    SFX.play('hit');
    game.popupDamage(this.x, this.y - this.h / 2 - 10, n);
    game.spawnParticles(this.x + (Math.random() - 0.5) * this.w, this.y, 8, this.flashColor());
    if (this.hp <= 0) { this.hp = 0; this.dead = true; game.bossKilled(this); }
  }

  flashColor() { return Sprites.bossDefs[this.id - 1].pal.glow; }

  update(dt, game) {
    if (!this.active || this.dead) return;
    const p = game.player, lvl = game.level, spec = this.spec;
    this.t += dt; this.animT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.cd -= dt; this.stateT -= dt;
    const rage = 1 + (1 - this.hp / this.maxHp) * (0.6 + this.d * 0.5); // faster as it bleeds
    const dx = p.x - this.x;
    if (this.state !== 'charge') this.dir = Math.sign(dx) || this.dir;

    switch (this.key) {
      case 'sporefather': {
        if (this.state === 'move') {
          this.vx = this.dir * 38 * rage; this.anim = 'walk';
          if (this.cd <= 0) {
            if (Math.abs(dx) < 120) { this.state = 'slam'; this.stateT = 0.55; this.anim = 'attack'; this.animT = 0; this.vx = 0; }
            else { this.state = 'lob'; this.stateT = 0.5; this.anim = 'attack'; this.animT = 0; this.vx = 0; }
          }
        } else if (this.state === 'slam') {
          if (this.stateT <= 0) {
            SFX.play('boom'); game.shake = 10;
            game.addProj(new Projectile('wave', this.x - 40, this.groundY - 12, -260, 0, false));
            game.addProj(new Projectile('wave', this.x + 40, this.groundY - 12, 260, 0, false));
            this.state = 'move'; this.cd = 2.4 / rage;
          }
        } else if (this.state === 'lob') {
          if (this.stateT <= 0) {
            for (let k = 0; k < 3; k++)
              game.addProj(new Projectile('spore', this.x + this.dir * 20, this.y - 40,
                this.dir * (120 + k * 90) + (Math.random() * 40 - 20), -320 - k * 30, false));
            SFX.play('throw');
            this.state = 'move'; this.cd = 2.6 / rage;
          }
        }
        this.vy = Math.min(this.vy + 1900 * dt, 900);
        Phys.move(this, lvl, dt);
        break;
      }
      case 'leviathan': {
        if (this.state === 'move') {
          this.vx = this.dir * 46 * rage; this.anim = 'walk';
          if (this.cd <= 0) {
            const r = Math.random();
            if (r < 0.4) { this.state = 'dive'; this.stateT = 1.0; this.anim = 'hurt'; }
            else { this.state = 'spit'; this.stateT = 0.5; this.anim = 'attack'; this.animT = 0; this.vx = 0; }
          }
        } else if (this.state === 'dive') {
          this.vx = 0;
          if (this.stateT <= 0) {   // resurface beside the player
            this.x = U.clamp(p.x - this.dir * 120, spec.arenaL + 60, spec.arenaR - 60);
            game.spawnParticles(this.x, this.groundY - 20, 16, '#8affd8');
            SFX.play('splash');
            this.state = 'sweep'; this.stateT = 0.8; this.anim = 'attack'; this.animT = 0;
          }
        } else if (this.state === 'sweep') {
          this.vx = this.dir * 300 * rage;
          if (this.stateT <= 0 || this.hitWall) { this.state = 'move'; this.cd = 2.2 / rage; }
        } else if (this.state === 'spit') {
          if (this.stateT <= 0) {
            for (let k = -1; k <= 1; k++)
              game.addProj(new Projectile('spit', this.x + this.dir * 30, this.y - 50,
                this.dir * 260 + k * 70, -220 + k * 40, false));
            this.state = 'move'; this.cd = 2.2 / rage;
          }
        }
        this.vy = Math.min(this.vy + 1900 * dt, 900);
        Phys.move(this, lvl, dt);
        break;
      }
      case 'tyrant': {
        if (this.state === 'move') {
          this.vx = this.dir * 42 * rage; this.anim = 'walk';
          if (this.cd <= 0) {
            if (Math.random() < 0.6) { this.state = 'windup'; this.stateT = 0.5; this.anim = 'attack'; this.animT = 0; this.vx = 0; SFX.play('roar'); }
            else { this.state = 'nova'; this.stateT = 0.45; this.anim = 'attack'; this.animT = 0; this.vx = 0; }
          }
        } else if (this.state === 'windup') {
          if (this.stateT <= 0) { this.state = 'charge'; this.stateT = 1.4; }
        } else if (this.state === 'charge') {
          this.vx = this.dir * (330 + this.d * 120) * Math.min(1.2, rage);
          this.anim = 'attack';
          if (this.hitWall) { game.shake = 8; SFX.play('boom'); this.state = 'move'; this.cd = 1.8 / rage; }
          else if (this.stateT <= 0) { this.state = 'move'; this.cd = 1.8 / rage; }
        } else if (this.state === 'nova') {
          if (this.stateT <= 0) {
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * Math.PI * 2;
              game.addProj(new Projectile('shard', this.x, this.y - 30, Math.cos(a) * 260, Math.sin(a) * 260 - 80, false));
            }
            SFX.play('boom');
            this.state = 'move'; this.cd = 2.6 / rage;
          }
        }
        this.vy = Math.min(this.vy + 1900 * dt, 900);
        Phys.move(this, lvl, dt);
        break;
      }
      case 'warlord': {
        if (this.state === 'move') {
          this.vx = this.dir * 30; this.anim = 'walk';
          if (this.cd <= 0) {
            const r = Math.random();
            if (r < 0.45) { this.state = 'blink'; this.stateT = 0.35; this.vx = 0; }
            else if (r < 0.85 || this.minions >= 3) { this.state = 'volley'; this.stateT = 0.5; this.shots = 3; this.anim = 'attack'; this.animT = 0; this.vx = 0; }
            else { this.state = 'summon'; this.stateT = 0.6; this.anim = 'attack'; this.animT = 0; this.vx = 0; }
          }
        } else if (this.state === 'blink') {
          if (this.stateT <= 0) {
            game.spawnParticles(this.x, this.y, 14, '#4bffdf');
            this.x = U.clamp(p.x + (Math.random() < 0.5 ? -1 : 1) * (140 + Math.random() * 80), spec.arenaL + 50, spec.arenaR - 50);
            game.spawnParticles(this.x, this.y, 14, '#4bffdf');
            SFX.play('portal');
            this.state = 'volley'; this.stateT = 0.4; this.shots = 3; this.anim = 'attack'; this.animT = 0;
          }
        } else if (this.state === 'volley') {
          if (this.stateT <= 0 && this.shots > 0) {
            const ang = Math.atan2((p.y - 10) - (this.y - 44), p.x - this.x);
            game.addProj(new Projectile('elaser', this.x + Math.cos(ang) * 30, this.y - 44 + Math.sin(ang) * 30,
              Math.cos(ang) * (380 + this.d * 140), Math.sin(ang) * (380 + this.d * 140), false));
            SFX.play('laser');
            this.shots--; this.stateT = 0.32 / rage;
            if (this.shots <= 0) { this.state = 'move'; this.cd = 2.0 / rage; }
          }
        } else if (this.state === 'summon') {
          if (this.stateT <= 0) {
            for (let k = 0; k < 2 && this.minions < 3; k++) {
              game.enemies.push(new Enemy({ type: 'wisp', x: this.x + (k ? 60 : -60), y: this.y - 60, hp: 3 }));
              game.enemies[game.enemies.length - 1].summoned = this;
              this.minions++;
            }
            SFX.play('portal');
            this.state = 'move'; this.cd = 3.2 / rage;
          }
        }
        this.vy = Math.min(this.vy + 1900 * dt, 900);
        Phys.move(this, lvl, dt);
        break;
      }
      case 'empress': {
        // airborne queen
        const hoverY = this.groundY - 150 + Math.sin(this.t * 1.6) * 26;
        if (this.state === 'move') {
          this.anim = 'idle';
          this.vx = U.clamp(dx, -1, 1) * 70 * rage;
          this.y += (hoverY - this.y) * Math.min(1, dt * 2);
          if (this.cd <= 0) {
            const r = Math.random();
            if (r < 0.4) { this.state = 'rain'; this.stateT = 0.5; this.shots = 4 + Math.round(this.d * 3); this.anim = 'attack'; this.animT = 0; }
            else if (r < 0.75) { this.state = 'swoop'; this.stateT = 0.9; this.anim = 'attack'; this.animT = 0; this.swx = Math.sign(dx) * 300; }
            else { this.state = 'summon'; this.stateT = 0.6; this.anim = 'attack'; this.animT = 0; }
          }
        } else if (this.state === 'rain') {
          this.vx = 0;
          if (this.stateT <= 0 && this.shots > 0) {
            const ax = p.x + (Math.random() * 240 - 120);
            game.addProj(new Projectile('acid', ax, this.y - 20, 0, 120, false));
            this.shots--; this.stateT = 0.22;
            if (this.shots <= 0) { this.state = 'move'; this.cd = 2.4 / rage; }
          }
        } else if (this.state === 'swoop') {
          this.vx = this.swx * rage;
          this.y += ((this.groundY - 46) - this.y) * Math.min(1, dt * 3.2);
          if (this.stateT <= 0) { this.state = 'rise'; this.stateT = 0.8; }
        } else if (this.state === 'rise') {
          this.vx *= 0.95;
          this.y += (hoverY - this.y) * Math.min(1, dt * 3);
          if (this.stateT <= 0) { this.state = 'move'; this.cd = 1.8 / rage; }
        } else if (this.state === 'summon') {
          if (this.stateT <= 0) {
            for (let k = 0; k < 2 && this.minions < 4; k++) {
              game.enemies.push(new Enemy({ type: 'crawler', x: this.x + (k ? 50 : -50), y: this.groundY - 4, hp: 3 }));
              game.enemies[game.enemies.length - 1].summoned = this;
              this.minions++;
            }
            SFX.play('roar');
            this.state = 'move'; this.cd = 3.0 / rage;
          }
        }
        this.x = U.clamp(this.x + this.vx * dt, spec.arenaL + 50, spec.arenaR - 50);
        break;
      }
    }
    // keep inside the arena
    this.x = U.clamp(this.x, spec.arenaL + this.w / 2, spec.arenaR - this.w / 2);
  }

  contactDamage() { return 2; }

  draw(g) {
    const sh = Sprites.boss(this.id);
    const anim = this.flash > 0 ? 'hurt' : this.anim;
    const fi = Sprites.frame(sh, anim, this.animT);
    const scale = 1 + this.d * 0.25;
    Sprites.draw(g, sh, anim, fi, this.x, this.y + this.h / 2 + 4, this.dir < 0, scale);
  }
}

// =================================================================
// PROJECTILES
// =================================================================
const PROJ_DEFS = {
  rock:   { r: 8,  grav: 1300, dmg: 2, life: 2.5 },
  skull:  { r: 8,  grav: 1300, dmg: 2, life: 2.5 },
  spear:  { r: 7,  grav: 500,  dmg: 3, life: 2.5 },
  laser:  { r: 5,  grav: 0,    dmg: 1, life: 0.9 },
  elaser: { r: 5,  grav: 0,    dmg: 2, life: 2.2 },
  spit:   { r: 6,  grav: 900,  dmg: 1, life: 3 },
  spore:  { r: 8,  grav: 800,  dmg: 2, life: 4 },
  shard:  { r: 6,  grav: 500,  dmg: 2, life: 2.4 },
  acid:   { r: 6,  grav: 700,  dmg: 2, life: 3 },
  wave:   { r: 14, grav: 0,    dmg: 2, life: 1.6 }
};

class Projectile {
  constructor(kind, x, y, vx, vy, friendly) {
    const def = PROJ_DEFS[kind];
    this.kind = kind; this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.friendly = friendly; this.r = def.r; this.dmg = def.dmg;
    this.grav = def.grav; this.life = def.life;
    this.dead = false; this.rot = 0; this.t = 0;
  }
  update(dt, game) {
    const lvl = game.level;
    this.t += dt; this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.vy += this.grav * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.rot += dt * 9 * Math.sign(this.vx || 1);
    if (this.kind === 'wave') {
      // shockwave hugs the ground
      const ty = Math.floor((this.y + 16) / TILE);
      const tx = Math.floor(this.x / TILE);
      if (Phys.tileAt(lvl, tx, ty) !== T_SOLID) this.y += 60 * dt;
      else this.y = ty * TILE - 12;
      if (Math.random() < dt * 30) game.spawnParticles(this.x, this.y + 6, 1, '#d8ff7a');
      if (Phys.rectHitsSolid(lvl, this.x + Math.sign(this.vx) * 10, this.y - 6, 8, 8)) this.dead = true;
      return;
    }
    if (Phys.rectHitsSolid(lvl, this.x, this.y, this.r * 2, this.r * 2)) {
      this.dead = true;
      game.spawnParticles(this.x, this.y, 5, this.friendly ? '#cfd4dc' : '#c5ff5e');
    }
  }
  draw(g) {
    g.save(); g.translate(this.x, this.y);
    switch (this.kind) {
      case 'laser': case 'elaser': {
        const col = this.kind === 'laser' ? '#4bffdf' : '#ff5e8a';
        const ang = Math.atan2(this.vy, this.vx); g.rotate(ang);
        g.shadowColor = col; g.shadowBlur = 8;
        g.fillStyle = col; g.fillRect(-10, -2.5, 20, 5);
        g.fillStyle = '#ffffff'; g.fillRect(-6, -1, 12, 2);
        break;
      }
      case 'rock': g.rotate(this.rot); Sprites.draw(g, Sprites.props.rock, 'idle', 0, 0, 12, false); break;
      case 'skull': g.rotate(this.rot); Sprites.draw(g, Sprites.props.skull, 'idle', 0, 0, 12, false); break;
      case 'spear': g.rotate(Math.atan2(this.vy, this.vx)); Sprites.draw(g, Sprites.props.spear, 'idle', 0, 0, 6, false); break;
      case 'spit': {
        g.fillStyle = '#8fdc5e'; g.beginPath(); g.ellipse(0, 0, 6, 5, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#d0ffa0'; g.beginPath(); g.arc(-1.5, -1.5, 2, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'spore': {
        g.shadowColor = '#d8ff7a'; g.shadowBlur = 10;
        g.fillStyle = '#a44a3f'; g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#d8ff7a'; g.beginPath(); g.arc(-2, -2, 3, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'shard': {
        g.rotate(Math.atan2(this.vy, this.vx));
        g.fillStyle = '#c9a2ff'; g.beginPath();
        g.moveTo(8, 0); g.lineTo(-6, -4); g.lineTo(-6, 4); g.closePath(); g.fill();
        break;
      }
      case 'acid': {
        g.fillStyle = '#ffd24b'; g.beginPath(); g.ellipse(0, 0, 5, 7, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff0b0'; g.beginPath(); g.arc(-1, -2, 2, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'wave': {
        g.fillStyle = 'rgba(216,255,122,0.8)';
        g.beginPath();
        g.moveTo(-14, 8); g.quadraticCurveTo(0, -18, 14, 8); g.closePath(); g.fill();
        break;
      }
    }
    g.restore();
  }
}

// =================================================================
// ORBS & PICKUPS
// =================================================================
class Orb {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = (Math.random() - 0.5) * 200; this.vy = -220 - Math.random() * 120;
    this.t = Math.random() * 3; this.dead = false; this.grounded = false;
  }
  update(dt, game) {
    this.t += dt;
    const p = game.player;
    const d = U.dist(this.x, this.y, p.x, p.y);
    if (d < 110 && p.state !== 'dead') {           // magnet to the player
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      this.vx += Math.cos(a) * 1400 * dt; this.vy += Math.sin(a) * 1400 * dt;
    } else {
      this.vy += 700 * dt;
      if (Phys.rectHitsSolid(game.level, this.x, this.y + 6, 8, 8)) { this.vy = Math.min(this.vy, 0); this.vx *= 0.9; }
    }
    this.vx = U.clamp(this.vx, -420, 420); this.vy = U.clamp(this.vy, -520, 520);
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (d < 22) {
      this.dead = true;
      if (p.hp < p.maxHp) p.heal(1); else game.score += 25;
      game.orbsCollected++;
      SFX.play('orb');
      game.spawnParticles(this.x, this.y, 6, '#d9b8ff');
    }
  }
  draw(g) {
    const fi = Sprites.frame(Sprites.props.orb, 'idle', this.t);
    Sprites.draw(g, Sprites.props.orb, 'idle', fi, this.x, this.y + 12, false);
  }
}

class Pickup {
  constructor(kind, x, y) {
    this.kind = kind; this.x = x; this.y = y; this.t = Math.random() * 4;
    this.dead = false;
    this.throwable = (kind === 'rock' || kind === 'skull' || kind === 'spear');
  }
  update(dt, game) {
    this.t += dt;
    const p = game.player;
    if (this.throwable) return;                    // picked up by stooping
    if (U.aabb(this.x, this.y, 26, 26, p.x, p.y, p.w, p.h) && p.state !== 'dead') {
      this.dead = true;
      if (this.kind === 'ammo') { p.ammo = Math.min(99, p.ammo + 8); SFX.play('pickup'); }
      else if (this.kind === 'gun') { p.hasGun = true; p.ammo = Math.min(99, p.ammo + 12); SFX.play('portal'); }
      else if (this.kind === 'gem') { game.score += 100; game.gems++; SFX.play('orb'); }
    }
  }
  draw(g) {
    const bob = Math.sin(this.t * 3) * 3;
    const map = { rock: 'rock', skull: 'skull', spear: 'spear', ammo: 'ammo', gun: 'gun', gem: 'gem' };
    const sh = Sprites.props[map[this.kind]];
    const fi = Sprites.frame(sh, 'idle', this.t);
    const yOff = this.throwable ? 0 : bob;
    Sprites.draw(g, sh, 'idle', fi, this.x, this.y + 12 + yOff, false);
    if (!this.throwable) {
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.beginPath(); g.ellipse(this.x, this.y + 14, 10, 3, 0, 0, Math.PI * 2); g.fill();
    }
  }
}

// moving platform
class Mover {
  constructor(spec) {
    this.x0 = spec.x; this.y0 = spec.y;
    this.x = spec.x; this.y = spec.y;
    this.len = spec.len; this.w = spec.len * TILE; this.h = 12;
    this.axis = spec.axis; this.range = spec.range; this.speed = spec.speed;
    this.t = Math.random() * 6; this.px = this.x; this.py = this.y;
  }
  update(dt) {
    this.t += dt;
    this.px = this.x; this.py = this.y;
    const q = (Math.sin(this.t * this.speed / (this.range / 2 + 1)) * 0.5 + 0.5) * this.range;
    if (this.axis === 'x') this.x = this.x0 + q; else this.y = this.y0 + q;
  }
  draw(g, theme) {
    g.fillStyle = theme.rock;
    g.beginPath();
    g.moveTo(this.x, this.y + 4);
    g.quadraticCurveTo(this.x + this.w / 2, this.y - 4, this.x + this.w, this.y + 4);
    g.lineTo(this.x + this.w - 4, this.y + 12);
    g.quadraticCurveTo(this.x + this.w / 2, this.y + 18, this.x + 4, this.y + 12);
    g.closePath(); g.fill();
    g.fillStyle = theme.moss;
    g.beginPath();
    g.moveTo(this.x, this.y + 4);
    g.quadraticCurveTo(this.x + this.w / 2, this.y - 5, this.x + this.w, this.y + 4);
    g.lineTo(this.x + this.w, this.y + 7); g.lineTo(this.x, this.y + 7);
    g.closePath(); g.fill();
    // faint rune glow underneath — these ledges float by magic
    g.fillStyle = 'rgba(150,120,255,0.25)';
    g.beginPath(); g.ellipse(this.x + this.w / 2, this.y + 16, this.w / 3, 4, 0, 0, Math.PI * 2); g.fill();
  }
}
