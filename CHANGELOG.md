---
title: Changelog
updated: 2026-05-14
status: current
domain: history
---

# Changelog

All notable changes to this project will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Conventional Commits](https://www.conventionalcommits.org).

## [Unreleased]

### Added

- **POL16 Layered impact particles.** Pre-POL16 damage bursts were 15 violet monocolor motes (visually a single puff). Replaced with 3-layer system: 8 hot impact sparks (3.5-5.5 u/s, 220ms TTL, emissive 3.2×) + 6 gray smoke puffs (slow upward via negative gravity, 700ms TTL, larger radius) + 8 orange ember trails (mid-velocity, 500ms TTL, emissive 2.4×). `Mote` type extended with per-mote TTL/radius/gravity/emissiveIntensity. Other burst kinds (pickup/playerHit/explode) keep pre-POL16 shape; canonical bytes preserved.
- **POL14 Chromatic-aberration pulse on player hits.** New `HitChromaticAberration` postprocessing wrapper replaces the static `<ChromaticAberration>` pass. Holds baseline (0.0015) in steady state — perceptually identical to pre-POL14 — but spikes to ~3.7× (0.0055) on every `playerHit` event and ease-out-cubics back over 180ms. Reads as the screen briefly fracturing under impact. No second pass added; the existing pass's offset is driven per-frame.
- **POL13 Muzzle-flash bloom tier.** New optional `muzzleIntensity` on `WeaponSpec`. Multipliers — melee=0× (swing only), pistol=0.6×, chaingun=0.9×, shotgun=1.4×, flamethrower=1.1×. ObjexoomScene's muzzle-decay block multiplies the baseline by the per-weapon scale, so heavy weapons read as a genuine room-light flash and pistol pops stay punchy not blinding.
- **POL15 Damage-curved screen shake.** Pre-POL15 shake scaled linearly (amount × 0.15). New non-linear curve `0.08·a + 0.018·a^1.7` so light taps stay quiet (1hp → 0.10) and heavy hits punch above the linear baseline (9hp → clamps to SHAKE_MAX faster). Chaingun spray reads as ambient rumble, shotgun pellet barrage snaps the camera.
- **POL10-v2 + POL9-v2 Layered death stings.** Boss-down and player-death stings rebuilt as 3-layer cues. Boss: sub-bass thud (boomSynth at C1) + 4-note ascending tonal resolve (G1 → D2 → G2 → D3) + ambient swell (ambientDrone retriggered at C2). Player: sub-bass thud (A0, deeper than boss) + 4-note descending tonal (E3 → B2 → E2 → A1, wider interval) + reverb tail (masterReverb wet briefly pushed to 0.5 then ramped back). Replaces pre-v2 isolated 2-note / 3-note PluckSynth sequences with the layered weight + resolution + room-tone cue that reads as modernized-DOOM caliber.
- **POL11-v2 Modernized-DOOM damage numbers.** New `DamageNumberField` rendered alongside other in-world effects. Tier-colored by damage magnitude (cool parchment → warm amber → hot ember → incandescent kill-amber), punch-in scale animation 1.25× → 1.0× ease-out quad over 140ms, kill-confirms boost upward velocity from 1.4u/s → 2.4u/s and prepend a "✦" bullet glyph. Crit-stack consolidation: `damageNumber` event carries `enemyId`, same-enemy hits within 350ms merge into the existing pool slot — 8 shotgun pellets read as one growing label, not 8 stacked numbers. Drop-shadow + outline for legibility on any backdrop. 24-number pool cap.
- **POL10 Boss-down sting.** Ascending G1 → C2 'triumph chord' on the deathSynth, distinct from both skeleton-death (descending) and player-death (descending three-note). Layered on top of the standard skeleton-death sting when ≥1 boss died in the shot.
- **POL9 Player-death sting.** Slow descending E2 → B1 → E1 sequence on the existing deathSynth, distinct from the skeleton-death two-note cascade. Fires on both HP-zero transition and fellToDeath path.
- **POL8 Tone.js audio-time collision protection.** Shared jitter() helper bumps Tone.now() by 1ms on collision; protects chaingun/flamethrower/aggro/hurt/death voices.
- **POL7 HUD archetype label.** Top-left readout extends from `M1` to `M1 · CORRIDOR` so the player learns the 5 archetype names through play.
- **E13 step-16 Per-archetype large-prop density.** DENSITY_BY_ARCHETYPE for COV2 vehicle/wreck anchor pieces. Library narrows to [0,1]; others preserve [1,2].
- **Help pane describes the 5 archetypes.** HOW TO PLAY landing screen gains a per-archetype blurb so players know what to expect before encountering each flavor.
- **Tip carousel expanded** from 4 to 9 tips, covering archetype awareness, secrets, loot mechanics, and environment hazards.
- **YOU DIED + LEVEL COMPLETE cards show run stats.** Three of four overlay-card states now surface formatRunStats (was just PAUSED + MISSION COMPLETE).

### Fixed

- **README, CLAUDE.md test counts unstaled** to 498+ unit / 51+ suites / 6 browser.
- **docs/PRD.md `Status at a glance` rewritten** — the Not-yet-shipped list named items shipped 100+ commits ago.

- **POL6 Best-run chip on landing.** Async-opens runHistory on landing mount; renders `BEST {N}L · {N}K · {WON/DIED} · {N} SECRETS · {N} RUNS` below the menu. Hidden when no runs persisted (canonical byte-stability preserved).
- **POL5 Secrets in run history.** RunRecord/RunInsert extended with `totalSecrets`. Additive ALTER TABLE migration in ensureSchema with try/catch (sql.js IF-NOT-EXISTS-on-ALTER fallback).
- **POL4 Secrets HUD + RunStats integration.** New `runTotalSecrets` field + `secretFound` action. ObjexoomShell listens for `secretTriggered` event. HUD shows `SECRETS N` below KILLS/SCORE (hidden at 0). Win-screen summary gains `N SECRET[S]` segment.
- **E13 steps 6-15 Per-archetype identity tightening.** 10 distinct axes routed through `ArchetypeLightPalette` and per-archetype tables: prop density, debris density, decal density, decal pool, enemy count multiplier, pickup count multiplier, lamp-light color, hemisphere sky/ground, water tint, canvas background. Corridor preserves canonical literals on every axis so refLevel 0 byte-stability is intact.
- **COV3 steps 2-8 Modular structures end-to-end.** Wall GLBs on every map (ref + procedural), per-archetype wall pools, per-archetype floor + ceiling tints on both sector and grid paths. 14 wall GLBs from PSX Mega Pack II Modular Structures (`hr_*`, `hs_*`, `rg_*`, `rtx_*`, `rx_*` families).
- **`ScheduleWakeup`-at-end-of-turn forbidden in /loop dynamic mode.** Directive preamble + global memory rule. Stops the agent from politeness-disguised stops via the wakeup tool.
- **DS.7 Design tokens in scene materials.** Zero literal hex codes remain in `src/scene/**/*.tsx`. Added 14 semantic anchors to `OBJEXOOM_PALETTE` covering wall variants, door colors, flashlight warmth, weapon untextured-fallback metals, ammo brass, treasure-chest woods, and ExitPortal hue variants. Brand-color tweaks now ripple to the 3D scene with a single edit to the design-tokens module.
- **PA9b Chaingun shell ejection.** Extended `ShellEjectField` to dispatch shells on chaingun fires (was shotgun-only). Chaingun shell renders at 0.6× scale with slightly reduced lateral/upward velocity; ~11/sec at the chaingun's 90ms cooldown. `MAX_SHELLS` raised 40 → 80 to handle the burst rate. Reference clone's behavior is now fully matched.
- **E5 Destructible barrels with AoE damage.** Pure-sim core in `src/barrels.ts` (spawn, ray-test, AoE resolve). Fire-path prioritizes barrels over enemies when both are on the ray. Chain reactions via queue. 5-variant skin pool (4 metal weathering + 1 wooden) cycled by id. 14 new unit tests. ([688104d](https://github.com/objexiv/objexoom/commit/688104d))
- **3DPSX asset coverage maximization principle.** User directive 2026-05-14: "I want as much possible value from ALL the PSX assets — anything that makes sense in a level." STANDARDS.md, PRD.md, and the directive's COV1-COV14 queue encode the principle: every new feature uses a multi-variant pool, seeded by id.
- **E1 Melee weapon slot.** BLADE (machete viewmodel), slot 1, 1.6-tile range, 55 dmg, 420ms cooldown, infinite ammo. Procedural white-noise whoosh SFX via `playMelee`. `baseOwnedWeapons()` helper consolidates the per-run loadout literals. ([8d71475](https://github.com/objexiv/objexoom/commit/8d71475))
- **E9 Persistent run history.** `src/runHistory.ts` opens a sql.js DB lazily on first run-end, serialized as base64 in localStorage. Schema includes start/end ts, levels cleared, total kills, total damage taken, level set, outcome. Public API: `insert`, `listRecent`, `bestRun`, `runCount`, `clear`. Real-Chromium browser test covers persistence across reopens. ([5d74778](https://github.com/objexiv/objexoom/commit/5d74778))
- **E12 Adaptive resolution.** `src/scene/effects/AdaptiveResolution.tsx` — 60-frame rolling FPS sampler with 2-window debounce drops `gl.setPixelRatio` toward 0.5 floor on sustained <30 FPS, raises toward `devicePixelRatio` cap on sustained >55 FPS. Debug HUD readout `FPS N • DPR x.xx` under `?objexoomDebug`. **Closes the last critical-tier reference parity gap.** ([57dd8fa](https://github.com/objexiv/objexoom/commit/57dd8fa))
- **Asset infra.** `scripts/prepare-web-wasm.mjs` (postinstall + prebuild) and `scripts/verify-runtime-assets.mjs` (CI gate, 22 URLs / 8.01 MB total). ([81ed15d](https://github.com/objexiv/objexoom/commit/81ed15d))
- **`docs/PRD.md`** comprehensive remaining-work spec covering Phases 2-4 of the elevation roadmap plus B1.7/B2.1/B2.4/DS.7/AO.4-6/PA9b/PA-MOD7/INF2.

### Changed

- **100% reference parity reached.** PARITY.md banner updated; only "partial → full" upgrade items remain (shell ejection on chaingun fires).
- **Dropped arbitrary byte budgets from `verify-runtime-assets.mjs`.** The per-category limits (enemies 3MB, weapons 800KB, props 600KB) were quality-crippling — they forced the BLADE viewmodel and barrel.glb onto thinner variants when richer ones were available. The script still reports per-category totals; asset weight is a per-asset tuning decision, not a CI threshold. ([688104d](https://github.com/objexiv/objexoom/commit/688104d))

## [0.2.0](https://github.com/objexiv/objexoom/compare/v0.1.0...v0.2.0) (2026-05-14)


### Features

* initial standalone repo extracted from objexiv/objexiv ([624d7ae](https://github.com/objexiv/objexoom/commit/624d7ae45b78bc23238a85a85bb475a7460851e7))


### Bug Fixes

* add pnpm lockfile and fix lint/type errors for CI ([#11](https://github.com/objexiv/objexoom/issues/11)) ([93e7fd6](https://github.com/objexiv/objexoom/commit/93e7fd64bcf2c86ca538db6d5b8f6f0dcef383df))

## [0.1.0] — 2026-05-13

### Added

Initial standalone release. OBJEXOOM was incubated as an easter egg inside `objexiv/objexiv` on the `feat/objexoom-easter-egg` branch and extracted into its own repo once it grew large enough to maintain on its own cadence. Brought across:

- Full game shell: landing menu, difficulty + level select, debug-hooked main loop, HUD, mission complete + game over overlays.
- Procedural sector + grid map engine, key-and-RealDoor `going_back` phase machine, lava damage, weapon switching, pickup spawning.
- Real 3DPSX assets: skeleton, knight, bat, plus an expanded horror roster (sewerfiend, plague doctor, elk demon, abomination ×2, anomaly, horned, nun, alien, clowns). Per-kind skin picked deterministically by enemy id.
- Three textured viewmodel weapons (handcannon, flamethrower, shotgun) plus a melee weapon family ready for a future melee slot.
- yuka-driven AI: per-enemy GameEntity registry, steering, Pursuit lead-target for imp kind.
- Tone.js procedural audio: 6-voice music with mood switching, SFX bank, panning.
- Vite + React 19 + react-three-fiber + three.js + Capacitor stack.
- Five canonical screenshots captured via headless Chromium + ANGLE-GL backend (NOT default SwiftShader, which deadlocks on the shadow-map composite).
- FBX→GLB pipeline via `scripts/convert-fbx.mjs` so future FBX-only horror packs can be brought in without manual conversion.
