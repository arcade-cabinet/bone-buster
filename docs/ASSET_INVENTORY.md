---
title: 3DPSX asset inventory
updated: 2026-05-14
status: current
domain: media
---

# 3DPSX asset inventory — what we have vs what we're using

OBJEXOOM ships real PSX-style GLB assets curated from two sources:

1. **Local references** at `references/` (gitignored, ~175 MB) — pre-
   curated game-ready bundles (horror enemies, slasher weapons,
   stylized guns, tilemap, ocean surface, traps).
2. **3DPSX library** at `/Volumes/home/assets/3DPSX/` (network share,
   read-only) — **1,452 GLB files** across 6 top-level categories.

Currently we wire only **27 GLBs** into the game (`public/assets/models/`).
The rest is opportunity — features for the elevation track.

## Currently wired

### Enemies (`public/assets/models/enemies/`)

| File | Role | Source |
| --- | --- | --- |
| `skeleton.glb` | primary skeleton | Fantasy/Dungeon Skeleton |
| `imp.glb` | primary imp | Fantasy/Knight |
| `wraith.glb` | flying wraith | Fantasy/Bat |
| `horror/sewerfiend.glb` | rigged horror melee | Sewerfiend1.0 |
| `horror/horned.glb` | static horror silhouette | Horned-Creature |
| `horror/nun.glb` | tall vertical silhouette | PSX-Nun1.0 |
| `horror/plague_doctor.glb` | mid-tier rigged | Horror-Fantasy Megapack |
| `horror/elk_demon.glb` | mid-tier rigged | Horror-Fantasy Megapack |
| `horror/abomination.glb` | static horror | Horror-Fantasy Megapack |
| `horror/abomination2.glb` | static horror | Horror-Fantasy Megapack |
| `horror/anomaly.glb` | static horror | Horror-Fantasy Megapack |
| `horror/clown_1.glb` | static clown | Horror-Fantasy Megapack |
| `horror/clown_3.glb` | static clown | Horror-Fantasy Megapack |
| `horror/alien.glb` | tall thin invader | Horror-Fantasy Megapack |
| `horror/abomination_rigged.glb` | duplicate (unused) | unused |

### Weapons (`public/assets/models/weapons/`)

| File | Role | Source |
| --- | --- | --- |
| `pistol.glb` | pistol viewmodel | Props/Weapons/USP |
| `chaingun.glb` | chaingun viewmodel | Props/Weapons/Uzi |
| `shotgun.glb` | shotgun viewmodel | local Shotgun.glb |
| `melee_axe.glb` | melee (unwired) | Slasher pack/Axe |
| `melee_knife.glb` | melee (unwired) | Slasher pack/Kitchen Knife |
| `melee_machete.glb` | melee (unwired) | Slasher pack/Machete |
| `melee_chainsaw.glb` | melee (unwired) | Slasher pack/Chainsaw |
| `melee_meathook.glb` | melee (unwired) | Slasher pack/Meat Hook |

### Props (`public/assets/models/props/`)

| File | Role |
| --- | --- |
| `door.glb` | grid-map door (unwired — current door is procedural box) |
| `door_locked.glb` | locked-state variant (unwired) |
| `lamp_on.glb` | lit lamp (unwired) |
| `lamp_off.glb` | dark lamp (unwired) |

## Untapped — local references (`references/`)

Still-zipped packs:

- **PSX Ghost Hunting Tools Release.zip** — UV light, EMF meter,
  spirit box, camera (potential pickup variety)
- **PSX-Ocean-Surface.zip** — animated water surface (could fill
  underground sewer-level pools)
- **Stylized Guns 3D Models PRO.zip** — additional gun roster
  (revolver, sawn-off, etc — potential weapon slots 4-6)
- **PSX-Knives.zip** — knife variants (replace single-knife melee
  with a real knife roster)
- **Chainsaw_2.0.zip** — newer chainsaw mesh (replace current
  chainsaw GLB)
- **PSX Horror-Fantasy Megapack.zip** — full pack, we've only
  cherry-picked enemies from it; props + decorations inside
