---
title: Audio inventory — itch.io extracted packs
updated: 2026-05-15
status: current
domain: creative
---

# Audio inventory — itch.io packs

Catalog of every audio asset extracted from the 16 audio-bearing
itch.io packs the user owns (fetched via `scripts/fetch-itch.mjs`).
Source files live under `raw-assets/extracted/{audio,horror}/<pack>/`
(gitignored — not in the bundle). Production slugs are
hand-promoted into `public/assets/audio/` during the A11b layout
pass.

Total: 1,777 OGG/WAV/MP3 files across 26 packs (1,554 audio-bucket
+ 223 horror-bucket).

## Format policy

- **Promote OGG** when both OGG + WAV are shipped (smaller, web-
  optimal, Howler decodes natively). Fall back to WAV when only WAV
  ships and re-encode to OGG via ffmpeg at promotion time.
- Strip MP3 + Preview directories — MP3 is patent-encumbered and
  Preview is the pack vendor's marketing tease.

## Pack catalog — audio/

| Pack | Files | Use |
|---|---:|---|
| `ultimate-game-ambient-sound-effects-pack` | 304 | Per-archetype ambient beds (A11d). Wind, water, distant rumble, electrical hum. |
| `inventory-and-item-sound-effects-pack` | 277 | Pickup chimes, weapon-swap, key-acquired, secret-found. |
| `kitchen-sound-effects` | 138 | COV13 kitchen archetype — clatter, drawers, plates, knives. |
| `footsteps-sound-effects-pack` | 127 | Per-surface player footsteps (concrete, wood, gravel, water, metal). |
| `impact-hit-sound-effects-pack` | 102 | Enemy-hit feedback, melee impacts, projectile thunks. |
| `weapon-laser-sound-effects-pack` | 94 | Pistol, chaingun-loop, shotgun-blast variants. |
| `cinematic-whoosh-sfx-pack-40-fast-transition-sounds` | 85 | Going-back klaxon, level-transition whoosh, fade-overlay tail. |
| `pixelloops-ui-sound-effects-pack` | 81 | Menu nav, hover/click, modal open/close, focus chirps. |
| `fantasy-magic-spell-sound-effects-pack` | 81 | Boss telegraphs, secret-found burst, key-acquired chime. |
| `toys-in-the-attic-a-music-box-music-pack` | 80 | Library archetype + landing-screen music-box ambient. |
| `game-explosion-sound-effects-pack` | 61 | Barrel explosions, boss-defeat punctuation, COV12 chest-open. |
| `victory-level-complete-music-pack-24-stingers-pixelloops` | 49 | MISSION COMPLETE stinger, run-summary fanfare. |
| `retro-dungeon-game-music-pack` | 25 | Corridor + arena music beds. |
| `pixelloops-retro-combat-pack` | 25 | Active-combat music intensity layer. |
| `pixelloops-retro-chiptune-boss-battle-pack` | 25 | Boss-arena music. |

## Pack catalog — horror/

| Pack | Files | Use |
|---|---:|---|
| `horror-sound-effects-pack` | (count via promote) | Sewer + library tension stingers, jumpscare hits. |
| `horror-tension-jumpscare-music-pack-20-tracks-pixelloops` | (count via promote) | Sewer archetype music + going-back panic layer. |
| `gameloops-vol4-darkambient` | (count via promote) | Courtyard nighttime ambient bed. |
| `creature-extended-supporter-pack` | (count via promote) | Enemy vocalizations (growls, screams, death rattles). |
| `zombie-model-{2,3,4,5}` | (count via promote) | Per-enemy-variant idle + attack + death vocalizations. |
| `zombie-scientist-character` | (count via promote) | Library variant enemy vocalizations. |
| `high-dragon{,-death-animation}` | (count via promote) | Boss vocalizations. |

## Per-archetype recommendations (drives A11d music/ambient slots)

| Archetype | Ambient bed | Music layer | Enemy vocalizations |
|---|---|---|---|
| corridor | `ultimate-game-ambient/`(industrial hum) | `retro-dungeon-game-music-pack` | `creature-extended` (low growls) |
| arena | `ultimate-game-ambient/`(open wind) | `pixelloops-retro-combat-pack` | `zombie-model-2,3` |
| courtyard | `gameloops-vol4-darkambient` | `retro-dungeon-game-music-pack` (alt) | `creature-extended` |
| sewer | `horror-sound-effects-pack`(drip + echo) | `horror-tension-jumpscare-music-pack` | `zombie-model-4,5` (wet) |
| library | `toys-in-the-attic-a-music-box-music-pack` | `toys-in-the-attic` (low mix) | `zombie-scientist-character` |
| **boss arena** | layered over the parent archetype's ambient | `pixelloops-retro-chiptune-boss-battle-pack` | `high-dragon` + variant |

## Per-system slot allocations

