---
title: Test Suite Audit
updated: 2026-05-15
status: current
domain: quality
---

# OBJEXOOM test suite audit

Audit scope: 73 spec files. Unit `pnpm test` = 625 tests / 68 files / 6.05s wall, **all <50ms** except `objexoom-bossBanner.test.ts > bossSpotted dispatches exactly once via firedRef gate` (36ms — still inside budget). Two real-browser projects: `src/__tests__/browser/` (2 files) and `tests/e2e/` (3 specs). Perf gate: `scripts/obs3-perf-snapshot.mjs` across 5 archetypes against `tests/perf-baselines/{archetype}.json`.

The suite is in unusually good health: zero `.skip`/`.todo`, zero `Math.random()` in tests, zero `setTimeout`/`setInterval`/real RAF inside unit tests, only one `vi.mock` invocation (`tone` in `objexoom-audioBus.test.ts:17`). The pathologies below are not "the suite is broken" — they are specific shape problems that an under-tested system would not yet have visibility into.

Headline findings, in order of fix cost:

1. **POL1 (score HUD) has no end-to-end assertion** — runStats math is tested, but no test reads the `SCORE N` HUD or asserts dispatch from a treasure-chest pickup. Closing this is one e2e block.
2. **`objexoom-fade.test.ts` is a tautology** — it asserts a local copy of the color table, not the real one (`src/__tests__/unit/objexoom-fade.test.ts:13-23`). It tests a comment.
3. **Archetype × surface visual gate is 5 wide, 1 deep** — each archetype gets exactly one screenshot at one pose. PSX wreck (COV10), kitchen scatter (COV13), nature scatter (COV11), library NPCs (COV14), traps (COV8) are invisible in the canonical gate for 4 of the 5 archetypes.
4. **`AdaptiveResolution` (perf gate emitter) has zero direct tests** — the OBS3 perf gate trusts `peakCalls`/`peakTris` from this component, but the 60-frame averaging + 2s warmup + bounce-stability logic is only exercised in production browser sessions.
5. **OBS3 is desktop GL only** — runs `chromium.launch({ headless: true })` with ANGLE-GL on the host CPU/GPU. The mid-tier Android (Pixel 5a class) target from `mobile-android` profile is never measured. Numbers are useful as a regression detector, not as a mobile shipping budget.

## 1. Coverage gaps (real behavioral gaps, smallest closing test)

### G1. POL1 score HUD — end-to-end never asserted
**State:** Tests exist that don't actually test the behavior.
`src/__tests__/unit/objexoom-runStats.test.ts:55-107` proves `clearLevel(..., scoreThisLevel=50)` accumulates to `runTotalScore`. No test:
- mounts the HUD, dispatches a treasure pickup, asserts `SCORE 50` appears
- asserts `+50 treasure / +5 hp bottle / +pickupAmmo book` mapping from `COV12` loot kind to game state delta

**Smallest closing test:** browser-mode test in `src/__tests__/browser/`: render `<ObjexoomShell />` with `?objexoomDebug`, `start()`, `collectAllPickups()`, then assert `screen.getByText(/SCORE \d+/)` is visible and `>0`. ~25 lines.

### G2. AdaptiveResolution downgrade/upgrade ladder
**State:** Tests don't exist for this behavior.
`src/scene/effects/AdaptiveResolution.tsx:60-127` — 60-frame averaging, `consecutiveLow>=2` triggers a 0.1 ratio cut down to floor 0.5, `consecutiveHigh>=2 && avgFps>55` ramps back up, first 2000ms skipped. None of this is unit-tested. The function is impure (reads `window.devicePixelRatio`, `performance.now`, `gl.setPixelRatio`), so extract a pure step `next = stepPixelRatio({avgFps, current, cap, consecutiveLow, consecutiveHigh})` and unit-test the state machine in isolation.

**Smallest closing test:** 7 cases: starts-at-cap, low-once-no-cut, low-twice-drops-0.1, low-at-floor-stays, high-twice-rises, mid-band-clears-counters, dpr-cap-clamp.