- **Horned-Creature-Release1.0.zip** — full horned pack (currently
  only the rigless mesh wired)
- **PSX-Nun1.0.zip** — nun rig (currently only static wired)

Loose extras:

- **Cleaver.glb**, **Sword.glb** — additional melee options
- **Handcannon.glb** — heavy pistol variant
- **Flamethrower.glb** — area-of-effect weapon (HUGE gameplay
  unlock; reference clone has nothing like it)
- **Electrical.glb**, **Flesh.glb**, **Traps.glb**, **Misc.glb** —
  prop bundles, hundreds of meshes inside
- **meat_grinder.glb** — environmental kill trap
- **Tilemap/** + **Tiles/** (486 PNG files) — texture atlas + 486
  individual tile PNGs (could drive a Tiled-style 2D atlas for HUD
  icons / minimap)

## Untapped — `/Volumes/home/assets/3DPSX/` (network share)

1,452 GLB files. Sample of unwired potential:

### Props/Weapons (the rest, ~20 GLBs)

- Revolver_Full (Retribution, Cylinder, Bullet sub-pieces — can
  build a real revolver with magazine + bullet trails)
- Katana, Cleaver, Sword, Sword_Sheated, Scabbard
- Knives subdir (Knife_1, Knife_2, …) — full knife rack

### PSX Mega Pack II v1.8

- **Light Sources** (~30 GLBs) — 4+ lamp variants × on/off pairs.
  Real lit prop scatter for sectors, with shadow projection.
- **Doors & Gates** (~10 GLBs) — door variants, drop-in upgrade to
  the current procedural box doors.
- **Structures** (210 GLBs!) — modular wall pieces, columns,
  archways. Could replace the per-cell box wall with composed
  architecture.
- **Modular Structures** + **Modular Props** — even more.
- **Buildings** (14 GLBs) — pre-built buildings for elevated
  hub/courtyard variations.
- **Large Props & Machinery** — environmental scale-ups (boilers,
  generators).
- **Debris & Misc** — small scatter (bones, rags, dust piles).
- **Light Sources** glb pairs read like Quake-era unique level
  lighting; using these properly with shadow-projecting point
  lights would be a major visual elevation.

### Characters

- ChibiCharacters (~14 GLBs, with `_pr` emission variants) — NPC
  silhouettes, civilian variety for non-combat sectors.
- individuals items objects only — character accessories.

### Environment

- Nature (trees, rocks) — outdoor courtyard variations.
- Buildings — exteriors.

### Vehicles

- PS1-RVS — vehicles. Probably not useful for OBJEXOOM directly but
  worth noting.

### Fantasy

- Source of the current skeleton/knight/bat — likely has more
  variants we haven't tapped (mage, wraith variants, etc).

## Convention

Per [`public/README.md`](../public/README.md), every wired GLB lives
under `public/assets/models/<category>/<name>.glb`. URLs in
[`src/models.ts`](../src/models.ts) flow through `A()` so the
BASE_URL prefix resolves correctly in both dev and gh-pages mode.

When wiring a new GLB:

1. Copy from `references/` or `/Volumes/home/assets/3DPSX/` into the
   right `public/assets/models/<category>/` subdir.
2. Register in `models.ts` with `A("/assets/models/...")`.
3. If it's an enemy or weapon, extend the relevant roster + registry.
4. If it has named animations, document them in the comment block
   above the registry entry (use `blender --background --python`
   inspection or the gltf-pipeline inspector to enumerate).
5. Run `pnpm test:e2e:screenshots` and inspect the result. If the
   mesh renders too big/small/wrong-axis, adjust `heightTiles` +
   `yawOffsetRad` in the registry entry.

## Asset budget

Per-category soft limits (enforced manually for now; sister-project
patterns suggest a CI gate via `verify-runtime-assets.ts`):

- Enemies: <2 MB per GLB (currently all comfortably under)
- Weapons: <800 KB per viewmodel GLB
- Props: <500 KB per static prop
- Total `public/assets/models/`: target <30 MB so the initial mobile
  bundle stays installable on cheap data plans
