# EMBERWILD — Kaya and the Hive Moon

A mystical side-scrolling action platformer in a fluid 32-bit style.
Pure HTML5 canvas + vanilla JS — no build step, no external assets.
Every sprite sheet, level, and background is generated procedurally at boot.

**Play:** open `index.html` in a browser (or serve the folder with any static server).
**Inspect the art:** open `sprites.html` to view every generated character sprite sheet.

## The game

Kaya, a barefoot huntress of the Emberwild, chases the alien Hive Moon's
mutant spawn across **20 levels** in **5 worlds** (Emberwood, Sunken Fen,
Crystal Deep, Ruined Spire, Hive Core). Levels grow longer and meaner as you
go: wider gaps, spike gauntlets, moving platforms, denser and tougher enemies.

- **Moves:** walk, run, jump, **slide**, **kick**, crouch, **climb vines**, **swim**
- **Special attacks:** stoop (↓) to **pick up rocks / skulls / spears** and throw them;
  find the one-handed **alien laser pistol** and ammo cells in every level
- **Every enemy has a health bar.** Small enemies take 3–5 hits, large mutants 10–20
- Enemies drop **purple orbs** that restore Kaya's health
- Each level ends with a **mutated alien boss** (20–30 hits): the Sporefather,
  Fen Leviathan, Crystal Tyrant, Void Warlord and the Hive Empress — each with
  its own attack patterns that rage harder as it bleeds
- Checkpoint totems, gems, a per-level timer with best times, and level-select
  progress saved in the browser

## Controls

| Key | Action |
|---|---|
| ← → / A D | move |
| Shift (hold) | run |
| Space / Z | jump (tap for a short hop) |
| ↓ / S | slide (while running) · stoop & pick up · crouch · drop through ledges |
| X / J | kick |
| C / K | throw held object |
| V / L | fire laser pistol |
| ↑ ↓ | climb vines · swim up/down |
| P / Esc | pause |

## Code layout

| File | Purpose |
|---|---|
| `js/util.js` | math helpers, seeded RNG |
| `js/sfx.js` | WebAudio synth sound effects |
| `js/sprites.js` | procedural sprite-sheet generation (player, 6 enemies, 5 bosses, props, tiles) |
| `js/levels.js` | 5 world themes + seeded generator for all 20 levels |
| `js/entities.js` | physics, player state machine, enemy AI, boss fights, projectiles |
| `js/game.js` | engine loop, camera, parallax rendering, HUD, menus, saves |
| `sprites.html` | sprite-sheet viewer |
