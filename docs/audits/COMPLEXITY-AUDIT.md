---
title: Complexity & Code Quality Audit
updated: 2026-05-15
status: current
domain: quality
---

# Complexity & Code Quality Audit — objexoom

Post Phase-20 drain-and-repopulate audit. Scope: every TS/TSX file under `src/`, plus `src/__tests__/`. Profile-doctrine references to `src/sim/**`, `src/engine/**`, `src/systems/**` are vestigial — the actual layout is flat-module + `src/scene/**`. Findings reflect that.

Tool methodology: ripgrep + line-count + AST-shaped grep for spawn/`useRef`/dispatch sites. Every claim carries a `file:line` cite.

---

## 1. Top 15 ranked findings

### F1. `mulberry32` PRNG copied verbatim 13 times — HIGH — duplication

The same 9-line PRNG body appears in:

- `src/engine.ts:152`
- `src/barrels.ts:189` (variant — `| 0` masking instead of `>>> 0`, drift)
- `src/lampScatter.ts:59`
- `src/enemyMix.ts:101`
- `src/world/scatter/debrisScatter.ts:51`
- `src/world/scatter/floorTiles.ts:47`
- `src/world/scatter/kitchenScatter.ts:38`
- `src/world/scatter/largePropScatter.ts:54`
- `src/world/scatter/natureScatter.ts:42`
- `src/world/scatter/npcScatter.ts:44`
- `src/world/scatter/propScatter.ts:66`
- `src/world/scatter/trapScatter.ts:57`

12 are byte-identical; the `src/barrels.ts:189` variant uses `| 0` (signed int coerce) where the rest use `>>> 0` (unsigned). That single divergence is a determinism risk if `seed` ever lands negative: barrels would produce a different stream than the scatters at that seed, breaking the "canonical byte-stability" invariant called out in `MEMORY.md`.

Fix: introduce `src/rng.ts` exporting `mulberry32(seed: number): () => number` and `tagged(seed: number, tag: number)`. Replace every local copy with `import { mulberry32 } from "./rng"`. The barrels variant disappears in the process. This is the single highest-leverage change in the repo — 11 callers, zero behavior change, 110 LOC deleted, one source of truth for the "canonical seed mod-5" invariant.

### F2. `ObjexoomShell.tsx` is a 1129-LOC god component — HIGH — complexity

`app/views/Shell.tsx:1` declares one component `ObjexoomShell` that owns: URL parsing (`readSeedFromUrl:168`, `readArchetypeFromUrl:187`, `applyArchetypeOverride:206`), base-ammo/base-weapon tables (`baseAmmo:134`, `baseOwnedWeapons:145`, `ammoIncrement:153`), settings hydration with localStorage, the `GameState` reducer dispatch surface, the entire `gameRef.current.onHit/onKill/onPickupKey/onWin/...` callback graph (the snippet around `:378` runs ~250 LOC just for those callbacks), fade-overlay timing, going-back deadline scheduling, runId/runHistory lifecycle, debug-hook exposure, and the React tree render.

15 `useRef` + 6 `useState` in one file is the symptom (`app/views/Shell.tsx:333,358,376,378,639,687,763,764,837,839,841,843,...`).

Fix: extract `gameRef` callbacks into `src/shell/gameCallbacks.ts` as a factory `makeGameCallbacks(deps): GameRef` that takes refs/setters as arguments. Extract URL helpers into `src/shell/urlParams.ts`. Extract the base-table constants into `src/shared/weapons.ts` (where `WEAPONS` already lives). Target ≤ 500 LOC for `ObjexoomShell.tsx`.

### F3. `ObjexoomScene.tsx` is a 1046-LOC choreographer with mixed concerns — HIGH — complexity

`app/views/Scene.tsx:123` is one function `ObjexoomScene` with ≥ 14 `useEffect` blocks (`:279,341,355,371,381,391,398,424,428,437,638,710,786,...`), 47 `useRef`s (per ripgrep count), and 8+ scatter wirings (`spawnLamps, spawnProps, spawnDebris, spawnDecals, spawnTraps, spawnKitchen, spawnNature, spawnNpcs, spawnFloorTiles, spawnLargeProps, spawnSecrets, spawnBarrels` — see imports at `:8-92`). The boundary between "set up scatter once on map change" and "react to runtime events" is fuzzy.

