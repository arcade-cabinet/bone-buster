# Review Scope

## Target

The whole production tree of **bone-buster** (a procedural arcade FPS, R3F +
Three.js + Capacitor, ~24k LOC TS/TSX) as of the post-PR-#84 + VIS1/VIS2 state
on branch `feat/overhaul2`. This is the OVERHAUL2 review run — it runs FIRST on
the branch, and EVERY finding is carried forward into `docs/PRD.md` +
`.agent-state/directive.md` as tracked items before implementation.

Recent landed work to scrutinize especially:
- SEED1-5 family two-PRNG seedphrase rewrite (`src/engine/rng.ts`,
  `seedPhrase.ts`, all procedural consumers fork `forkStream(phrase, tag)`).
- CR-H1eng engine decomposition (`src/engine/{mapTypes,gridGen,gridCollision,
  sectors,collisionAny,spawn,projectiles}.ts`).
- CR-H1scene Scene decomposition + the pure `src/store/gameReducer.ts` +
  `src/scene/tick/sceneTick.ts` + `app/views/hooks/useLevelTransition.ts`.
- VIS1/VIS2 lighting flood + Silent-Hill fog (`app/views/Scene.tsx`,
  `src/scene/lighting/archetypePalette.ts`, `WeaponViewmodel.tsx`).

## Files

- `src/**/*.{ts,tsx}` — 245 files (engine, scene, world, ai, store, audio,
  platform, assets, shared, __tests__).
- `app/**/*.{ts,tsx}` — 28 files (views, components, atoms, hooks, styles).

## Flags

- Security Focus: no
- Performance Critical: yes (60fps r3f render budget; mid-tier mobile target)
- Strict Mode: no
- Framework: react-three-fiber (auto-detected)

## Review Phases

1. Code Quality & Architecture
2. Security & Performance
3. Testing & Documentation
4. Best Practices & Standards
5. Consolidated Report

## Run mode

FULLY AUTOMATED end-to-end per explicit user instruction — no checkpoint stops
(user instruction overrides the skill's PHASE CHECKPOINT). All findings → PRD +
directive at the end.
