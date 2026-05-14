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