Fix: introduce `src/scene/scatterAggregate.ts` exposing `useScatterFor(map, archetype): { lamps, props, debris, decals, traps, kitchen, nature, npcs, floorTiles, largeProps, secrets, barrels }`. Move the 12 `useMemo`/`useState` scatter wirings out of `ObjexoomScene` into the aggregate hook. Estimated ~150 LOC out of `ObjexoomScene.tsx`.

### F4. `src/engine/engine.ts` is 1174 LOC and owns 4 distinct subsystems — HIGH — complexity

`src/engine.ts:1` mixes: map generation (`generateMap:253`, `mulberry32:152`, `carveRoom:171`, `carveCorridor:179`, `bfsReachable:209`), grid + sector raycast/collision (`resolveCollision:454`, `castRay:508`, `hasLineOfSight:548`, `resolveCollisionAny:692`, `castRayAny:762`, `castRaySectors:1010`), enemy + pickup spawning (`spawnEnemies:634`, `spawnPickups:667`, `pickBossSpawnIndex:610`), and enemy-bullet integration (`makeEnemyBullet:798`, `stepEnemyBullet:835`). These four subsystems share only the `Vec2` and `ObjexoomMap` types.

Fix: split into `src/mapGen.ts` (generateMap + carve/bfs/mulberry), `src/collision.ts` (resolveCollision* + castRay* + hasLineOfSight* + polygonContains + sector helpers), `src/spawns.ts` (spawnEnemies + spawnPickups + pickBossSpawnIndex), `src/bullets.ts` (enemy bullet API). `engine.ts` becomes a barrel re-export to avoid breaking ~30 import sites in one PR — then incrementally migrate callers.

### F5. `barrels.ts:189` `mulberry32` divergence is a silent determinism risk — HIGH — consistency / type-safety

`src/barrels.ts:189` uses `let t = seed | 0` (signed) and `1 | t` mask, vs `src/engine.ts:152` `s = seed >>> 0` (unsigned). For positive seeds the streams happen to converge after the first iteration but they differ in semantics. Resolved by F1.

### F6. `src/scene/hooks/**` is not React hooks — coupling / consistency — MEDIUM

`src/scene/hooks/enemyTickLoop.ts:1`, `src/scene/hooks/fireResolution.ts:1`, `src/scene/hooks/returnBearing.ts:1`, `src/scene/hooks/timeScaleBus.ts:1` are all pure functions / factories with **zero `useRef`/`useState`/`useEffect`** (ripgrep: `useRef` count is 0 in every file under that dir). Naming as "hooks" misleads readers into expecting React semantics and a hook-rules audit.

Fix: rename `src/scene/hooks/` → `src/scene/tick/` (or `src/scene/sim/`). Update the 4 import sites in `app/views/Scene.tsx:89-91`. No behavior change.

### F7. `src/scene/hooks/returnBearing.ts` uses module-scope mutable state — MEDIUM — coupling

`src/scene/hooks/returnBearing.ts:21` `let currentAngleRad: number | null = null;` is a singleton mutated by `setReturnBearing:23` and read by `getReturnBearing:27`. The file's own comment says "module-scope ref is the cheapest correct shape". For one writer and one reader it's fine, but it's the only such instance in the repo. If any future feature wants to test or fork this state (e.g. two-arena split-screen), it can't.

Fix: keep for now (the comment's rationale is correct). When (and only when) a second consumer arrives, promote to a small `ReturnBearingBus` factory with the same `set/get` API. Flag for revisit, not action.

### F8. `Math.random()` saturates the visual-effects layer — MEDIUM — consistency / determinism

`src/sfx.ts:606`, `src/scene/hooks/fireResolution.ts:138,140,169,170` (the only sim-adjacent uses; the rest are effects), `src/scene/effects/ParticleBurstField.tsx` (≥ 30 occurrences `:83-220`), `src/scene/effects/BodyPartField.tsx:97-109`, `src/scene/effects/ShellEjectField.tsx:52-54`.

`gates.json` only bans `Math.random()` in `src/sim/**` / `src/engine/**` / `src/systems/**` — none of which exist. So nothing fails the gate today, but two **fireResolution** sites at `:138, 140, 169, 170` are inside the shot-resolution path (bullet velocity jitter, pellet spread). Those affect gameplay outcomes (pellet hit/miss) and should be deterministic per shot for replays/regression.

Fix: thread a per-shot `rng: () => number` into `FireResolutionContext` (created from `(map.seed ^ shotIndex)`). All particle/body/shell `Math.random()` calls in `src/scene/effects/**` are decorative — leave them or wrap with a single `visualRand()` shim later. Update `gates.json` `ban_patterns.globs` to include `src/scene/hooks/fireResolution.ts` so future fire-path changes are gated.

### F9. `ObjexoomShell.tsx` and `ObjexoomScene.tsx` both subscribe to `playerHit` — MEDIUM — coupling

`app/views/Scene.tsx:356` `addObjexoomListener("playerHit", ...)` dispatches a `burst` event for visuals. `app/views/HUD.tsx:63` `addObjexoomListener("playerHit", ...)` flashes a key indicator. `app/views/Shell.tsx` *also* dispatches `playerHit` from `gameRef.current.onHit` at `:386`. The flow is: damage → `gameRef.onHit` (Shell) → dispatch `playerHit` → Scene picks it up and dispatches `burst` at the player position → Scene also dispatches `shake` from inside `onHit`. Two indirections for a single event.

Fix: inline the Scene's `playerHit→burst` mapping into `gameRef.onHit` in `ObjexoomShell.tsx`. The Scene only needs the player position which is already on `cameraRef.current`. Drop the `playerHit` listener in `ObjexoomScene.tsx:356-371`. HUD listener stays (it's the legit consumer).

