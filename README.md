# 🦴 RigStudio 3D

Rig and animate 3D characters **right on your phone**. Built for touch: drag-and-drop bones that
snap and auto-connect, automatic skinning, face rigs with expressions, jiggle physics, and a
keyframe animation timeline — all in the browser, no install needed.

## Features

- **Human & animal characters** — one tap creates a sample human or quadruped, fully rigged
  and ready to pose. Or import your own `.glb` / `.gltf` model and rig it.
- **Drag & drop bones with magnetic snapping** — new bones auto-connect to the closest joint;
  drag a loose bone near a skeleton and it snaps into the chain.
- **Auto skinning** — one tap on 🧲 *Bind Skin* attaches the mesh to your skeleton
  (nearest-bone weighting, 4 influences per vertex).
- **Face rigging** — jaw, eyes, brows, mouth corners, lips and cheeks, plus one-tap
  expression presets (Smile, Sad, Angry, Surprised, Jaw Open, Wink).
- **Physics** — spring-bone dynamics for tails, ears, hair and other secondary motion.
  Toggle ⚡ per bone; tune gravity / stiffness / damping in the menu.
- **Full control** — every bone can be selected, renamed, rotated (drag or precise sliders),
  translated, deleted, or given physics. Bone list drawer shows the whole hierarchy.
- **Animation** — keyframe timeline with scrubbing, looping playback, and adjustable length.
  Pose → press ◆ → move the playhead → pose again → ▶.
- **Projects** — autosaves locally; save/load project files to share rigs and animations.

## Run it

It's a static site — any web server works:

```bash
# from the repo root
npx serve .        # or: python3 -m http.server 8080
```

Then open the printed URL. On your phone, open the same URL on your local network,
or deploy with GitHub Pages (a workflow is included — merge to `main`, then check the
repo's **Actions** tab; the site publishes to `https://<user>.github.io/<repo>/`).

> Everything is vendored under `lib/` (Three.js), so the app works fully offline once loaded.

## Quick guide

| Mode | What you do |
|------|-------------|
| **Build** | Shape the skeleton. ✥ drag joints, ➕ tap to add bones (they snap to the nearest joint), ✂️ delete. Finish with 🧲 **Bind Skin**. |
| **Pose** | Drag a joint to rotate its bone; ✥ to move it. 🙂 opens expressions, ⚡ toggles physics, ↺ resets the pose. |
| **Animate** | Pose the character, press **◆** to keyframe, scrub the timeline, pose again, then **▶** to play. |

Camera: 1 finger orbits, 2 fingers pan/zoom. Tap 🦴 for the bone hierarchy, ☰ for
characters, import, physics settings and project save/load.

## Tech

Vanilla JS + [Three.js](https://threejs.org). No build step, no dependencies to install.
Skinning uses distance-to-bone-segment weights; physics is verlet spring-bone integration;
animation is slerp-interpolated quaternion + position tracks.
