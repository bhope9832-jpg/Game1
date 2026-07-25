# 🍔 Drive-Thru Dash

A **32-bit style drive-thru burger arcade** for your phone. Cars roll past the window,
each flashing a quick order bubble — build the burger, then **swipe up** to toss the bag
through the open car window before they drive off hungry.

All the pixel art, chiptune music, and 8-bit sound effects are generated in code —
no assets, no dependencies, works fully offline.

## How to play

| Action | Touch | Keyboard |
|--------|-------|----------|
| Add ingredient | Tap a button (bun, patty, cheese, lettuce, top bun) | `1`–`5` |
| Serve | **Swipe up** from the prep station (swipe angle steers the throw!) | `Space` / `↑` |
| Scrap a bad build | Tap **SCRAP** | `X` / `Backspace` |

- **Match the bubble.** Each car shows its order as a mini burger — tap ingredients in
  the same bottom-to-top sequence.
- **Time the toss.** The bag flies from the serving window; it has to pass through the
  car's open side window. Dead-center hits score a **PERFECT** bonus.
- **Watch the traffic.** Slow minivans, sedans, pickups, and zooming sports cars all
  roll left to right — later on you'll juggle up to three orders at once.
- **Don't break the chain.** Missing the window, tossing the wrong burger, or letting a
  car leave hungry breaks your combo *and* costs a life. Three strikes and it's closing time.
- **Combo meter.** Consecutive deliveries raise your score multiplier — and the chiptune
  soundtrack literally speeds up as your combo builds.

## Progression

High scores pay out **coins**, spent in the shop on:

- 👕 **Outfits** — new looks for the chef (Cherry Crew, Chef Whites, Midnight)
- 🏪 **Window styles** — restyle the drive-thru (Neon Nights, Mint Retro, Gold Deluxe)
- 🎵 **Music tracks** — unlockable 32-bit soundtracks (Turbo Boulevard, Moonlit Cruise)

Coins, unlocks, and your best score are saved locally.

## Run it

It's a static site — any web server works:

```bash
# from the repo root
npx serve .        # or: python3 -m http.server 8080
```

Open the printed URL — on a phone, use the same URL over your local network, or deploy
with GitHub Pages (a workflow is included: merge to `main` and the site publishes to
`https://<user>.github.io/<repo>/`). Add it to your home screen for fullscreen play.