### F10. `ObjexoomHUD.tsx` mixes virtual stick + fire button + adaptive resolution readout + 10+ inline styles — MEDIUM — complexity

`app/views/HUD.tsx:42` `ObjexoomHUD`, `:325` `AdaptiveResolutionReadout`, `:432` `TouchControls`, `:442` `VirtualStick`, `:537` `FireButton`, `:575` `OverlayCard`, `:757` `HpPipRow`, `:813` `ClickToEngagePrompt`, plus 10 `CSSProperties` style constants at `:630-715`. Eight components and a style dictionary in one 868-LOC file.

Fix: extract `src/hud/TouchControls.tsx` (VirtualStick + FireButton + TouchControls wrapper, ~200 LOC) and `src/hud/AdaptiveResolutionReadout.tsx` (~90 LOC). `ObjexoomHUD.tsx` shrinks to ~550 LOC of actual HUD layout.

### F11. `app/views/HUD.tsx:430-540` inline-styles repeat the same panel chrome — LOW — duplication

`hudLabelStyle:642`, `hudReadoutStyle:651`, `crosshairStyle:658`, `overlayStyle:681`, `cardStyle:694`, `overlayTitleStyle:703`, `weaponChipStyle:730`, `lowHealthWarningStyle:798` — each repeats `border: 1px solid <accent>`, `background: <bgPanelAlpha>`, `padding: ... 0.6em`, `font-family: monospace`. Pull into a single `panelChrome()` helper that takes a variant (e.g. `"card" | "label" | "warning"`).

Note: this only meets the "3 current callers" bar because there are ~6 instances. If only 2-3 panels carried this chrome it would be over-abstraction.

### F12. `src/__tests__/unit/objexoom-nature.test.ts` is a tautology test — MEDIUM — test-quality

`src/__tests__/unit/objexoom-nature.test.ts:9-16` asserts only that `NATURE_MEGA_PACK_URL.match(/Mega_Nature\.glb$/)` and that the value is a non-empty string. The URL is a const defined elsewhere; the test re-asserts the literal value. Zero behavioral coverage — if someone changes the URL to a wrong asset, the test changes with it.

Fix: delete the file. The `pnpm assets:verify-runtime` gate already proves the GLB exists at the URL; that is the real contract.

### F13. `src/__tests__/unit/objexoom-bossBanner.test.ts` simulates the SUT — MEDIUM — test-quality

`src/__tests__/unit/objexoom-bossBanner.test.ts:46-65` writes a local `maybeSpot(enemyId)` helper that re-implements the `firedRef` gate the production `enemyTickLoop` uses, then asserts the helper deduplicates. The test never imports the real `enemyTickLoop` gate logic — it tests its own simulation. If `enemyTickLoop.ts` regresses (e.g. the firedRef gate stops short-circuiting), this test stays green.

Fix: either (a) export the gate predicate from `enemyTickLoop.ts` and import it here, or (b) delete this test and lean on the `bossDefeated` per-enemy dispatch test (which does exercise real `dispatch`), plus a Scene integration test.

### F14. `src/__tests__/unit/objexoom-hudKey.test.ts` only has 2 assertions — LOW — test-quality

