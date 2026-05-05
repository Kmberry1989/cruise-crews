# Treasure Crew Co-op — v0.4 Design Notes

## Current design direction

The game is a mobile-first cooperative nautical party game with a glossy vinyl/toy visual language. The cockpit is the central hub. Two players operate separate responsibility stations and communicate under light pressure.

## Core player roles

### Captain / Radio / Navigation

- Radio phrase decoding
- Word search
- Letter-bank word building
- Treasure clue reading
- Future: voice/intercom UI, map reading, pirate warning callouts

### Engineer / Maintenance

- Liquid sorting
- Connect-the-dots circuit repair
- Matching spare parts
- Breaker panel recovery
- Treasure GPS coordinate tapping
- Future: timed repairs during pirate attacks

## New v0.4 asset system

The game now expects an external art pipeline:

```text
public/assets/asset-manifest.json
```

The manifest is the single source of truth for model and GUI asset ids.

### Model categories

- players
- pirates
- boats
- islands
- environments
- steeringWheels
- seats

### GUI categories

- coin
- pearl
- gem
- berry
- pirateFlag
- radioWave

### Minigame asset categories

- word tile frames
- liquid tubes
- treasure X markers
- future pirate/defense assets

## Cosmetic unlock rules

Manual pages unlock cosmetics:

| Manual Page | Unlock |
|---:|---|
| 0 | Classic Toy Wheel + Navy Captain Chair |
| 1 | Royal Brass Wheel |
| 2 | Cloud Cream Chair |
| 3 | Pirate Bone Wheel |
| 4 | Pirate Red Chair |
| 5 | Brown Pirate Ship |
| 6 | Berry Cove Island |

## Why this is the right next layer

The project is moving from system prototype to content pipeline. The next major risk is not networking anymore; it is whether real art assets can be dropped in, named, unlocked, equipped, and previewed without rewriting the game.

v0.4 establishes that foundation.

## v0.5 recommendation

Build a full 3D Hangar mode:

1. Select player model.
2. Select boat model.
3. Select steering wheel and seat cosmetics.
4. Preview pirates and islands.
5. Use selected assets inside treasure and pirate modes.
6. Add QR-code room join.
7. Replace emoji/minimal SVG minigame icons with final GUI artwork.