### G3. The `key={settings.level}-${seed}` Scene-rebuild fix has no unit guard
**State:** Tests don't exist.
The `B5 — level 2 reachable via real exit-portal win` e2e test (`tests/e2e/objexoom.spec.ts`) regresses against a real production bug ("prior to the fix lastWonAt latched true on level 1's natural win"), but the regression check is a full real-browser playthrough. The actual contract — `key` prop on `<ObjexoomScene>` changes when `level` or `seed` changes — is pure React introspection and could be a 20-line unit test that renders the Shell, advances level, and asserts the inner-Scene's `key` differs across renders.

### G4. Per-archetype scatter inventory rules are spec'd but spotty
**State:** Some have tests, some don't.
Per CLAUDE.md the inventory is: COV8 traps all 5, COV13 kitchen library-only at 20% sector opt-in, COV11 nature courtyard-only 4-8/sector, COV14 NPCs library-only 0-2/sector, COV12 loot one-per-map at farthest-sector centroid. Specifically:
- `objexoom-kitchenScatter.test.ts` exists (31 expects) — verify "library-only / 20% sector opt-in" is one of them
- `objexoom-natureScatter.test.ts` exists (30 expects) — verify "courtyard-only / 4-8/sector clamp"
- `objexoom-npcScatter.test.ts` exists (30 expects) — verify "library-only / 0-2/sector clamp"
- `objexoom-lootScatter.test.ts` exists (25 expects) — verify "farthest-sector centroid" is asserted, not just count

Most are likely covered (the spec doc reflects the test surface) but the spec → test mapping needs a one-pass cross-check. The smallest "closes everything" intervention is a single integration test that generates 100 maps across seeds 0-99 and asserts the archetype × scatter-kind histogram matches the documented inventory.

### G5. Untested source files (38 of 68 src files have no `objexoom-<name>` unit test)
The high-value gaps in that list:

| File | Why it matters | Smallest test |
|---|---|---|
| `src/store/runHistory.ts` | E9/STO1b persistence — only the InMemory path is browser-tested. The `formatRunDuration` helper (line 194) has no unit test. | Unit test for `formatRunDuration(ms)` formatter — 6 cases. |
| `src/scene/effects/AdaptiveResolution.tsx` | See G2 | See G2 |
| `src/ai/yukaIntegration.ts` | Tested in `objexoom-yuka.test.ts` only for pure helpers (Y4/Y5/Y6). EntityManager interaction is "covered by the e2e gate (Y10)" per the file header, but no e2e file is named Y10. | Add a `Y10` browser test (or a comment naming the existing test that covers it). |
| `src/scene/entities/EnemyMesh.tsx`, `EnemyHitFlash.tsx` | The hit-flash → red tint → fade is a polish surface with no test — only the visual gate would catch a regression. | Already covered by the visual gate in principle. Add a corridor-archetype "enemy hit mid-flash" screenshot pose (see G7). |
| `src/world/floorTextures.ts` | Per-archetype floor PBR resolution — drives part of the per-archetype palette intent. No test exists. | Unit test asserting each archetype resolves to a distinct texture URL set. |
| `src/scene/entities/TreasureChest.tsx`, `LootField` (via `lootScatter`) | POL1 score wiring; see G1. | Covered by G1. |
| `src/shared/weapons.ts` | The muzzle-anchor test is for the viewmodel transform, not weapon switch / ammo / firing-rate state. | Unit test for "switching to chaingun when ammo>0" and "pickup grants +N ammo per kind." |
| `src/assets/assetUrl.ts` (the `A()` helper) | Critical — wrong BASE_URL prefix produces blank screenshots in gh-pages/Capacitor. | Unit test that asserts `A("/foo")` resolves to `${import.meta.env.BASE_URL}foo` under three mock BASE_URL values (dev `/`, pages `/objexoom/`, capacitor `file://`). ~15 lines. |

### G6. POL items present in docs/code but with zero test coverage
Cross-referencing `grep -oh 'POL[0-9]+'` between `src/` and `src/__tests__/`:

**Tested:** POL8, POL12, POL21, POL22, POL28, POL32, POL33, POL35, POL36, POL37, POL38, POL39, POL40, POL41, POL42.

**In code, no test:** POL1, POL2, POL3, POL4, POL6, POL7, POL9, POL10, POL11, POL13, POL14, POL15, POL16, POL17, POL18, POL19, POL20, POL23, POL24, POL25, POL26, POL27, POL29, POL30, POL31, POL34, POL44.

