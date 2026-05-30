# Phase 2 — Security & Performance (OVERHAUL2 review run)

## Security (2A) — LOW RISK client game; 0 prod CVEs; no eval/innerHTML/SQLi; debug hooks gated by NODE_ENV+param; settings validated; no live WASM
- **SEC-1 (Low) Unbounded seed from URL** (app/views/urlFlags.ts:80) — `?bonebusterSeed` uncapped → cyrb128 main-thread stall (+999× via applyArchetypeOverride). Cap ≤200 chars. (= code-review M-6; one-line)
- **SEC-2 (Low) CSP via <meta> not HTTP header** (pages/+onRenderHtml.tsx:133) — `frame-ancestors` ignored in <meta>; GH Pages can't serve headers. Accept as constraint; document in DECISIONS.md; revisit if host moves off Pages.
- **SEC-3 (Low/info) smoke-test URL passes ?bonebusterDebug to prod** (release.yml:126) — no effect (gate holds) but misleading; drop param or add comment.

## Performance (2B) — PRIORITY. Static analysis vs 16.6ms/60fps + OBS3 budgets.
### CRITICAL
- **PERF-1 Enemy AI LOS is O(enemies × sectors × edges) every frame, no cull/throttle.** tickEnemyLoop → tickEnemyFsm → hasLineOfSightAny → castRaySectors = linear scan over every sector×edge, per enemy, 60Hz, no spatial partition/distance gate (rattlers call it TWICE). ~1,920 segment-tests/frame at 16 enemies/20 sectors; ~16,000 at 40/50 → 1-3ms mobile sim BEFORE render. **OVERHAUL2 VIS2b (more sectors at depth) × log-difficulty (more enemies) = the count×count blowup → breaches 30fps mobile floor.** FIX: (1) throttle LOS per enemy (cache sees+lastSeenAt, stagger by id%N, full-rate only when distToPlayer<SHOOT_RANGE — distToPlayer already computed free); (2) distance/horizon gate (skip FSM beyond fog cull dist); (3) sector-AABB broad-phase in castRaySectors (benefits LOS AND fire raycasts). Determinism: stagger cache so aggro latency <150ms.

### HIGH
- **PERF-2 (confirms H-1) pickUvHidden O(n²) re-seed** (src/engine/spawn.ts) — n forkStream seedrandom inits + n(n+1)/2 draws; the re-init is the real cost; scales quadratically with log-difficulty roster (40 enemies = 820 draws + 40 re-seeds level-load hitch). FIX: fork ONCE → boolean array, byte-identical, O(n). SIBLING (Med): tickEnemyFsm gethelp scan is O(n) per acquiring enemy = O(n²) on simultaneous-acquire (ManyEnemies squad) + allocs .filter().map() + uses Math.hypot — use enemyById Map (already built) + squared-distance.
- **PERF-3 VIS1 always-on directional shadow** (app/views/Scene.tsx:897, castShadow shadow-mapSize 1024) — full 1024² shadow pass every frame, frustum covers whole visible area (can't cheaply cull), doubles shadow-caster draw submissions vs MOBILE_CALL_BUDGET 1400. ~1.5-3ms desktop, 4-8ms Pixel 5a — single largest mobile line item; can be the 30fps-floor difference. **I introduced this in VIS1.** FIX: mobile castShadow=false (PSX-jank needs no realtime shadow; contact-blob reads fine) behind the mid-tier check; if kept desktop: 512², tighten frustum to fog horizon, shadow.autoUpdate=false + manual needsUpdate (walls static). A/B in obs3-perf-snapshot-mobile.

### MEDIUM
- **PERF-4 per-enemy mount cost** (EnemyMesh.tsx) — Box3.setFromObject (full traversal) + SkeletonUtils.clone PER enemy; bbox is invariant per GLB → memoize scale on skin.url not per-instance. Linear level-load hitch growing with roster.

### LOW
- **PERF-5 residual per-frame allocs in runSceneTick** (sceneTick.ts:158 prevPlayerPos {}, :312 playerPos {}) — mutate persistent refs in place. Math.hypot (enemyTickLoop.ts:149) → squared-distance.

### CLEAN (verified): InstancedParticlePool (Burst/ShellEject/BodyPart) all pool+compact, 1 draw call each; DamageNumberField fixed (declarative troika, no per-frame sync); EMF/spirit-box gated+throttled+squared-dist; QW1/QW5 fire vectors pooled.

## Critical issues for Phase 3 context (testing)
- PERF-1/PERF-2/PERF-3 all need perf-regression test coverage as enemy/sector counts scale (wire enemy-count + shadow A/B into obs3-perf-snapshot-mobile). The LOS throttle's aggro-latency invariant (<150ms) needs a determinism test.
