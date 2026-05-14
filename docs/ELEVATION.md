---
title: Elevation roadmap — beyond reference parity
updated: 2026-05-14
status: current
domain: product
---

# Elevation roadmap

The DOOM reference clone ([`PARITY.md`](./PARITY.md)) is the floor,
not the ceiling. OBJEXOOM is at or above parity on every mechanic
except adaptive resolution + a few shell-ejection edge cases. The
real work is now **elevation** — features the reference's 13 KB
budget couldn't dream of, leveraging the 1,400+ GLB depth in
[`ASSET_INVENTORY.md`](./ASSET_INVENTORY.md).

Each section below proposes a feature, the assets it unlocks, the
engine work required, and a rough priority.

## E1 — Full melee weapon slot

**Status:** Assets ready, engine partial.

OBJEXOOM ships 5 melee GLBs already (`axe`, `knife`, `machete`,
`chainsaw`, `meathook`) but they aren't wired into the weapon
switcher. Adding a 4th `weapon: "melee"` slot with sub-skin variants
gives the player a starting-weapon-as-fallback when ammo runs out and
opens the door to gore-heavy close-range gameplay.

Required:

- `WeaponId` union → `"pistol" | "chaingun" | "shotgun" | "melee"`
- New `WeaponSpec` with `rangeTiles ≈ 1.5`, instant cooldown, infinite
  ammo, swing animation on viewmodel
- Per-skin pick (cycle through axe/knife/machete/etc by level seed,
  similar to enemy roster)
- HUD hotkey `4`
- New SFX: `playSwoosh` + `playMeleeHit`

**Priority:** High. Mechanically simple, huge gameplay payoff.

## E2 — Bosses with rigged horror animations

**Status:** Assets ready, engine missing.

`references/_extracted/horror_rigged/` ships `final_rigged.fbx` for
plague_doctor, abomination, elk_demon, clown (2 variants). These are
intended as **bosses** — same kind as the regular enemies but larger
HP pool, slower, harder-hitting, distinctive named-track animations.

Required:

- New `EnemyKind = "boss"` (or per-kind boss variant tier)
- 3-5× HP scaling
- Per-boss telegraph animation before attack
- BOSS APPROACHES / BOSS DEFEATED HUD overlays
- Spawn rules: 1 boss every N levels, or on level 3+ only
- Drop reward: full health + bonus ammo

**Priority:** High. Solves the "every level feels the same" risk.

## E3 — Decorative sector scatter

**Status:** Assets exist on network share, engine missing.

Current sectors render as empty polygons with player + enemies +
exit. The 3DPSX mega-pack has 200+ modular props (barrels, chains,
crates, signs, dust piles, rags). Deterministically scatter them by
sector seed.

Required:

- `SectorScatterEntry` type in `engine.ts` with prop URL + tile
  position + yaw
- Build-time generation: per-level seed scatters N decorative props
  inside each sector, avoiding the player path
- Render via shared `<PropMesh url={url} />` (uses `useGLTF.preload`)
- 5-10 props per sector starting density
- Some lit (lamp variants from Mega Pack Light Sources) projecting
  shadows

**Priority:** High. Single biggest visual elevation we can ship.

## E4 — Lit lamp props with real shadow projection

**Status:** Assets exist, engine partial.

`public/assets/models/props/lamp_on.glb` is checked in but never
spawned. Mega Pack Light Sources have 30+ lamp variants in on/off
pairs. Adding lit lamps to corridors with point lights that
shadow-project would dramatically deepen the horror-corridor feel.

Required:

- `<LampProp on={true} position={...} />` component in
  `src/scene/props/`
- `<pointLight>` co-located, color = warm amber, distance ≈ 6 tiles
- Shadow-map ON (the SpotLight flashlight already does PCF)
- Limit to 3-4 lamps lit per sector simultaneously (perf budget)
- Lamps in `going_back` phase flicker / die

**Priority:** Medium-High.

## E5 — Destructible / interactive barrels

**Status:** Assets exist, engine missing.

Mega Pack II has explosive-barrel meshes. Shooting one detonates,
deals AoE damage to nearby enemies, satisfies the doomed-classic
crowd-control loop the reference doesn't offer.

Required:

- `Barrel` interactive prop class in engine
- HP, hitbox, explosion AoE radius + damage
- On detonation: `ParticleBurstField` 30-mote amber explode +
  `BodyPartField` debris + `playBoom` louder + LightFlash
- Spawn 1-2 barrels per sector clustered near enemy spawn points

**Priority:** Medium.

## E6 — Switches + secret walls

**Status:** Assets exist, engine missing.

Classic DOOM secret-area unlock loop. Mega Pack has switch meshes.

Required:

- `Switch` interactive prop with state on/off
- Interact on proximity + fire button
- Triggers a named wall to slide / open / fade
- Reveal a hidden room with ammo + flashlight + bonus pickups
- One secret per level minimum

**Priority:** Medium. Adds depth without much engine work.

## E7 — Animated water in sewer levels

