'use strict';
// ---------------------------------------------------------------
// sfx.js — tiny WebAudio synth effects (no external assets)
// ---------------------------------------------------------------
const SFX = {
  ctx: null,
  on: true,

  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { this.on = false; }
  },

  tone(freq, dur, type, vol, slide, delay) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.08, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },

  noise(dur, vol, freq) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 900;
    const g = c.createGain(); g.gain.value = vol || 0.12;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t0);
  },

  play(name) {
    if (!this.on || !this.ctx) return;
    switch (name) {
      case 'jump':   this.tone(300, 0.18, 'square', 0.05, 260); break;
      case 'kick':   this.noise(0.08, 0.1, 1400); this.tone(160, 0.08, 'square', 0.05, -60); break;
      case 'slide':  this.noise(0.18, 0.06, 700); break;
      case 'throw':  this.tone(500, 0.12, 'triangle', 0.05, -240); break;
      case 'laser':  this.tone(950, 0.14, 'sawtooth', 0.05, -700); break;
      case 'hit':    this.noise(0.06, 0.1, 1800); this.tone(220, 0.08, 'square', 0.04, -100); break;
      case 'hurt':   this.tone(180, 0.25, 'sawtooth', 0.08, -120); break;
      case 'orb':    this.tone(660, 0.1, 'sine', 0.06, 200); this.tone(990, 0.12, 'sine', 0.05, 200, 0.06); break;
      case 'pickup': this.tone(440, 0.09, 'triangle', 0.06, 120); break;
      case 'splash': this.noise(0.3, 0.09, 500); break;
      case 'boom':   this.noise(0.4, 0.16, 300); this.tone(90, 0.35, 'sine', 0.1, -50); break;
      case 'roar':   this.tone(90, 0.6, 'sawtooth', 0.1, 60); this.noise(0.5, 0.08, 400); break;
      case 'portal': this.tone(330, 0.5, 'sine', 0.06, 500); this.tone(495, 0.5, 'sine', 0.05, 500, 0.12); break;
      case 'select': this.tone(520, 0.07, 'square', 0.05, 80); break;
      case 'die':    this.tone(240, 0.6, 'sawtooth', 0.09, -200); break;
      case 'checkpoint': this.tone(392, 0.12, 'sine', 0.06, 0); this.tone(523, 0.16, 'sine', 0.06, 0, 0.1); break;
    }
  }
};
