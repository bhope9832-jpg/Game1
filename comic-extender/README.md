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

## Two engines

- **Free (default)** — [Pollinations](https://pollinations.ai), a keyless free
  image service. Works immediately with no account and no key. It cannot see
  your reference image, so the app shows a "describe the art style" box and
  bakes your words into the prompt — style matching is approximate, not exact.
- **Google Nano Banana** — the Gemini image models. Far better at exactly
  matching your reference page's style (it actually looks at the image), but
  Google requires an API key from a billed project (details below).

## AI access — how it works (please read)

The app talks straight to the **Gemini API** with a key you paste once. The
honest state of "free" (verified empirically, mid-2026): Google gives API keys
**zero free image-generation quota** — every image model answers
`429 RESOURCE_EXHAUSTED, limit: 0` until the key's Google Cloud project has
billing attached. Text models are free; image models are not. What that means
in practice:

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and
   click **Create API key**.
2. Attach billing to the key's project (AI Studio shows a **Set up billing**
   link). New Google Cloud accounts include **$300 of free trial credit**, and
   a generated comic page costs a few cents — so the trial credit is
   effectively thousands of pages at no out-of-pocket cost.
3. Paste the key into the app's ⚙️ *Setup* section (top of the page), once.

No billing at all? You can still generate pages **by hand for free** in the
[Google AI Studio](https://aistudio.google.com/) web app: pick an image model,
attach your reference page, and use the same prompt the app builds (see
`buildPrompt()` in `index.html`).

The key is stored **only in your browser's localStorage** and sent **only to
Google's API endpoint** — this app has no server and never sees it. If a
selected model 429s, the app automatically retries with the cheaper
`gemini-3.1-flash-image` and shows an accurate explanation (billing missing vs.
genuine rate limit).

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
