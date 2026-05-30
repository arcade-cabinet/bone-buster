# Phase 3 — Testing & Documentation (OVERHAUL2 review run)

## Testing (3A) — strong suite (~1338 unit); main gaps + OVERHAUL2 test shapes
### CRITICAL gaps
- **TEST-1 enemy-bullet integration in runSceneTick UNTESTED** (sceneTick.ts:311-339) — hitPlayer→onHit(ENEMY_BULLET_DAMAGE), hitWall/expired retire, write-compaction: zero coverage. Add 3 tests (provided).
- **TEST-2 ERR1 asset-error modal** — not impl + no tests; test-first (browser-tier route.abort GLB → modal visible + no freeze).
- **TEST-3 STRUCT5 pickNextBiome** — PRD acceptance REQUIRES the 50/30/15/5 weighted-pressure unit test + no-rote-repeat invariant (provided).
- **TEST-4 STRUCT1 MazeGenerator core** — determinism + BFS-connectivity + boundary-walls + min-rooms (provided).
### HIGH gaps
- **TEST-5 non-shotgun weapon determinism in fireResolution** — only shotgun spread pinned; pistol/chaingun/melee/flamethrower skin-profile composition untested (regression risk if Math.random sneaks into chaingun spread).
- **TEST-6 gameReducer clearLevel action untested** (could corrupt going_back→transitioning→next-level).
- **TEST-7 STRUCT2 per-biome generator tests** (determinism/key/boss/biome-features — per-biome describe, provided).
- **TEST-8 STRUCT3 scaleForDepth** (monotonic + logarithmic + clamped + deterministic + PRD baseline, provided).
- **TEST-9 STRUCT4 weapon-upgrade composition** (identity/multiplicative/type-context/bounded, provided).
- **TEST-10 PERF-1 LOS-throttle aggro-latency invariant** (<150ms within throttle+1 frame, provided).
- **TEST-11 trap tick damage path in sceneTick untested.**
- **TEST-12 visual CI gate**: only landing baseline-asserted; for OVERHAUL2 use (a) DOM-structural assertions in the browser tier (ANGLE-GL, no pixel) for HUD layout, (b) pixel-diff in the browser tier not headless-Linux e2e, (c) debug-hook getSceneConfig() to assert fog density/ambient intensity thresholds without GL.
### MEDIUM
- TEST-13 PRNG golden-value snapshot (cyrb128(CANONICAL) + forkStream draw) vs seedrandom version drift.
- TEST-14 gridGen BFS-connectivity assertion (island-encloses-key regression).
- TEST-15 resolveCollision pushout direction/magnitude + corner cases (only "moved" asserted).
- TEST-16 M-5 audio-freeze + M-7 pref-stringify sad-path tests.

## Documentation (3B) — KEY: 3 missing DECISIONS + DESIGN.md contradicts OVERHAUL2 (and DESIGN > PRD in authority!)
### CRITICAL
- **DOC-C1 ARCHITECTURE.md omits the entire src/scene/ subtree** (entities/effects/tick/fields/viewmodel/lighting ~50 files); still says Scene.tsx owns EnemyMesh/KeyMarker/ExitPortal/RealDoor (all extracted). Implementers will look in the wrong place.
- **DOC-C2 ARCHITECTURE.md Pure-TS box omits src/scene/tick/* (sceneTick/enemyTickLoop/fireResolution = sim logic).** Data-flow step 3 says useFrame→tickEnemyFsm but real chain is useFrame→runSceneTick→tickEnemyLoop→tickEnemyFsm.
- **DOC-C3 NO DECISIONS entry for VIS1/VIS2 flood-lighting reversal** — reverses J1 flashlight intent; VIS3 implementer could re-introduce dark-reveal. ADD D22.
- **DOC-C4 NO DECISIONS entry for STRUCT1 map-rep choice (grid vs sector)** — STRUCT1 implementer won't know sector maps/turtle/RefLevelMap/collisionAny dual-dispatch become dead code. ADD D23.
- **DOC-C5 NO DECISIONS for CR-H1scene decomposition** (ARCHITECTURE.md itself says "no binding record yet" — now stale). Extend D16 / add D24.
### HIGH
- **DOC-H1 DESIGN.md "procedural-AND-curated mix" CONTRADICTS STRUCT1** (DESIGN > PRD authority → would mislead). Update to fully-procedural.
- **DOC-H2 DESIGN.md frames archetypes as replayable %5 variants, not biome generators** (contradicts STRUCT2). Update to biomes-as-generators.
- **DOC-H3 DESIGN.md has NO lighting-model description / still implies ink[900] dark ambient** — VIS3 implementer has no target. Add a Lighting-model subsection (flood + tinted fog + blended shadow).
- **DOC-H4 ARCHITECTURE Scene.tsx row lists extracted entities.** DOC-H5 Scene.tsx hasFlashlight JSDoc still says "drop to near-dark" (retired by VIS1). DOC-H6 README URL flags wrong (?debug/?seed=N vs ?bonebusterDebug/?bonebusterSeed=<phrase>). DOC-H7 README/ARCH file-layout tree is pre-decomposition flat.
### MEDIUM/LOW
- DOC-M: DESIGN archetypeRegistry "walk top-to-bottom" wrong post-STRUCT2; ARCH Landing "level pickers" (STRUCT1 removes); ARCH "STO1b pending" (shipped); D16 missing sceneTick.ts; PRD sequencing says STRUCT1-3 (should be 1-5); STATE.md In-flight empty.
- DOC-L: README updated date; BoneBusterLanding→Landing; DESIGN (seed>>>0)%5 → cyrb128; spec 97 uncross-referenced.

## ACTION: before OVERHAUL2 impl — add D22 (VIS lighting), D23 (map-rep), extend D16 (sceneTick); rewrite DESIGN.md §What-it-is/Archetype-identity/Lighting to match OVERHAUL2; refresh ARCHITECTURE.md src/scene/ + data-flow; fix README flags. These are findings → carried into PRD/directive.
