# Phase 1 — Code Quality & Architecture (OVERHAUL2 review run)

## Code Quality (1A) — see 01a-code-quality.md for full detail
HIGH: H-1 pickUvHidden O(n²) (spawn.ts).
MED: M-1 debrisScatter bbox dup; M-2 Shell.tsx type exports→leaf; M-3 SceneTickDeps 33 fields; M-4 patrolBearing 1.732 magic; M-5 onStartGame uncaught audio rejection freezes UI; M-6 readSeedPhraseFromUrl no length cap; M-7 writeJsonPref swallows stringify fail; M-8 Scene.tsx 86 hooks; M-9 Shell.tsx 22 effects.
LOW: L-1 gridGen inline archetype arrays; L-2 reduceWin +4/+10 magic ammo; L-3 bindSlot as-any; L-4 ParticleBurstField nondeterminism comment; L-5 app/→src layer violation (GameRef); L-6 HUD console.warn render path.

## Architecture (1B)
### CRITICAL
- **C1 — domain types defined in the UI god-component, imported DOWN into pure layers.** GameState/GameRef/WeaponState/LevelPhase/FadeKind live in app/views/Shell.tsx (1065 LOC), imported by src/store/gameReducer, src/scene/tick/*, useGameRef, src/shared/fadeTriggers. Layer inversion (mostly `import type` so no runtime cycle, but conceptually backwards). BLOCKS STRUCT4 (grows WeaponState → tests would import React). FIX: extract to src/store/gameState.ts (or @engine/gameTypes), all importers move same commit. DO BEFORE STRUCT4.
- **C2 — pure reducer has a RUNTIME value-dep on the UI layer.** gameReducer.ts imports GOING_BACK_BUDGET_MS from @views/gameConstants — real edge src/store→app/views. FIX: move gameConstants.ts → src/store/gameConstants.ts (clean leaf relocation). DO FIRST (cheapest, kills the inversion; STRUCT3/5 tunables then have a correct home).

### HIGH
- **H1 — buildMap/generateMap/loadRefLevel split is the WRONG seam for biome generators.** generateMap is a 376-line monolith doing carve+BFS+placement + 5 inline per-archetype tables; archetype only varies params, no per-biome structure/logic. STRUCT1 maze-core extraction is moderate (carve/BFS already factored); STRUCT2 is hard. FIX: extract MazeGenerator core (src/engine/maze.ts, archetype-free skeleton); per-biome generators compose it; delete gridGen's inline tables.
- **H2 — per-biome logic scattered as `if(archetype!=="x")return[]` self-gating across ~10 modules** (npc/nature/kitchen/largeProp/debris/prop/decal/trap scatter + gridGen tables + archetypeMapShape + palette + Scene unconditional spawn calls). Shotgun-surgery anti-pattern; adding a 6th biome = editing ~10 Record<PropArchetype> tables. THE biggest obstacle to STRUCT2's extensibility goal. FIX: each biome module owns a manifest of its scatter/density/hazard/trigger set; scatter renderers become dumb; the `!=="x"` guards GO AWAY.
- **H3 — Scene.tsx (1040 LOC/86 hooks) + Shell.tsx (1065/58 hooks) god-components.** STRUCT2 triggers + STRUCT4 HUD + STRUCT5 pressure all want to land here. FIX: a <BiomeContent map> slot boundary for biome content; useBiomeSelection hook beside useLevelTransition; C1/C2 removes ~90 Shell lines.

### MEDIUM
- **M1 — grid-vs-sector map duality is a HINDRANCE for biomes.** STRUCT1 makes all runs procedural (grid) but the richer features (water/secrets/modular walls/polygonal sectors) live ONLY on the sector type → procedural biomes stuck on the poorer grid rep. Don't ship STRUCT1 leaving a dead second representation. DECISION NEEDED (DECISIONS.md): (a) MazeGenerator emits sector maps, retire grid; or (b) extend grid with height/water/secret, retire sector. Resolve in STRUCT1.
- **M2 — biome identity derived 4+ ways (buildMap, gridGen inline dup, archetypeForPhrase, loadRefLevel); fragile CANONICAL→idx0 invariant.** STRUCT1↔STRUCT5 LATENT CONFLICT: STRUCT1 hashes phrase→archetype; STRUCT5 wants pressure-weighted selection. RECONCILE WITH USER: biome should become a generator INPUT (pressure-selected), not phrase-derived. buildMap/generateMap take `biome` param + stop hashing.
- **M3 — difficulty plumbing inconsistent + no `depth` param reaches the generator.** generateMap ignores difficulty (fixed enemy count); loadRefLevel uses it. STRUCT3 needs depth→generator. FIX: unified buildMap(seedPhrase, biome, depth, difficulty) + one tested scaleForDepth(depth,difficulty).

### LOW
- **L1 — src/shared + src/scene import @styles tokens from app/** (~18 files; wrong-direction but pure const data). Consider moving palette data to src/design/.
- **L2 — ARCHITECTURE.md stale** (no src/scene/ subtree, no src/scene/tick sim layer; missing DECISIONS for Scene decomposition + map-rep choice). Refresh in STRUCT lane.

### PREP ORDER before STRUCT features: C2 (leaf move) → C1 (type extract) → M1 decision (DECISIONS.md map-rep) → M2/STRUCT1↔5 reconciliation (user). Then STRUCT1 maze-core, STRUCT2 biome modules absorb H2's scattered conditionals.

## Critical issues for Phase 2 context
- Perf: H-1 O(n²) spawn; ParticleBurstField allocation; Scene.tsx 7 useFrame + 86 hooks render cost.
- The asset-load silent-failure (ERR1, already tracked) is the main error-handling gap; M-5 (audio freeze) + M-7 (pref swallow) are secondary swallowed-error sites.