| System | Source pack | Notes |
|---|---|---|
| Player footsteps | `footsteps-sound-effects-pack` | Surface tag (concrete/wood/gravel/water/metal) maps to subfolder; FOOT XOR PRNG picks the variant. |
| Weapon fire — pistol | `weapon-laser-sound-effects-pack/pistol*` | One-shot per fire. |
| Weapon fire — chaingun | `weapon-laser-sound-effects-pack/chaingun-loop*` | Loop start + loop body + loop tail. |
| Weapon fire — shotgun | `weapon-laser-sound-effects-pack/shotgun*` | One-shot per fire. |
| Weapon fire — flamethrower | `weapon-laser-sound-effects-pack/flame*` | Loop body. |
| Weapon swap | `inventory-and-item-sound-effects-pack/swap*` | One-shot on weapon-key. |
| Pickup chime — health | `inventory-and-item-sound-effects-pack/heal*` | One-shot. |
| Pickup chime — ammo | `inventory-and-item-sound-effects-pack/ammo*` | One-shot. |
| Pickup chime — key | `fantasy-magic-spell-sound-effects-pack/key*` | One-shot ceremony. |
| Going-back klaxon | `cinematic-whoosh-sfx-pack/klaxon*` | One-shot on phase transition. |
| Secret-found burst | `fantasy-magic-spell-sound-effects-pack/secret*` | One-shot. |
| Boss telegraph | `fantasy-magic-spell-sound-effects-pack/boss*` | Per-attack telegraph. |
| Boss-defeat punctuation | `game-explosion-sound-effects-pack/boss-die*` | One-shot. |
| Barrel explosion | `game-explosion-sound-effects-pack/barrel*` | Multi-variant pool. |
| COV12 chest-open | `game-explosion-sound-effects-pack/chest*` | One-shot. |
| Menu navigation | `pixelloops-ui-sound-effects-pack/nav*` | nav-down / nav-up / nav-select. |
| Menu confirm | `pixelloops-ui-sound-effects-pack/confirm*` | NEW GAME / RESUME. |
| Menu cancel | `pixelloops-ui-sound-effects-pack/back*` | OPTIONS panel back. |
| MISSION COMPLETE stinger | `victory-level-complete-music-pack/stinger*` | One-shot on run-clear. |
| Landing-screen music-box | `toys-in-the-attic/music-box-loop*` | Long-form loop. |
| Enemy hit | `impact-hit-sound-effects-pack/hit*` | Multi-variant pool, per-projectile / per-melee. |
| Enemy death | `creature-extended-supporter-pack/death*` + per-variant zombie packs | One-shot, variant-specific. |
| Kitchen archetype incidentals | `kitchen-sound-effects/clatter*` | COV13 trigger-driven scatter sfx. |

## Slot naming convention

Howler sprite registry uses slug paths matching the slot allocation
table:

```
weapon/pistol/fire
weapon/chaingun/loop-start
weapon/chaingun/loop-body
weapon/chaingun/loop-tail
weapon/shotgun/fire
weapon/swap
weapon/melee/swing-{0,1,2,3}

player/footstep/concrete-{0,1,2,3}
player/footstep/wood-{0,1,2,3}
player/footstep/gravel-{0,1,2,3}
player/footstep/water-{0,1,2,3}
player/footstep/metal-{0,1,2,3}
player/death

pickup/health
pickup/ammo
pickup/key
pickup/flashlight
pickup/treasure
pickup/secret

enemy/{rattler,phaser,bouncer,...}/idle
enemy/{...}/attack
enemy/{...}/hit
enemy/{...}/death

boss/{telegraph,attack,defeat}

ui/nav-up
ui/nav-down
ui/confirm
ui/back
ui/hover

music/{corridor,arena,courtyard,sewer,library,boss}/loop
ambient/{corridor,arena,courtyard,sewer,library}/bed

system/mission-complete
system/going-back-klaxon
system/level-transition
system/fade-tail
```

## Open questions for A11b (`public/assets/audio/` layout)

1. **Sprite atlas or per-slug files?** Howler supports both. For the
   24-variant zombie set + 25-track music libraries an atlas would
   keep HTTP overhead down but balloons the cold-start decode budget.
   Recommendation: per-slug files + Howler's `preload: false`
   except for tier-1-critical surfaces (menu nav, first-weapon
   fire).
2. **Loudness normalization.** itch.io packs ship at wildly different
   levels. Promote via an ffmpeg LUFS-normalize pass to -16 LUFS so
   the music bed doesn't drown out the chaingun. Script lives in
   A11b.
3. **Variant pool size.** Per-trigger pool of 3-4 variants prevents
   repetition fatigue; PRNG-pick on play. Howler's `sprite` lookup
   doesn't have built-in random; wrap it in a `pick()` helper that
   honors the engine's seeded RNG so playback is reproducible in
   tests.
