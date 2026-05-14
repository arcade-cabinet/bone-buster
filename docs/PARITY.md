---
title: Reference clone parity audit
updated: 2026-05-14
status: superseded
domain: quality
---

> **Superseded by [`docs/PRD.md`](./PRD.md).** This doc is the historical
> parity audit — 100% reference parity is reached and PA9b is now closed.
> All remaining work tracks in [`PRD.md`](./PRD.md) +
> [`.agent-state/directive.md`](../.agent-state/directive.md).
>
> **Parity reached.** Every reference mechanic is matched or elevated.
> The last critical gap (PA16 — adaptive resolution) shipped in
> 57dd8fa. Shell-ejection-on-chaingun (PA9b) closed in 332f8ea.
> Persistent save/load ships via sql.js per E9.

# DOOM reference clone parity audit

Source: [`reference-codebases/js13k2019-yet-another-doom-clone/`](https://github.com/carlini/js13k2019-yet-another-doom-clone)
(read-only, gitignored locally; lives at
`~/src/reference-codebases/js13k2019-yet-another-doom-clone/`).

OBJEXOOM is a port of the reference's STRUCTURE — sector-portal
rendering, key-and-door progression, lava damage, ammo + weapon
swap — onto modern tech (Vite + r3f + Capacitor) elevated with real
3DPSX assets and a horror-tactical visual language. This doc tracks
every reference mechanic and whether OBJEXOOM matches it.

## Legend

- **✅ Present** — OBJEXOOM ships the same behavior or a stricter
  superset. No work needed.
- **🚀 Elevated** — OBJEXOOM ships a more capable version (more
  weapons, richer assets, deeper audio, etc).
- **⚠️ Partial** — Behavior exists but with caveats (different
  formula, missing edge case, etc).
- **❌ Missing** — Reference has it, OBJEXOOM doesn't, **bug**.

## Player

| Mechanic | Reference shape | OBJEXOOM | Status |
| --- | --- | --- | --- |
| Health scale | 0–9 discrete | 0–9 (per `PLAYER_MAX_HP=9`), difficulty-scaled (×0.6 nightmare → ×1.5 too-young) | 🚀 Elevated |
| Damage cooldown | 450 ms (250 on hard) before next hit can land | `last_user_hit` poll in `engine.ts` matches | ✅ Present |
| Low-health visual | HP bar turns red below 3 | HP pip row + low-health strobe text | 🚀 Elevated |
| Run speed | Hardcoded | Tunable via `PLAYER_MOVE_SPEED`, difficulty-scaled | 🚀 Elevated |
| Strafe | Yes | Yes (`PlayerController`) | ✅ Present |
| Jump | None | None | ✅ Present |
| Crouch | None | None | ✅ Present |
| Mouse look | Pointer-lock + sensitivity | Pointer-lock + `PLAYER_TURN_SENSITIVITY` | ✅ Present |
| Touch controls | None | Dual virtual sticks + FIRE button | 🚀 Elevated |
| Damage cone | One-shot updateHealth(-1) | Damage scaled by attack type + difficulty | 🚀 Elevated |

## Weapons

| Mechanic | Reference shape | OBJEXOOM | Status |
| --- | --- | --- | --- |
| Slot count | **1 (chaingun only)** | 3 ranged (pistol/chaingun/shotgun) | 🚀 Elevated |
| Hitscan | Yes | Yes (`castRayAny`) | ✅ Present |
| Spread | None | Per-weapon `spreadRad` | 🚀 Elevated |
| Pellet count | 1 | Per-weapon (shotgun = 7) | 🚀 Elevated |
| Cooldown | Per-weapon | Per-weapon | ✅ Present |
| Recoil | Yes (`chaingun.recoil`) | Yes (`RECOIL_DISTANCE` per weapon, sine-eased) | 🚀 Elevated |
| Muzzle flash | `LightFlash` class | `pointLight` w/ envelope in scene root | ✅ Present |
| Shell ejection | `Shell` class (chaingun shells) | `ShellEjectField` accepts both — shotgun ejects one large shell per pull, chaingun ejects a smaller (0.6× scale) shell on every pulse | 🚀 Elevated |
| Ammo cost | None (chaingun unlimited) | Per-weapon (chaingun infinite, shotgun consumes) | 🚀 Elevated |
| Viewmodel | Hand-mesh `chaingun = [...]` | Real GLB per weapon, auto-bbox normalized | 🚀 Elevated |
| Melee | None | BLADE slot (machete viewmodel, 1.6-tile range, 55 dmg, infinite ammo, whoosh sfx). 4 additional melee GLBs staged for future tuning. | 🚀 Elevated |

## Enemies

| Mechanic | Reference shape | OBJEXOOM | Status |
| --- | --- | --- | --- |
| Kind count | 2 (`Enemy` skeleton-melee, `FlyingEnemy` flying) | 3 base kinds (skeleton, imp, wraith) + per-kind variant rosters | 🚀 Elevated |
| Variant count | 0 (single mesh per kind) | 11 horror skins across the rosters (sewerfiend, plague_doctor, elk_demon, abomination ×2, anomaly, horned, nun, alien, clown ×2) | 🚀 Elevated |
| FSM | 4 states (patrol/approach/shoot/return) | 4 states (`tickEnemyFsm`) | ✅ Present |
| HP | Per-kind | Per-kind (`SKELETON_HP`) | ✅ Present |
| Melee attack | Skeleton bumps player | Skeleton + close-range damage | ✅ Present |
| Ranged attack | FlyingEnemy spits `EnemyBullet` | Imp + wraith fire `EnemyBullet` | ✅ Present |
| Line of sight | `detect_collision_positions` w/ walls | `hasLineOfSightAny` | ✅ Present |
| Pursuit | Plain seek | yuka EntityManager + Pursuit lead-target for imp kind | 🚀 Elevated |
| Aggro alert SFX | One | `playAggroAlert` w/ pan | 🚀 Elevated |
| Death animation | `BodyPart` shards | `BodyPartField` (4-6 shards, gravity + bounce + spin + fade) | ✅ Present |
| Death SFX | Yes | `playSkeletonDeath` w/ pan | ✅ Present |
| Explode-on-death | Imps explode (12 motes) | Imp explode → 12 amber motes in `ParticleBurstField` | ✅ Present |
| Skinned animation | None (static mesh) | Per-rig idle/walk/attack/hit/death from named tracks; procedural bob fallback for static rigs | 🚀 Elevated |
| Boss enemies | None | **Pending** — rigged horror GLBs available (`final_rigged.fbx` per kind in references) | 🚀 Elevated (queued) |

## Map / Level

| Mechanic | Reference shape | OBJEXOOM | Status |
| --- | --- | --- | --- |
| Level count | 4 hand-encoded + procedural remake | 4 reference levels (`refLevel.ts`) + procedural | ✅ Present |
| Sector polygons | Yes (`MapPolygon`) | Yes (`ObjexoomSectorMap`) | ✅ Present |
| Grid alternative | None | `ObjexoomGridMap` for procedural | 🚀 Elevated |
| Floor heights | Per-sector | Per-sector (`floorHeight`) | ✅ Present |
| Ceiling heights | Per-sector | Per-sector (`ceilingHeight`) | ✅ Present |
| Lava | floorHeight < 0 | Same convention | ✅ Present |
| Lava damage | `update_health(-1)` every 600 ms standing on lava | 8 HP scaled tick every 600 ms | ✅ Present |
| Key cell | Yes | Yes (`keyPosition`) | ✅ Present |
| Locked door | `LockedDoor` extends `Wall` | `LockedDoor` r3f component | ✅ Present |
| Exit goal | `Goal` collectable, 5 hues by rotation | `ExitPortal` w/ 5 `GOAL_HUES` | ✅ Present |
| Going-back machine | `going_back = true` flag, all enemies aggro | `phase === "going_back"`, identical re-aggro | ✅ Present |
| RealDoor at goal | Spawns after goal collected | Spawns + slides up on `unlocked` | ✅ Present |
| RealDoor at spawn | Yes (H8 final level-clear gate) | Yes (second `RealDoor` at `playerSpawn`) | ✅ Present |
| ManyEnemies spawner | Reinforcement burst | `refLevel.ts` reuses the same shape | ✅ Present |
| Decorative props | None | **Pending** — sectors are bare; 3DPSX has barrels/lamps/chains ready | 🚀 Elevated (queued) |

## Pickups

| Mechanic | Reference shape | OBJEXOOM | Status |
| --- | --- | --- | --- |
| Health | +1 HP, amber sprite | `health` kind, amber-cross mesh, +1 HP scaled | ✅ Present |
| Flashlight | Spawns mid-level, gates dark areas | `flashlight` kind, lantern mesh + `Flashlight` SpotLight | ✅ Present |
| Ammo (chaingun) | N/A (chaingun unlimited) | `chaingunAmmo` indigo cell box | 🚀 Elevated |
| Ammo (shotgun) | N/A | `shotgunAmmo` brass shell pair w/ caps | 🚀 Elevated |
| Pickup chime | `sounds.collect`/`collect2` | `playPickup` w/ pan + amber 8-mote burst | 🚀 Elevated |

## HUD / UI

| Mechanic | Reference shape | OBJEXOOM | Status |
| --- | --- | --- | --- |
| HP readout | Width-bar `hW.style.width` | HP pip row + numeric readout | 🚀 Elevated |
| Crosshair | One static dot | `crosshairStyle` (indigo + violet ring) | 🚀 Elevated |
| Ammo readout | None | Per-weapon numeric in muzzle color | 🚀 Elevated |
| Weapon chips | None | Bottom-center row, hot-keyable, touch-tappable | 🚀 Elevated |
| Kill counter | None | `objexoom-kills`, Black Ops One numerics | 🚀 Elevated |
| Key indicator | None | `KEY ACQUIRED` / `FIND THE KEY` | 🚀 Elevated |
| Level label | None | `E1M1` in `LEVEL_LABEL[level]` | 🚀 Elevated |
| Pause menu | None | PAUSED overlay w/ run stats | 🚀 Elevated |
| Mission complete | "You got back in N m N s" | MISSION COMPLETE w/ Black Ops One title, run stats | 🚀 Elevated |
| Game over | "You died" implicit on health=0 reset | YOU DIED card w/ TRY AGAIN button | 🚀 Elevated |
| Click-to-engage | Browser pointer-lock prompt | `ClickToEngagePrompt` w/ Black Ops One body | 🚀 Elevated |
| Difficulty select | Implicit (hard mode unlocks after first clear) | 4 difficulty tiers (too-young, hurt-me-plenty, ultra, nightmare) | 🚀 Elevated |
| Level select | None | M1–M4 + procedural | 🚀 Elevated |
| Options pane | None | Sensitivity + audio toggles | 🚀 Elevated |
| How-to-play screen | None | Full action ↔ control table | 🚀 Elevated |

## Audio

| Mechanic | Reference shape | OBJEXOOM | Status |
| --- | --- | --- | --- |
| Generation | `jsfxr` retro waveforms | Tone.js procedural synth + bank | 🚀 Elevated |
| Sounds bank | 7 (boom/gun/collect/collect2/clock/hit/+death) | 14+ named voices in `sfx.ts` | 🚀 Elevated |
| Music | 6-voice procedural (long timer chain) | Multi-mood (exploration/combat/going-back) procedural music | 🚀 Elevated |
| Spatial pan | None | `panForPosition` on every SFX | 🚀 Elevated |
| Aggro alert | One pluck | `playAggroAlert` w/ pan | ✅ Present |
| Door SFX | `clock` sound | `playDoor` + `playDoorTick` | 🚀 Elevated |
| Portal SFX | None explicit | `playPortal` on RealDoor open | 🚀 Elevated |
| Loading indicator | None | Music-load progress chip on landing | 🚀 Elevated |

## Rendering / FX

| Mechanic | Reference shape | OBJEXOOM | Status |
| --- | --- | --- | --- |
| Lighting | `lights[N]` shadow-mapped per level | ambient + directional + hemisphere + per-camera spotlight (flashlight) + muzzle pointLight | 🚀 Elevated |
| Shadow maps | Pre-computed per static geometry | Real-time PCF shadow maps on directional + flashlight | 🚀 Elevated |
| Fog | None | `<fog>` ink-tinted, 6→48 tiles | 🚀 Elevated |
| Postprocessing | Vignette via shader uniform | `EffectComposer` w/ Bloom + ChromaticAberration + Vignette | 🚀 Elevated |
| Going-back strobe | None | Phase-driven light strobe (H8/J5) | 🚀 Elevated |
| Particle bursts | `LightFlash`, `Flash` | `ParticleBurstField` w/ 4 burst kinds × parametric counts | 🚀 Elevated |
| Body-part shards | 4-6 cubes per enemy death | `BodyPartField` same shape | ✅ Present |
| Bullet sphere | One amber dot | `BulletField` pooled glowing spheres | ✅ Present |
| Treasure chest at exit | None | `TreasureChest` decorative chest w/ brass band + lock | 🚀 Elevated |
| Adaptive resolution | `set_resolution(-1)` on level transition | `AdaptiveResolution` r3f component, 60-frame rolling FPS sampler, 2-window debounce, drops `gl.setPixelRatio` toward 0.5 floor on sustained <30 FPS / raises toward devicePixelRatio cap on sustained >55 FPS. Debug HUD readout under `?objexoomDebug`. | 🚀 Elevated |
| Wall variant texture | None | 3-variant tinted box per cell | 🚀 Elevated |

## Run / progression

| Mechanic | Reference shape | OBJEXOOM | Status |
| --- | --- | --- | --- |
| Level transition | `setTimeout(_=>{set_resolution(-1); reset(); map.levels.shift(); map.load_level()}, 200)` | `status: "transitioning"` → 800 ms → new seed + reset HP/ammo/key (run stats preserved) | ✅ Present |
| HP reset between levels | health=5 on death restart | Per-level HP preserved on advance, reset on death | 🚀 Elevated |
| Run stats | None | Per-run kills + damage + time + levels cleared | 🚀 Elevated |
| Difficulty cycle | Beat normal → unlocks hard | 4 tiers selectable from landing | 🚀 Elevated |
| Save / load | None | sql.js-backed `runHistory.ts`; one row per run (started_at, ended_at, levels_cleared, total_kills, total_damage_taken, level_set, outcome). Persisted as base64 in localStorage; public API: `insert`, `listRecent`, `bestRun`, `runCount`, `clear`. | 🚀 Elevated |

## Outstanding gaps (failures to fix)

1. ⚠️ **Test 5 visual quality** — `mission-complete.png` currently captures mid-transition (the loop ran out of debug-hook stability before reaching the actual WIN overlay). Re-record after the next visual change lands.

All reference-clone mechanics are now matched or elevated — including
shell ejection (PA9b shipped). The parity-reached banner at the top
fully stands.

## Elevation queue (beyond parity)

Tracked in [`ELEVATION.md`](./ELEVATION.md) with full specs in
[`PRD.md`](./PRD.md). Remaining work (Phase 1 complete):

- **Phase 2 (mechanical):** E5 destructible barrels, E6 switches + secret walls
- **Phase 3 (visual):** E2 bosses, E3 decorative scatter, E4 lit lamps with shadow projection
- **Phase 4 (polish + variety):** E7 water/sewer biome, E8 flamethrower weapon, E10 3D HUD elements, E11 per-level ambient SFX layers, E13 procedural archetype deepening

Shipped this branch: E1 melee, E9 sql.js run history, E12 adaptive
resolution. Phase 1 of elevation queue complete.

## Verification

`pnpm test` and `pnpm test:e2e:screenshots` capture the canonical 5
poses. Visual parity is judged against the reference by side-by-side
inspection of the screenshots (reference's `image_large.png` lives
in `~/src/reference-codebases/js13k2019-yet-another-doom-clone/`).