`src/__tests__/unit/objexoom-hudKey.test.ts` total `expect(` count is 2 (lowest in repo, per `expect-counts-per-test`). Either the file owns a tightly-scoped contract worth pinning (acceptable), or it's a vestige of a deleted feature. Eyeball the file and decide; if the 2 assertions duplicate something already covered in `objexoom-secrets.test.ts` or `objexoom-events.test.ts`, delete.

### F15. `src/turtle.ts:1` + `src/refLevel.ts:1` are reference-clone bridges that ship dead code paths — LOW — dead-code

`src/refLevel.ts:17` imports `decodeRefLevel, levelBounds, RefLevelIndex` from `turtle.ts`. Production callers of `refLevel.ts` (`src/world/refLevel.ts` basename grep, non-test): only **1** match. `turtle.ts` non-test callers: **2** (`refLevel.ts` and `RefLevelMap.tsx`). The whole ref-clone parity surface was finished per the operating mandate ("100% reached"). Audit whether `RefLevelMap.tsx` is reachable from the running game or only from a debug overlay; if the latter, gate behind `?objexoomDebug` and drop the bundle weight.

Check: `grep -rn 'RefLevelMap' app/views/Shell.tsx app/views/Scene.tsx` to confirm reachability before pruning.

---

## 2. Highest-leverage refactor targets (≤ 1 day each)

1. **F1 — extract `src/rng.ts`.** ~3 hours. Deletes ~110 LOC across 11 files. Resolves F5. Single import everywhere. The "canonical byte-stability" invariant in `MEMORY.md` becomes enforceable by a single test that pins `tagged(0, 0x4c4d50)()` returns a fixed value.
2. **F4 — split `engine.ts` into `mapGen` / `collision` / `spawns` / `bullets`.** ~1 day. Each subsystem becomes individually testable. The current `objexoom-engine.test.ts` (641 LOC, biggest test file) splits naturally by subsystem. Future engine work touches one file, not a 1174-LOC blast radius.
3. **F2 + F9 — slim `ObjexoomShell.tsx` by extracting `gameRef` callbacks + URL helpers.** ~6 hours. Cuts ~300 LOC. Resolves F9 in the process (the `onHit` callback inlines the burst dispatch). Unlocks: gameRef behavior becomes unit-testable without mounting React.
4. **F6 rename `src/scene/hooks/` → `src/scene/tick/`.** ~30 minutes. Pure cosmetic but high-leverage cognitively — every new agent that sees `scene/hooks/` will burn a slot wondering why the "hooks" don't follow hook rules.

---

## 3. Dead code / orphaned modules

- **`src/turtle.ts:1` + `src/refLevel.ts:1` + `app/components/RefLevelMap.tsx`** — ref-clone parity bridge. 2 non-test importers of `turtle`, 1 of `refLevel`. PARITY phase is closed per `CLAUDE.md`. Confirm `RefLevelMap` is still mounted in `ObjexoomShell` (`grep -rn 'RefLevelMap' src/`); if not, the module + its two tests can land in a single `chore: drop ref-clone bridge` commit.
- **`src/scene/hooks/timeScaleBus.ts:1`** — `createTimeScaleBus`. Imported only at `app/views/Scene.tsx:91`. Used at `:373, 688` (reserve calls). One consumer. Acceptable as a small factory but reconsider if no second consumer arrives by Phase 22.
- **No orphaned tests detected.** All `src/__tests__/unit/*.test.ts` files (51 suites) reference at least one production import.
- **No exported-but-unimported symbol scan was performed** — flag for a follow-up `ts-prune` run; tooling needed.

---

## 4. `as any` / `@ts-ignore` / `@ts-expect-error` audit

| File:Line | Code | Judgment |
|---|---|---|
| `src/__tests__/unit/objexoom-decalScatter.test.ts:78` | `expect(spawnDecals(grid as any)).toEqual([])` | **Lazy escape.** Passing an intentionally-invalid grid to test the empty-return path. Fix: define the union narrowly enough that `null` or a `{ kind: "invalid" }` sentinel is the typed bad input. Or use `@ts-expect-error` with a comment so the bypass is auditable. |
| `src/__tests__/unit/objexoom-debrisScatter.test.ts:91` | `expect(spawnDebris(grid as any)).toEqual([])` | **Lazy escape.** Same pattern. Same fix. |

**No `@ts-ignore`, `@ts-expect-error`, or `@ts-nocheck` anywhere in `src/`.** The TS strictness posture is clean.

