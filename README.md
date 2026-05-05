# Treasure Crew Co-op v0.4

A mobile-first cooperative cockpit web game prototype with a new **asset pipeline and cosmetic unlock system**.

Two players join the same room code, choose Captain or Engineer seats, complete asymmetric cockpit minigames, unlock owner’s manual pages, launch treasure hunts, and now unlock/equip alternate steering wheels and player seats.

## New in v0.4

- Added an **Asset Locker** inside the player touchscreen panel.
- Added a 3D model intake folder structure for:
  - player models
  - pirates
  - boats
  - islands
  - environments
  - steering wheels
  - player seats
- Added `public/assets/asset-manifest.json` for mapping real GLB/GLTF and GUI assets into the game.
- Added unlockable steering wheels:
  - Classic Toy Wheel
  - Royal Brass Wheel
  - Pirate Bone Wheel
- Added unlockable player seats:
  - Navy Captain Chair
  - Cloud Cream Chair
  - Pirate Red Chair
- Added multiplayer-synced cosmetic equipping.
- Added real SVG GUI/minigame asset examples:
  - coin
  - pearl
  - gem
  - wild berries
  - pirate flag
  - radio wave
  - word tile frame
  - liquid tube
  - treasure X
- Added visual equipped tags in the cockpit.
- Added model-viewer support for GLB previews when model files are added.
- Kept dependency-free Node runtime for the server and client app.

## Run locally

```bash
cd treasure-crew-v04
npm install
npm run dev
```

Then open:

```text
http://localhost:3001
```

Open it in two browser tabs or two mobile devices. Create a room on one device, then join from the other.

## Add your real 3D models

Drop model files into:

```text
public/assets/models/players/
public/assets/models/pirates/
public/assets/models/boats/
public/assets/models/islands/
public/assets/models/environments/
public/assets/models/steering-wheels/
public/assets/models/seats/
```

Then update:

```text
public/assets/asset-manifest.json
```

Example:

```json
{
  "id": "wheel-brass",
  "name": "Royal Brass Wheel",
  "src": "assets/models/steering-wheels/wheel-brass.glb",
  "thumbnail": "",
  "unlockAtManualPages": 1
}
```

The app will preview `.glb` assets in the Asset Locker when the files exist.

## Add real GUI and minigame assets

Put SVG/PNG/WebP files into:

```text
public/assets/gui/
public/assets/minigames/word/
public/assets/minigames/maintenance/
public/assets/minigames/treasure/
public/assets/minigames/pirate/
```

Then map them in `asset-manifest.json`.

## Suggested export settings for Blender / glTF

- Format: `.glb`
- Apply transforms before export
- Put origin at the useful pivot point
- Keep real-world scale consistent across props
- Use low/medium poly toy-like models for mobile
- Prefer baked/simple PBR materials
- Embed textures when possible
- Keep filenames lowercase with hyphens

## Host it

Use a Node-capable host because multiplayer uses Server-Sent Events.

Good options:

- Render
- Railway
- Fly.io
- DigitalOcean App Platform
- VPS

Suggested settings:

```text
Build command: npm install
Start command: npm start
Node version: 20+
```

## Project structure

```text
server.js                         Node multiplayer server
public/index.html                 App shell
public/app.js                     Multiplayer client/game UI/minigames
public/styles.css                 Glossy toy cockpit styling
public/assets/asset-manifest.json Asset registry
public/assets/models/             3D model drop zone
public/assets/gui/                GUI asset library
public/assets/minigames/          Minigame asset library
```

## Next recommended build

v0.5 should convert the Asset Locker into a true **3D hangar/gallery** with:

- full-screen model preview
- rotate/zoom inspection
- per-player avatar selection
- boat/island selection before treasure mode
- pirate model use during Pirate Attack Mode
- actual GUI asset replacement inside minigames
