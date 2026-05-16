---
title: Restructure plan — app/ + src/ migration
updated: 2026-05-15
status: current
domain: technical
---

# RESTRUCTURE plan — app/ + src/ migration

Mechanical file-by-file mapping from the current pre-RESTRUCTURE
shape to the canonical arcade-cabinet `app/` + `src/` layout
(reference: `~/src/arcade-cabinet/voxel-realms/{app,src}`).

This document is the input contract for RS2–RS6. Every entry
below names ONE current file and ONE target path. No fan-out, no
splits — splits happen as separate post-RESTRUCTURE work.

## Bucket conventions

### `app/` — UI surfaces (`.tsx` with JSX, plus their CSS)

| Bucket | Owns |
|---|---|
| `app/atoms/` | Smallest stateless components (Button, Chip, Pip). One concern each. |
| `app/components/` | Composite UI built from atoms. Stateful when needed. |
| `app/hooks/` | Reusable React hooks. JSX-aware. |
| `app/views/` | Page-level/top-level screens (Landing, Shell, HUD, Scene). |
| `app/styles/` | Global CSS + design-token CSS bridges. |
| `app/test/` | UI testing helpers (render harness, mock providers). |

### `src/` — Domain code (`.ts`, NO JSX)

| Bucket | Owns |
|---|---|
| `src/ai/` | Enemy AI + Yuka integration. |
| `src/assets/` | Asset URL routing + GLB loaders + preload manifests. |
| `src/audio/` | Sample bus, sprite registry, music graph. Post-AUDIO this is the Howler facade. |
| `src/engine/` | Engine clock, event bus, deterministic systems (PRNG facade). |
| `src/platform/` | Capacitor wrappers (preferences, sqlite, deeplink). |
| `src/scene/` | r3f-adjacent pure-TS scene state (lighting palettes, entity pools, tick loops). |
| `src/shared/` | Cross-cutting types + small utilities (constants, math, formatting). |
| `src/store/` | Settings + persistence + run history. The thin layer between platform/ and views/. |
| `src/world/` | Procedural world generation: archetype registry, scatter, map shape, structures, doors, traps, decals, debris. |

## File-by-file mapping

### Current top-level `src/*.{ts,tsx}` → new homes

| Current | New | Why |
|---|---|---|
| `src/BoneBusterWordmark.tsx` | `app/atoms/Wordmark.tsx` | Stateless SVG atom. |
| `src/ScuffShader.tsx` | `app/atoms/ScuffShader.tsx` | Stateless canvas atom. |
| `src/ObjexoomLanding.tsx` | `app/views/Landing.tsx` | Top-level screen. |
| `src/ObjexoomShell.tsx` | `app/views/Shell.tsx` | Top-level screen (game host). |
| `src/ObjexoomHUD.tsx` | `app/views/HUD.tsx` | Top-level overlay screen. |
| `src/ObjexoomScene.tsx` | `app/views/Scene.tsx` | Top-level r3f canvas host. |
| `src/PlayerController.tsx` | `app/components/PlayerController.tsx` | r3f-aware composite. |
| `src/RefLevelMap.tsx` | `app/components/RefLevelMap.tsx` | Map rendering composite. |
| `src/refLevel.ts` | `src/world/refLevel.ts` | Procedural level data. |
| `src/archetype.ts` | `src/world/archetype.ts` | World shape types. |
| `src/archetypeMapShape.ts` | `src/world/archetypeMapShape.ts` | World shape. |
| `src/archetypeRegistry.ts` | `src/world/archetypeRegistry.ts` | World shape. |
| `src/buildMap.ts` | `src/world/buildMap.ts` | World gen entry. |
| `src/structures.ts` | `src/world/structures.ts` | World gen. |
| `src/doors.ts` | `src/world/doors.ts` | World gen. |
| `src/traps.ts` | `src/world/traps.ts` | World gen. |
| `src/kitchen.ts` | `src/world/kitchen.ts` | World gen archetype content. |
| `src/nature.ts` | `src/world/nature.ts` | World gen archetype content. |
| `src/npcs.ts` | `src/world/npcs.ts` | World gen archetype content. |
| `src/largeProps.ts` | `src/world/largeProps.ts` | World gen scatter inputs. |
| `src/debris.ts` | `src/world/debris.ts` | World gen scatter inputs. |
| `src/decals.ts` | `src/world/decals.ts` | World gen scatter inputs. |
| `src/loot.ts` | `src/world/loot.ts` | World gen scatter inputs. |
| `src/secrets.ts` | `src/world/secrets.ts` | World gen. |
| `src/lampScatter.ts` | `src/world/lampScatter.ts` | World gen scatter. |
| `src/floorTextures.ts` | `src/world/floorTextures.ts` | World gen visual config. |
| `src/barrels.ts` | `src/world/barrels.ts` | World gen entity inputs. |
| `src/vehicles.ts` | `src/world/vehicles.ts` | World gen entity inputs. |
| `src/meleeSkins.ts` | `src/world/meleeSkins.ts` | World gen visual config. |
| `src/models.ts` | `src/assets/models.ts` | GLB manifest. |
| `src/preload.ts` | `src/assets/preload.ts` | Asset preload manifest. |
| `src/assetUrl.ts` | `src/assets/assetUrl.ts` | Asset URL router (`A()`). |
| `src/sfx.ts` | `src/audio/sfx.ts` | SFX entry. Becomes Howler facade post-AUDIO. |
| `src/audioBus.ts` | `src/audio/audioBus.ts` | Audio bus. |
| `src/engine.ts` | `src/engine/engine.ts` | Engine clock + tick loop. |
| `src/events.ts` | `src/engine/events.ts` | Event bus. |
| `src/prng.ts` | `src/engine/prng.ts` | Deterministic PRNG facade. |
| `src/constants.ts` | `src/shared/constants.ts` | Cross-cutting constants. |
| `src/fadeTriggers.ts` | `src/shared/fadeTriggers.ts` | Fade enum + helpers. |
| `src/enemyAi.ts` | `src/ai/enemyAi.ts` | Enemy AI. |
| `src/enemyMix.ts` | `src/ai/enemyMix.ts` | Enemy spawn mixer. |
| `src/yukaIntegration.ts` | `src/ai/yukaIntegration.ts` | Yuka adapter. |
| `src/yuka.d.ts` | `src/ai/yuka.d.ts` | Type declarations. |
| `src/turtle.ts` | `src/ai/turtle.ts` | Turtle drone NPC. |
| `src/runStats.ts` | `src/store/runStats.ts` | Run-stat reducer. |
| `src/runHistory.ts` | `src/store/runHistory.ts` | Persisted run history. |
| `src/settings.ts` | `src/store/settings.ts` | Settings types + defaults. |
| `src/weapons.ts` | `src/shared/weapons.ts` | Weapon catalog + types. |
| `src/index.ts` | `app/main.tsx` (already present) + delete `src/index.ts` | Boot entry already lives in `app/`. |

