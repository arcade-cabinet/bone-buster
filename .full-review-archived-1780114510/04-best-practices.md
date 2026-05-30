# Phase 4 — Best Practices & Standards (OVERHAUL2 review run)

## Framework/Language (4A) — TS 6 / React 19 / R3F 9 / Three 0.184
### HIGH
- **BP-1 WaterSurface DataTexture leak** (src/scene/map/WaterSurface.tsx) — DataTexture in useMemo, never disposed; leaks GPU tex per map load. Compounds with OVERHAUL2 biome water sectors. FIX before biome work: useEffect(()=>()=>tex.dispose(),[tex]).
### MEDIUM
- **BP-2 gameReducer + drain() switches lack assertNever exhaustiveness** — STRUCT4 adds GameAction/GameEffect variants → silent runtime miss. Add default: assertNever(action,"GameAction") + same for e.kind/e.sound.
- **BP-3 useGameRef stateRef.current mutation = React-19 scheduling footgun** — game logic uses stateRef.current (fine) but any NEW OVERHAUL2 HUD component reading the `state` PROP will see stale/lagging values under concurrent render. CONSTRAINT: feed HUD components stateRef.current via store-forwarded ref or useSyncExternalStore, NOT the deferred state prop. Document before HUD redesign (HUD1-3).
- **BP-4 no useFrame priority ordering actually implemented** — all useFrame at default 0 despite documented -1/0/+1 muzzle ordering; mount-order-dependent. OVERHAUL2 lighting/shadow/post-process need explicit tiers. Implement + STANDARDS table.
- **BP-5 InstancedField `material as Material` drops multi-material** — OVERHAUL2 biome assets may be multi-material → silently lose all but first. Assert !Array.isArray or delegate to multi-material path.
- **BP-6 asset ErrorBoundary missing** — MapGeometry has Suspense but no ErrorBoundary; GLB load failure → uncaught React error. = ERR1; use discriminated union {status:"error",reason}|{status:"ok"}.
- **BP-7 TS 6.0 is pre-release/RC** — verify build stability; pin nightly SHA if applicable.
### LOW
- BP-8 enemyMix `{} as Record<EnemyKind,number>` partial-record (use Object.fromEntries or Partial); BP-9 drain() `e.fade as FadeKind` (type GameEffect.fade as FadeKind); BP-10 onMuzzleAnchor useCallback stability requirement undocumented at call sites; BP-11 enable exactOptionalPropertyTypes + noPropertyAccessFromIndexSignature for the modifier-stack config; BP-12 THREE.Clock deprecation warning source (likely Yuka/postprocessing transitive — trace+suppress); BP-13 MapGeometry/SectorMapGeometry SkeletonUtils.clone undisposed (low until session-persistent maps).
### GOOD (verified): flushSync removal correct; DamageNumberField troika fix correct; InstancedMesh dispose coverage thorough; pnpm-only clean; <primitive> usage correct.

## CI/CD (4B)
### HIGH
- **CI-1 Pages deploy-staleness has NO automated guard** (the 2-week-stale issue's CLASS, not just instance). FIX (recommended): continuous deploy — remove the release_created gate from build-pages, always build+deploy on push:main (verify-deploy still runs); decouple Pages from APK semver. + PR-title ruleset (Option C) for git hygiene. ONE-LINE if: change eliminates the whole class.
- **CI-2 mobile-perf gate is label-opt-in → PERF-1/PERF-3 can land silently.** PRD already flags promoting it. FIX: run on all PRs (+ paths-filter exempt docs/CI). Baseline is stable.
- **CI-3 obs3-perf-snapshot-mobile has NO enemy-count or shadow A/B** — PERF-1 O(n²) invisible at sparse N; PERF-3 shadow cost unmeasured. ADD: enemy-count A/B (4 vs 16, assert fps(16)≥0.6·fps(4) — O(n²) gives 0.06× → always catches) + shadow A/B (assert fps_shadow≥0.75·fps_noshadow) via window.__bonebuster.setEnemyCount/setShadows hooks. HIGHEST-VALUE OVERHAUL2 perf safety net.
- **CI-4 CodeQL workflow absent** (ci.yml comments ref H-3/H-4 hardening but no codeql.yml). Add javascript-typescript security-extended.
### MEDIUM
- **CI-5 e2e tests 02-05 capture-only → visual gate = crash-check only** (Linux renders 3D differently; no pixel baseline). For OVERHAUL2 velocity this is OK, BUT add a canvas.clientWidth>0 assertion (Option A, 4 lines) so blank-screen regressions are caught; post-overhaul add Linux pixel baselines (Option B).
- **CI-6 gates.json require_run screenshot rule covers Scene.tsx only, not app/views/** — HUD changes won't force a screenshot run. Extend when_changed to app/views/**.
- **CI-7 verify-pages-deploy doesn't assert canvas visible** — silent renderer failures pass. Assert canvas.clientWidth/Height>0.
- **CI-8 no ban on dangerouslySetInnerHTML for new modal/HUD** — add ban_pattern (app/**, src/ui/**).
- **CI-9 pnpm/action-setup unpinned in release.yml mobile-perf job** — SHA-pin to match ci.yml.
- **CI-10 no bonebuster:assetError telemetry** — ERR1 modal should emit {url,type,phase}; verify-pages-deploy asserts none → real asset-integrity gate (partial asset failure currently passes smoke at 60fps with missing mesh).
### LOW
- CI-11 e2e job no timeout-minutes ceiling (add 20); CI-12 objexoom:fpsUpdate legacy event name (rename to bonebuster: before OVERHAUL2 adds listeners); CI-13 node-workspace plugin no-op on single-package repo; CI-14 Lighthouse N/A for WebGL (park).

### OVERHAUL2 PREP ORDER (4B): CI-1 continuous-deploy → CI-2 mobile-perf required → CI-3 A/B probes → CI-4 CodeQL → CI-6 glob → CI-10 assetError (folds into ERR1).