**Status:** Asset ready (`PSX-Ocean-Surface.zip`), engine missing.

Adding an underground sewer-level archetype with knee-deep animated
water (visible plane with UV scroll) elevates the level variety from
"all caves" to "biomes".

Required:

- Extract `PSX-Ocean-Surface.zip` → `public/assets/models/env/water.glb`
- New level "sewer-1" with sectors having sub-tile water plane
- Water slows player movement (×0.7)
- Water dampens audio (low-pass filter on SFX while submerged)

**Priority:** Medium-Low. Cool but more engine work.

## E8 — Flamethrower weapon (area-of-effect)

**Status:** Asset ready (`Flamethrower.glb`), engine missing.

The reference clone has no continuous-fire AoE weapon. Adding the
flamethrower opens entirely new combat tactics.

Required:

- 5th weapon slot, hotkey `5`
- Continuous fire while LMB held; consumes fuel (`flamethrowerAmmo`
  pickup)
- Spawns flame particles in a cone in front of the player
- DoT (damage-over-time) tick on any enemy inside the cone
- Lights nearby props on fire (visual only)
- Distinct sustain SFX

**Priority:** Medium.

## E9 — Persistent run history (sql.js)

**Status:** Asset ready (sql.js), infra missing.

Reference resets every browser refresh. OBJEXOOM should persist:

- High-score table (cleared levels × difficulty)
- Total kills across all runs
- Fastest sub-N-second per level
- Difficulty unlocks

Required:

- Add `sql.js` dep, wire WASM via the postinstall pattern from
  `arcade-cabinet/voxel-realms/scripts/prepare-web-wasm.mjs`
- New `src/persistence.ts` w/ schema, query API
- HUD: SCORES panel on landing, last-run summary overlay on death

**Priority:** Medium. Mostly low-risk infra; pairs well with the
WASM-sync task #53.

## E10 — 3D HUD elements

**Status:** Engine missing.

Currently HUD is flat CSS over the canvas. Adding a small
camera-attached overlay layer with a 3D rotating key model in the
corner (when held), spinning ammo cells, etc. would feel native to
the doom-clone-elevated vibe.

Required:

- Second small `<Canvas>` or HUD-camera viewport pass
- Floating mini-key, mini-flashlight, etc.
- Auto-fade-in when relevant pickup is held

**Priority:** Low-Medium. Polish layer.

## E11 — Per-level ambient creature SFX

**Status:** Engine partial.

Tone.js procedural music is wired. Adding **ambient** layers — distant
groans, dripping water, chain rattles — would push the horror feel.

Required:

- New `playAmbientLayer(name)` API in sfx.ts
- Per-level ambient set: corridors → distant groans, sewers → drips,
  arena → wind
- Cross-fades on level transition

**Priority:** Medium.

## E12 — Adaptive resolution / pixel ratio

**Status:** Engine missing (PA16, also listed as a parity GAP).

`gl.setPixelRatio` adjustment based on rolling FPS. Required for
mobile + low-tier desktop.

Required:

- FPS sampler in scene root (rolling 60-frame window)
- If avg < 30 FPS: drop pixel ratio toward 0.5 in 0.1 steps
- If avg > 55 FPS sustained: try raising it back up
- HUD readout (FPS + render scale) in debug mode only

**Priority:** **Critical for mobile.** This is the only true PARITY
gap that blocks the game from running well on cheap hardware.

## E13 — Procedural level generator deepening

**Status:** Engine partial.

Current procedural levels are reliable but generic. Deepening:

- Multiple **archetypes**: corridor maze, arena hub, courtyard,
  sewer, library — each with its own sector shape distribution +
  prop scatter density
- Per-archetype enemy spawn rules (sewer = sewerfiend-heavy, library
  = nun-heavy)
- Theme-aware music mood routing

Required:

- New `src/levelArchetype.ts` w/ archetype enum + sector shape funcs
- `buildMap(seed, level)` extended to pick archetype
- Per-archetype scatter + spawn weights

**Priority:** Medium-High once E3 (decorative scatter) lands.

## Sequencing recommendation

Phase 1 — Critical infra:
1. **E12** (adaptive resolution) — unblocks mobile.
2. **E9** (sql.js + WASM sync) — sets up infra for everything else.

Phase 2 — Mechanical elevation:
3. **E1** (melee slot) — assets already there, mostly engine.
4. **E5** (destructible barrels) — adds tactical depth.
5. **E6** (switches + secret walls) — replayability.

Phase 3 — Visual elevation:
6. **E3** (sector prop scatter) — biggest visual ROI.
7. **E4** (lit lamps with shadows) — pairs with E3.
8. **E2** (bosses) — caps each archetype.

Phase 4 — Polish + variety:
9. **E13** (archetype deepening) — works once E3 + E2 land.
10. **E7** (water + sewer biome).
11. **E8** (flamethrower).
12. **E11** (ambient layers).
13. **E10** (3D HUD elements).

This sequencing is a recommendation, not a contract. Reorder when a
specific dependency surfaces.
