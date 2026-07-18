# 💥 Comic Page Extender

Upload comic pages or panels and let AI draw the **next page** — a classic 6-panel
layout in the exact same art style, colors, shading, character designs and tone.

A minimal static web app (all logic in `index.html`, plus a small service worker,
manifest and icon for offline/PWA support — zero dependencies, no build step)
with a dark, mobile-friendly UI made for comic creators.

## Features

- **Upload anything** — full pages, single panels, sketches, illustrations
  (click, drag & drop, or paste from clipboard; multiple images supported).
- **"Extend Comic"** — generates the next page as a 6-panel comic page matching
  the reference style, powered by Google's **Nano Banana Pro**
  (`gemini-3-pro-image-preview`) or **Nano Banana** (`gemini-2.5-flash-image`).
- **Story box** — describe what should happen next, or leave it empty and let
  the AI continue the story.
- **Side-by-side view** of your reference and the generated page.
- **Download as PNG**, one tap.
- **Chain pages** — turn a generated page into the new reference and keep going,
  page after page.
- **History gallery** stored in your browser's localStorage (survives closing the
  tab; compressed copies so it never blows the storage quota).
- **Responsive & touch-friendly** — works great on phones.
- **Installable PWA with real offline support** — when served over http(s), a
  service worker caches the app shell so it opens with no internet, and you can
  "Add to Home Screen" on mobile. Only generation itself needs a connection.

## Run it locally

It's a static file — any of these works:

```bash
# Option A: just open it
open comic-extender/index.html        # macOS
xdg-open comic-extender/index.html    # Linux
# (or double-click the file)

# Option B: any static server
cd comic-extender
python3 -m http.server 8000           # then visit http://localhost:8000
# or: npx serve .
```

You can also host it anywhere static files go (GitHub Pages, Netlify, etc.).

## Free AI access — how it works (please read)

The app uses the **Gemini API free tier**. One honest clarification: there is no
way for any web app to call Nano Banana Pro with literally *no* key — Google
requires one on every request. What *is* free:

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   (a normal free Google account is enough — **no credit card, no payment**).
2. Click **Create API key** and copy it.
3. Paste it into the app's ⚙️ *Setup* section (top of the page), once.

The key is stored **only in your browser's localStorage** and sent **only to
Google's API endpoint** — this app has no server and never sees it. Model quota reality check: **Nano Banana** (`gemini-2.5-flash-image`) has a real
free quota and is the app's default. **Nano Banana Pro**
(`gemini-3-pro-image-preview`) has no free API quota — Google returns a 429
"rate limit" instantly even with zero usage unless your key belongs to a billed
Google Cloud project. If you pick Pro without billing, the app detects that 429
and automatically retries with Nano Banana.

> ⚠️ Because the key lives in the browser, this setup is for **personal use**.
> If you publish the app for other people, each visitor should paste their own
> key (which is exactly how the app works) — never hard-code your key into the
> file and publish it.

## Modifying it

Everything lives in `index.html`, organized in commented sections:

| Section | What to tweak |
|---|---|
| CSS `:root` variables | Theme colors |
| `buildPrompt()` | The style-matching instructions sent to the model (change panel count, layout, etc.) |
| `modelSel` options | Model IDs, if Google releases new ones |
| `MAX_UPLOAD_EDGE` / `HISTORY_THUMB_W` | Upload downscaling / history compression |
| `generationConfig.imageConfig.aspectRatio` | Page shape (default `2:3` portrait) |
