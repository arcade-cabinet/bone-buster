# Comprehensive Code Review Report — OVERHAUL2 run (2026-05-29)

## Review Target
Whole src/ + app/ tree (~24k LOC, R3F/Three.js/Capacitor TS game), post-#84 + VIS1/VIS2, branch `feat/overhaul2`. Run FIRST on the branch per the user's directive; all findings carried into PRD + directive before implementation.

## Executive Summary
The codebase is in genuinely good shape — the SEED family-PRNG, engine/scene decomposition, gameReducer/effects split, and InstancedMesh pooling are well-executed. There are **no security criticals** (low-risk client game, 0 prod CVEs). The findings cluster into two themes: (1) a small set of **prep-work items that must land BEFORE the OVERHAUL2 STRUCT/HUD features** or those features will inherit and amplify existing debt (layer inversion of domain types, the grid-vs-sector map duality, scattered per-biome conditionals, a perf count×count blowup, missing exhaustiveness guards); and (2) **the deploy/perf/visual CI gates need hardening** so OVERHAUL2's count-scaling + visual changes can't regress silently.

## Findings by Priority

### P0 — CRITICAL (must address; several gate OVERHAUL2 feature work)
- **PERF-1 (perf): enemy LOS is O(enemies×sectors×edges) every frame, no cull/throttle.** OVERHAUL2's depth-scaling (more enemies) × VIS2b (more sectors) = count×count blowup → breaches 30fps mobile floor. Throttle+distance-gate LOS, sector-AABB broad-phase. → directive PERF1.
- **ARCH-C1 (arch): domain types (GameState/GameRef/WeaponState/...) defined in the UI god-component, imported DOWN into pure layers.** Blocks STRUCT4 (grows WeaponState → tests import React). Extract to src/store/gameState.ts. → directive PREP-C1.
- **ARCH-C2 (arch): pure reducer has a RUNTIME value-dep on app/views/gameConstants.** Move gameConstants → src/store. Cheapest, do first. → PREP-C2.
- **DOC-C3/C4/C5: missing DECISIONS for VIS1/VIS2 lighting reversal, STRUCT1 map-rep, CR-H1scene** + **DESIGN.md actively contradicts OVERHAUL2** (DESIGN>PRD authority → would mislead implementers). Add D22/D23, extend D16, rewrite DESIGN §what-it-is/archetype/lighting. → PREP-DOC.
- **TEST-1: enemy-bullet integration in runSceneTick UNTESTED** (active combat damage path). Add tests now. → directive TEST1.
- **CI-1: Pages deploy-staleness has no automated guard** (the class behind the 2-week-stale incident). Continuous-deploy on push:main. → directive CI1.

### P1 — HIGH
- **ARCH-H1/H2: buildMap/generateMap monolith + per-biome logic scattered as `if(archetype!=="x")` across ~10 modules** — the chief obstacle to STRUCT2 extensibility; the biome-generator migration must CONSOLIDATE this. → shapes STRUCT1/STRUCT2.
- **ARCH-M1 (high-impact): grid-vs-sector duality is a hindrance** — STRUCT1 must pick one representation (DECISIONS), not leave a dead one. → PREP + STRUCT1.
- **ARCH-M2: STRUCT1↔STRUCT5 biome-source CONFLICT** (phrase-hashed vs pressure-selected). Reconcile: biome becomes a generator INPUT. → STRUCT5 design note (user-confirmed pressure-selected).
- **ARCH-M3: no `depth` param reaches the generator; difficulty plumbing inconsistent.** STRUCT3 needs buildMap(seed,biome,depth,difficulty) + scaleForDepth. → STRUCT3.
- **PERF-2 (=H-1): pickUvHidden O(n²) re-seed** — fork once → array, byte-identical. → directive PERF2.
- **PERF-3: VIS1 always-on directional shadow** (I introduced) — 1024² shadow pass every frame, 4-8ms Pixel 5a; mobile castShadow=false. → directive PERF3.
- **BP-1: WaterSurface DataTexture leak** — dispose; compounds with biome water. → directive BP1.
- **CI-2/CI-3: mobile-perf gate label-opt-in + no enemy-count/shadow A/B** — promote to required + add A/B probes (catches PERF-1/PERF-3). → directive CI2/CI3.
- **TEST-5/6: non-shotgun weapon determinism + gameReducer clearLevel untested.**
- **DOC-H1..H7: DESIGN.md procedural-AND-curated + archetype-%5 framing; ARCHITECTURE.md omits src/scene/; README flags wrong.**
- **CI-4: CodeQL absent.**
- **OVERHAUL2 test shapes (TEST-2..10): ERR1 modal, MazeGenerator, biome generators, scaleForDepth, weapon-upgrade composition, pickNextBiome 50/30/15/5, LOS-throttle aggro-latency** — write test-first per implementation.