### Current sub-buckets — already partially RESTRUCTURE-shaped

| Current | New | Why |
|---|---|---|
| `src/design-tokens/` | `app/styles/tokens/` | Design tokens are UI-layer. |
| `src/hud/overlays/` | `app/views/hudOverlays/` | UI overlays. |
| `src/lighting/` | `src/scene/lighting/` | Scene-layer config. |
| `src/persistence/` | `src/platform/persistence/` | Capacitor adapter layer. |
| `src/scatter/` | `src/world/scatter/` | World gen scatter. |
| `src/scene/` | `src/scene/` | Already correctly named — no move. |
| `src/__tests__/` | `src/__tests__/` | Stays put; tests mirror their target buckets. |

### Files NOT moving in this pass

- `app/main.tsx`, `app/global.css`, `app/tokens.css`, `app/fonts.css` — already in canonical layout.
- `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `package.json` — root files unaffected.
- `public/**`, `references/**`, `raw-assets/**`, `scripts/**`, `tests/**` — not in scope.
- `android/**`, `ios/**`, `capacitor.config.ts` — native shell unchanged.

## Per-step commit plan (RS3 execution)

One commit per bucket so reviewers see one chunk at a time. Each
commit ends with a green `pnpm verify`. Order picked so the
dependency graph stays buildable between commits — leaf modules
move first, top-level surfaces last.

1. **rs3a — shared + engine** : `constants.ts`, `fadeTriggers.ts`, `weapons.ts` (shared); `engine.ts`, `events.ts`, `prng.ts` (engine).
2. **rs3b — ai** : `enemyAi.ts`, `enemyMix.ts`, `yukaIntegration.ts`, `yuka.d.ts`, `turtle.ts`.
3. **rs3c — assets + audio** : `models.ts`, `preload.ts`, `assetUrl.ts`; `sfx.ts`, `audioBus.ts`.
4. **rs3d — world** : `archetype*.ts`, `buildMap.ts`, `structures.ts`, `doors.ts`, `traps.ts`, `kitchen.ts`, `nature.ts`, `npcs.ts`, `largeProps.ts`, `debris.ts`, `decals.ts`, `loot.ts`, `secrets.ts`, `lampScatter.ts`, `floorTextures.ts`, `barrels.ts`, `vehicles.ts`, `meleeSkins.ts`, `refLevel.ts`, plus `src/scatter/ → src/world/scatter/`.
5. **rs3e — store + platform** : `settings.ts`, `runStats.ts`, `runHistory.ts`, `src/persistence/ → src/platform/persistence/`.
6. **rs3f — scene** : `src/lighting/ → src/scene/lighting/`.
7. **rs3g — app surfaces** : the four `Objexoom*.tsx` + `BoneBusterWordmark.tsx` + `ScuffShader.tsx` + `PlayerController.tsx` + `RefLevelMap.tsx` into `app/views/`, `app/atoms/`, `app/components/`.
8. **rs3h — design tokens + HUD overlays** : `src/design-tokens/ → app/styles/tokens/`, `src/hud/overlays/ → app/views/hudOverlays/`.

Each commit:
1. `git mv` the files.
2. Run a `sed -i` import-rewrite pass (script: `scripts/restructure-imports.mjs` authored in RS2).
3. `pnpm verify`.
4. Commit. Body lists every moved file with its new path.

## Open questions answered upfront

- **Why `src/world/` for `meleeSkins.ts` (a visual config)?** Because it's pure-TS visual-config metadata consumed by world generation, not by a React component. The pattern is "if a `.tsx` reaches for it directly, it's app/; if only world gen + scatter consume it, it's src/world/".

- **Why not split `enemyAi.ts` into multiple files?** Splitting is non-mechanical work that belongs in a separate refactor lane. RESTRUCTURE is `git mv` + import rewrites only.

- **Why isn't there an `app/components/hud/` sub-bucket?** The HUD is a top-level view, not a composite of components. Overlays live under `app/views/hudOverlays/` because they're functionally siblings of HUD.tsx, not pluggable UI primitives.

- **What about the `src/scene/` subtree (effects/entities/hooks/hud/map/tick/viewmodel)?** Stays put. It's already in the canonical layout. The RS6 docs pass updates references to it.

- **Will tests need re-pathing?** `src/__tests__/` stays under `src/` because the tests live alongside the modules they cover. Imports inside the tests get rewritten by the same `sed` pass as the production code.
