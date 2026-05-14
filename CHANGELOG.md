# Changelog

All notable changes to this project will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Conventional Commits](https://www.conventionalcommits.org).

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