### P2 — MEDIUM
- Code: M-1 debrisScatter bbox dup; M-5 onStartGame audio-rejection freeze; M-6 seed URL length cap; M-7 writeJsonPref swallow; M-3 SceneTickDeps 33 fields; M-8/M-9 Scene/Shell god-components (hook extraction).
- BP: BP-2 assertNever; BP-3 stateRef stale-read HUD constraint; BP-4 useFrame priority; BP-5 InstancedField multi-material; BP-6 asset ErrorBoundary (=ERR1).
- CI: CI-5 canvas-visible assertion in e2e; CI-6 require_run glob app/views/**; CI-7 verify-deploy canvas assert; CI-8 dangerouslySetInnerHTML ban; CI-10 assetError telemetry (folds into ERR1); CI-9 SHA-pin.
- Test: TEST-13 PRNG golden snapshot; TEST-14 BFS connectivity; TEST-15 resolveCollision pushout; TEST-16 sad-path tests.
- Sec: SEC-1 seed cap (=M-6); SEC-2 CSP-meta (document); SEC-3 smoke-URL comment.

### P3 — LOW
- L-1 gridGen inline arrays; L-2 reduceWin magic ammo; L-3/L-4/L-5/L-6 (as-any, nondeterminism comment, layer viol, HUD console.warn); BP-8..13; CI-11..14; DOC-M/L.

## Findings by Category
- Code Quality: 1 High, 9 Med, 6 Low
- Architecture: 2 Critical, 3 High, 3 Med, 2 Low
- Security: 3 Low (calibrated client-game)
- Performance: 1 Critical, 2 High, 1 Med, 1 Low
- Testing: 4 Critical (incl. 3 OVERHAUL2-feature), 8 High, 4 Med
- Documentation: 5 Critical (3 missing DECISIONS + 2 stale ARCH), 7 High, 8 Med/Low
- Best Practices/Framework: 1 High, 6 Med, 6 Low
- CI/CD: 4 High, 6 Med, 4 Low

## Recommended Action Plan (folds into the OVERHAUL2 directive)
**PREP (before STRUCT/HUD features), in order:**
1. CI-1 continuous-deploy (1-line if:) + CI-2 mobile-perf required.
2. ARCH-C2 move gameConstants→src/store; ARCH-C1 extract domain types→src/store/gameState.ts.
3. DECISIONS D22 (VIS lighting), D23 (map-rep choice), extend D16; rewrite DESIGN.md to match OVERHAUL2; refresh ARCHITECTURE.md.
4. ARCH-M2/STRUCT1↔5 reconciliation: biome = generator input (pressure-selected) — already user-confirmed.
5. PERF-1 LOS throttle + PERF-2 pickUvHidden + PERF-3 mobile shadow-off + BP-1 WaterSurface dispose + CI-3 A/B probes (the perf safety net).
6. BP-2 assertNever, BP-6/ERR1 asset ErrorBoundary+modal+telemetry, BP-3 stateRef HUD constraint doc.

**Then the OVERHAUL2 features** (ERR1 → VIS4/VIS3/VIS5 → HUD1-3 → STRUCT1-5) each land with their test-first shape (TEST-2..10) + visual verification (read ANGLE-GL screenshots) + the hardened gates.

## Review Metadata
- Date: 2026-05-29
- Phases: 1 (quality+arch), 2 (security+perf), 3 (testing+docs), 4 (best-practices+CI/CD), 5 (this report)
- Flags: performance-critical, framework=react-three-fiber, automated-no-checkpoint
- Agents: comprehensive-review:code-reviewer, architect-review, security-auditor; performance-optimizer; test-automator; general-purpose(docs); typescript-pro; deployment-engineer
