# 3D model drop zone

Put real `.glb` or `.gltf` files into the matching folders and update `public/assets/asset-manifest.json`.

Suggested categories:

- `players/` — player avatars and floating toy heads
- `pirates/` — enemy/pirate figures
- `boats/` — player boats and pirate ships
- `islands/` — treasure islands and destination props
- `environments/` — cockpit sets, sky boxes, ocean scenes
- `steering-wheels/` — unlockable wheel cosmetics
- `seats/` — unlockable player chair cosmetics

Recommended export settings:

- GLB binary format
- Origin centered at the base or natural pivot
- Scale normalized near 1 unit tall for characters/props
- Mesh names kept readable
- Materials named by purpose, e.g. `glossy_red`, `brass_trim`, `vinyl_skin`
- Texture paths embedded or colocated next to the GLB