That's 27 POL identifiers with no corresponding test. Some (POL16 = layered damage burst particles, POL34 = visual-only) are intentionally visual-only and live behind the screenshot gate. Others (POL1 score, POL14 boss music, POL19 secret reveal counter, POL30 doom-style headbob) likely have testable state-side contracts and should be covered.

Action: triage the 27 against the PRD; for each, classify as "visual-only — screenshot covers" / "state contract — unit test owed" / "complete and live, no behavior to test." Don't bulk-add tests blindly.

## 2. Test smells

### S1. `objexoom-fade.test.ts` tests a tautological local copy
`src/__tests__/unit/objexoom-fade.test.ts:13-23` defines `COLOR_BY_KIND` and `PEAK_BY_KIND` as local constants in the test file, then asserts properties of those local constants. The comment says "Mirror of the table inside triggerFade. Keep this in sync — the test is the canary that catches drift." **The test cannot catch drift** — it asserts the local copy against itself. The real table (`app/views/Shell.tsx`) could change to `damage: "rgba(0,0,0,1)"` and this test still passes.

Fix: import the actual table from `ObjexoomShell` (or extract it to a module the Shell imports) and assert against the source of truth. The test's purpose evaporates without this.

### S2. `objexoom.spec.ts` swallows screenshot failures
`tests/e2e/objexoom.spec.ts:~140, ~175, ~210` (the `page.screenshot(...).catch(err => console.warn(...))`  pattern, repeated 4+ times) — screenshot capture failures log a warning and pass the test. If the renderer is broken these tests still go green. Compare with `tests/e2e/screenshots.spec.ts` which uses CDP capture without `.catch()` (correct).