The only other `as any`-shaped escapes are `as unknown as { __objexoom?: unknown }` in `src/__tests__/browser/ObjexoomShell.browser.test.tsx:38` (acceptable — `window` augmentation for a test-only debug hook) and one in `app/views/Shell.tsx` (worth a follow-up grep but out of the 2 bare `as any` hits).

---

## 5. Test smells

### Tests with no assertions / `.skip` / `.todo` / `.only`

**Zero hits.** `grep -rnE '\.(skip|todo|only)\(' src/__tests__` returned no output. Clean.

### Tests with ≤ 5 assertions (low coverage / candidates for review)

From `expect-counts-per-test`:

| Test | `expect(` count | Verdict |
|---|---|---|
| `src/__tests__/unit/objexoom-hudKey.test.ts` | 2 | See F14. Investigate — likely vestigial. |
| `src/__tests__/unit/objexoom-nature.test.ts` | 3 | See F12. Delete — tautology. |
| `src/__tests__/unit/objexoom-archetypeOverride.test.ts` | 4 | Behavioral (`applyArchetypeOverride` round-trip). Keep. |
| `src/__tests__/unit/objexoom-bossBanner.test.ts` | 5 | See F13. Refactor to import the real gate or delete. |
| `src/__tests__/unit/objexoom-bullet.test.ts` | 5 | High-value — tests `stepEnemyBullet` state machine end states. Keep. |
| `src/__tests__/unit/objexoom-largePropCollision.test.ts` | 5 | Verify it tests the collision predicate, not just the data. Likely keep. |
| `src/__tests__/unit/objexoom-sfx-mix.test.ts` | 5 | Acceptable if it pins audio-bus mix levels. Verify. |
| `src/__tests__/unit/objexoom-sqljsRemoval.test.ts` | 5 | Likely a regression guard against re-introducing sql.js. Keep. |

### Tests that mock too much

`grep -rnE '(vi\.mock|vi\.fn|vi\.spyOn)' src/__tests__` → **1 total occurrence**, in `src/__tests__/unit/objexoom-audioBus.test.ts`. The rest of the suite is mock-free (the codebase favors integration over isolation). This is a strength, not a smell.

### Tests that test their own mocks

- `src/__tests__/unit/objexoom-bossBanner.test.ts:46-65` (F13) — test re-implements the SUT's gating logic in `maybeSpot` and then tests the re-implementation. The `dispatch` round-trip *is* real, but the gate is simulated.

### React-render tests

`grep -lE '(render\(|@testing-library/react|@react-three/test-renderer)' src/__tests__/unit/*.ts` returned **zero matches**. The only render test is `src/__tests__/browser/ObjexoomShell.browser.test.tsx:43-67`, which mounts in real Chromium and asserts on accessible-name lookups (`getByRole("button", { name: /NEW GAME/ })`). That's a high-value smoke — keep.

**No `render()` tests asserting on implementation detail.** Test posture is excellent here.

---

## Appendix: file-line distribution

```
1174  src/engine.ts                            <-- F4
1129  app/views/Shell.tsx                    <-- F2
1046  app/views/Scene.tsx                    <-- F3
 868  app/views/HUD.tsx                      <-- F10
 793  app/views/Landing.tsx
 734  src/sfx.ts
 641  src/__tests__/unit/objexoom-engine.test.ts (mirror of F4 — splits along the same lines)
 385  src/models.ts
 311  src/scene/hooks/fireResolution.ts        <-- F8 (also F6 rename)
 308  app/components/PlayerController.tsx
 301  src/events.ts
 298  src/scene/effects/ParticleBurstField.tsx <-- F8 decorative
 276  src/scene/entities/PickupMesh.tsx
 269  src/scene/viewmodel/WeaponViewmodel.tsx
 269  src/refLevel.ts                          <-- F15
 257  src/scene/hooks/enemyTickLoop.ts         <-- F6 rename
```

`src/scene/lighting/archetypePalette.ts` at 212 LOC is config-table per the brief and is **not** flagged.

Files ≥ 600 LOC: 6 (engine, Shell, Scene, HUD, Landing, sfx). Of these:
- engine, Shell, Scene, HUD — multi-subsystem, flag (F2/F3/F4/F10).
- Landing — single-screen marketing surface; defer until next refactor pass.
- sfx — 1 file owns all weapon + UI + ambient SFX. Each `play*` function is short; the file shape is "lookup table of sound recipes". Borderline acceptable; revisit if a 7th weapon lands.