Fix: either drop the screenshot-on-failure call inside `objexoom.spec.ts` (it's not the visual gate; `screenshots.spec.ts` is) or remove the `.catch` and let failures surface.

### S3. The `objexoom-screenshots` e2e suite uses `waitForTimeout` to settle frames
`tests/e2e/screenshots.spec.ts:~205` (`page.waitForTimeout(900)` for the strobe), `~250` (`page.waitForTimeout(900)` between level cycles in mission-complete). On a slow CI agent or a postprocess-pegged frame, these timings are flake bait. Replace with `page.waitForFunction(() => { const s = __objexoom.getState(); return s.status === 'won' })` for the win flow. The strobe shot is harder — it asserts a mid-cycle visual — but even there a `requestAnimationFrame`-based settle hook (count 60 RAFs after `triggerWin()`) is more deterministic than wall-time.

### S4. `objexoom-engine.test.ts` shares `const map = generateMap(SEED)` across the FSM block
`src/__tests__/unit/objexoom-enemyAi.test.ts:35` — `const map = generateMap(12345) as ObjexoomGridMap;` is a `describe`-scope constant. Each `it` reads from this map. Cross-test order independence is fine because the map is read-only, but the constant moves the "the test set up X" out of the `it`s and into the file header where a reader has to scroll up. Minor — `beforeAll(() => map = ...)` would be the textbook fix; not worth refactoring 40 call sites for. Note for new tests.

### S5. `objexoom-archetypePalette.test.ts` — "byte-stability" guard is good, but pattern is brittle
`src/__tests__/unit/objexoom-archetypePalette.test.ts:25-50` — pins the corridor palette literal-for-literal (`expect(corridor.ambientColor).toBe(OBJEXOOM_PALETTE.violet)` etc., 10 fields). This is correct per the canonical byte-stability rule (the PASS_THROUGH sentinel pattern), but it tightly couples the test file to every palette-table refactor. The test currently does the right job. Document it as load-bearing — accidentally relaxing one of those equals would silently shift the canonical screenshots.

### S6. Tests use `as unknown as { __objexoom?: ... }` ~30 times
Both `tests/e2e/objexoom.spec.ts` and `screenshots.spec.ts` re-declare the `ObjexoomDebugHooks` shape locally. If the debug hook contract changes, you'd have to touch every spec. Extract to `tests/e2e/_helpers/debugHooks.ts` exporting the type + a `getHooks(page): Promise<ObjexoomDebugHooks>` helper.

## 3. Slow tests

**Unit project:** zero tests over 50ms. The verbose-reporter scan flagged exactly one test ≥30ms:
- `src/__tests__/unit/objexoom-bossBanner.test.ts > POL36 boss banner dispatch > bossSpotted dispatches exactly once per enemy id via the firedRef gate` — 36ms.

Inside budget. No action.

**Total wall-time per suite:**
- Unit transform 3.79s, import 8.34s, tests 561ms, environment 57.20s. The 57s of environment time is jsdom setup × 68 files. If unit-suite wall time becomes a problem, the easy win is to consolidate the smallest test files (POL32 4 tests, POL37 6 tests, POL41 4 tests, debugKillBurst, fade) into a single `polish.test.ts` to amortize environment cost — but at 6s wall time it doesn't matter yet.

**Browser project:** not directly measured here; the two browser tests load Tone.js + r3f and `testTimeout: 30_000` is the configured cap. The runHistory test header explicitly notes "we do NOT call `ensureJeepSqliteReady()`" because the WASM load races the harness — that's the right call but it means the e2e SQLite WASM smoke is uncovered. See `src/__tests__/browser/runHistory.browser.test.ts` notes.

## 4. Flake risks

### F1. `tests/e2e/screenshots.spec.ts` — sleep-based settle
See S3. The 900ms / 750ms / 500ms / 1100ms timeouts scattered across the 5 canonical poses are flake bait on a slow agent. Switch the strobe + mission-complete sleeps to RAF-counting hooks.

### F2. `tests/e2e/objexoom.spec.ts > enemy damage ticks player HP down`
`tests/e2e/objexoom.spec.ts:~190` uses `expect.poll(...)` with up to a 20s timeout. The comment says "Skeleton cooldown is 900ms so one hit should land within ~2s once LOS settles — but headed Chromium with postprocessing pegged can stretch that significantly." A 20s poll for a 900ms-cycle behavior is a tell that the underlying LOS settle is non-deterministic. Likelihood of flake on a hot CI agent: low. Likelihood on a contested agent: medium. Pin the test to a specific seed where the player is co-located with a skeleton at start so LOS resolves on tick 1.

### F3. AdaptiveResolution emits to `peakCalls`/`peakTris` from real frames
The OBS3 perf-snapshot script reads these via the `objexoom:fpsUpdate` event over a 3s window after teleporting toward the cluster. The peaks are wall-clock-dependent — if Chromium GC pauses mid-window the sample is skewed. Mitigation already in place: 10% regression ratio is generous. Probably fine.

### F4. `runHistory.browser.test.ts` depends on `localStorage` clearing in `beforeEach`
`src/__tests__/browser/runHistory.browser.test.ts:~30` clears `localStorage` in `beforeEach`. Tests run in shared-browser context inside the project; if `cleanup()` is missed in one test the next reads stale state. Currently fine; document with a comment so future tests don't drop the cleanup.

### F5. `vi.mock("tone", () => ({ now: () => 0 }))` in `objexoom-audioBus.test.ts`
The mock returns `0`. The audio bus's "strictly increasing t" contract depends on its own internal counter incrementing past `Tone.now()`. If a future refactor makes the bus consult `Tone.now()` mid-callback, the mock silently breaks the test. Add a comment marking the mock as load-bearing.

## 5. Determinism audit

The suite is in **excellent** shape on determinism:
- Zero `Math.random()` in any test file (verified by recursive grep across `src/__tests__/` + `tests/`).
- Zero `performance.now()` reads in any test file.
- Zero `Date.now()`, `setTimeout`, `setInterval`, or `requestAnimationFrame` in unit tests.
- Every map-touching test goes through `generateMap(SEED)` where SEED is a literal int (`0xdeadbeef`, `12345`, `0..4`, etc).
- Scatter tests go through `mulberry32` via the `reseed(map, N)` helper pattern (`src/__tests__/unit/objexoom-largePropScatter.test.ts:11-13`).

The only "randomness" hit is the explicit, audited mock in S5 above.

One thing to verify on next pass: every scatter test sets the seed via the fixture (`SECTOR_FIXTURE.seed = ...`) rather than reading `map.seed` from a `generateMap` call, which means a future bug in the seed → scatter wiring would be invisible. Recommend at least one integration test per scatter that goes `generateMap(N) → spawnXScatter(map)` end-to-end so the seed plumbing is exercised.

## 6. Canonical visual gate health

The gate is **5 archetypes × 1 pose** (INF4) + **5 default poses on the corridor archetype** (N1). Total: 10 canonical PNGs.

| Archetype | Canonical pose count | Surface gap |
|---|---|---|
| corridor | 5 (landing/flash-on/flash-off/strobe/mission-complete) — but landing is archetype-independent | enemy hit pose; boss banner pose |
| arena | 1 (flashlight-on) | barrels mid-explosion; arena's open-sightline trap denser scatter; large-prop anchors; boss spawn |
| courtyard | 1 (flashlight-on) | **COV10 vehicle wreck pose** (the spec calls this out); COV11 mega nature pack pose; daylight palette validation; water surface |
| sewer | 1 (flashlight-on) | water-surface pose (sewer-specific); sewer-only debris density; trap-heavy pose |
| library | 1 (flashlight-on) | **COV13 kitchen scatter pose**; **COV14 NPC pose**; book pickups; library-specific lighting palette differentiation |

The visual gate has correct **breadth** (every archetype is seen at least once) but very thin **depth** (one pose per non-corridor archetype). The CLAUDE.md note that "the canonical screenshots all use seed 0 = corridor archetype, which by design hides the other 4 archetypes from the default visual gate" is the symptom. INF4 added one pose per archetype as a remediation, but each archetype's *signature* surface (courtyard wreck, library kitchen+NPCs, sewer water) is still only one pose away from "looks fine, ship it."

**Recommended additions, ranked by visibility-of-regression cost:**

1. `archetype-screenshots — courtyard wreck closeup` — teleport to the COV10 wreck position, frame it close. A wreck regression is invisible in the wide-shot.
2. `archetype-screenshots — library kitchen scatter` — teleport to a known library map's library-kitchen-opted-in sector.
3. `archetype-screenshots — library NPCs` — same, framing 1-2 NPCs.
4. `archetype-screenshots — sewer water` — water-surface shader output regressed silently once already (search git log: yes, in COV*).
5. `default-poses — corridor enemy-hit-flash mid-burst` — POL16 layered damage burst is shipped but invisible in the gate.

This brings the gate to ~15 PNGs at zero CI time cost (sub-second per shot in the existing infra).

## 7. OBS3 / OBS4 perf gate health

`scripts/obs3-perf-snapshot.mjs` measures `peakCalls` and `peakTris` over a 3s window per archetype after teleporting to the densest cluster (the PT1C vantage), via Three.js's `gl.info.render.{calls,triangles}` emitted on the `objexoom:fpsUpdate` event.

**What it measures well:**
- Three.js-side draw-call regressions (a refactor that drops batching → instantly visible in the calls peak).
- Triangle-count regressions (a new high-poly asset wired in without LOD → instantly visible in the tris peak).
- Per-archetype regression at the 10% ratio (caught the wide-shot inventory drift signal).
- Pathological case (densest cluster) rather than average frame — correct framing.

**What it does NOT measure (and the script header doesn't claim otherwise):**

1. **GPU-time / shader cost.** Two scenes with identical draw-call + tri counts can have wildly different frame times depending on overdraw, fragment-shader complexity, or shadow-map cost. The OBS3 budget would not catch a regression where a new postprocess pass costs 8ms/frame at the same call count.
2. **Mid-tier mobile.** Runs on the host CPU/GPU under ANGLE-GL chromium. Pixel 5a class is the target per `mobile-android.md`. There is no Android emulator capture, no `actions/setup-android` integration in CI for this script. Numbers are a desktop-host regression detector, not a mobile shipping budget. The 1000-calls / 100k-tris budgets are framed as "OBS3 is intentionally LOOSER than OBS2's per-frame caps" — but that comparison is against another desktop measurement. The actual question "is corridor-archetype rendering at 30fps on a Pixel 5a" is unanswered.
3. **`fpsUpdate.fps` is captured but not budgeted.** The peak-calls / peak-tris fields are the only assertions. `avgFps` from `AdaptiveResolution` (`src/scene/effects/AdaptiveResolution.tsx:75`) is in the event payload but discarded. Adding an `fps_floor: 50` (desktop) / `fps_floor_mobile: 30` (Android emulator) check would catch GPU-bound regressions the call-count gate misses.
4. **Memory / VRAM / GLB load time.** Asset weight tuning is an explicit deliberate-not-CI decision per `scripts/verify-runtime-assets.mjs`. Reasonable, but a runaway leak (texture creation in a useFrame loop) would not be caught.
5. **No "is anything visible?" pixel check.** A regression where the scene is technically rendering but the canvas is all black (e.g. fog density bug) passes OBS3 — call/tri counts are normal — and only surfaces in the canonical screenshot gate. That's a correct separation of concerns (OBS3 = perf, N1 = visual) but worth noting: the two gates must both stay green.

**Recommended OBS3 extensions, ranked:**

1. Capture `avgFps` from the same `fpsUpdate` events. Budget at 55 (desktop). Fail if any archetype falls below.
2. Add a mobile-emulator job (`actions/setup-android@v3`, Pixel 5a system image, headless emulator + Capacitor build) that runs the same probe and asserts `avgFps >= 30`. This is the actual "is OBJEXOOM playable on mid-tier mobile" gate. Without it, the mobile profile's render-budget claim is uncited.
3. Capture `gl.info.memory.{geometries, textures}` peaks alongside calls/tris — surfaces leaks.
4. Add a "scene non-blank" pixel sanity check at the end of each archetype probe (`page.screenshot()` + a 5-pixel sample for non-uniform color). 10 lines, catches the all-black regression class.

The current gate is good. The above are extensions, not corrections.

## Appendix — file:line index of claims

| Claim | File:line |
|---|---|
| Local-table tautology in fade test | `src/__tests__/unit/objexoom-fade.test.ts:13-50` |
| Single `vi.mock` in suite | `src/__tests__/unit/objexoom-audioBus.test.ts:17` |
| Zero skip/todo | `grep -rn '\.skip\|\.todo' src/__tests__ tests/` empty |
| Zero Math.random/perf.now/setTimeout in tests | `grep -rn 'Math\.random\|performance\.now\|setTimeout(\|setInterval(\|requestAnimationFrame' src/__tests__/` empty |
| Browser shell asserts gate but not pixels | `src/__tests__/browser/ObjexoomShell.browser.test.tsx:1-22` (file header), assertions at lines 42, 53, 80 |
| Screenshot `.catch` swallow | `tests/e2e/objexoom.spec.ts` — search for `.catch((err: Error) => { console.warn` (4 sites) |
| Sleep-based settle in screenshots | `tests/e2e/screenshots.spec.ts` — `waitForTimeout(900)` (strobe), `waitForTimeout(750)` (archetype), `waitForTimeout(1100)` (mission-complete loop) |
| OBS3 desktop-only | `scripts/obs3-perf-snapshot.mjs:64-73` (LAUNCH_ARGS), 1280×720 viewport |
| OBS3 measures only calls+tris | `scripts/obs3-perf-snapshot.mjs:91-99` (failure conditions) |
| AdaptiveResolution untested | no `src/__tests__/unit/objexoom-adaptiveResolution.test.ts` exists |
| `key={settings.level}-${seed}` regression gated by e2e only | `tests/e2e/objexoom.spec.ts > B5 — level 2 reachable via real exit-portal win on level 1` |
| POL1 score state tested, HUD not | `src/__tests__/unit/objexoom-runStats.test.ts:55-107` (state); no HUD-reading test exists |
| INF4 per-archetype = 1 pose each | `tests/e2e/archetypeScreenshots.spec.ts:55-78` |
| `enemyAi` test shares describe-scope map | `src/__tests__/unit/objexoom-enemyAi.test.ts:35` |
| Audio bus mock load-bearing | `src/__tests__/unit/objexoom-audioBus.test.ts:14-19` |
| Per-archetype palette byte-stability | `src/__tests__/unit/objexoom-archetypePalette.test.ts:25-50` |
| POL coverage 15/42 in tests | `grep -oh 'POL[0-9]+' src/__tests__/unit/*.test.ts \| sort -u` → 15; `grep -roh 'POL[0-9]+' src/ docs/` → 42 |
| Unit suite wall time | `pnpm test` output: 6.05s / 625 tests / 68 files |
| Only test >30ms in unit | `objexoom-bossBanner.test.ts > bossSpotted firedRef gate` — 36ms |
