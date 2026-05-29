# Bone Buster — live work queue

**Status:** ACTIVE
**Branch:** ONE long-running branch holds all in-flight work. Remote feedback + a single squash-merge happen at the END, not per-slice. Versioning is entirely release-please's — nothing here is version-gated, and the agent never assigns a release version.
**Authority chain:** DESIGN > ARCHITECTURE > DECISIONS > **PRD** > this file > ROADMAP.
**Spec:** [`docs/PRD.md`](../docs/PRD.md) carries the user stories, surfaces, and acceptance bars. Each item below points at its PRD section for the why and the verifiable acceptance.
**Standards:** [`STANDARDS.md`](../STANDARDS.md) carries doctrine (quality bar, slot architecture, no-end-of-turn, design tokens, etc).
**Decisions:** [`docs/DECISIONS.md`](../docs/DECISIONS.md) carries binding technical decisions.
**Audit trail:** shipped items live in `git log` + `.agent-state/decisions.ndjson` + `CHANGELOG.md`. They are not preserved in this file.

## Operating loop

1. Pick the topmost unchecked item.
2. Read the PRD section / linked design doc for the acceptance bar.
3. Implement, run `pnpm verify`, commit, dispatch reviewer trio locally.
4. Fold reviewer findings into the next forward commit.
5. Flip `[ ]` → `[x]` in the same commit; **delete the item from this file** in the next forward-going commit (per the prune-shipped-from-directive rule).
6. Keep ALL work on the single long-running branch. Open the PR + gather remote feedback + squash-merge only when the whole queue below is drained — not per commit, not per slice. The work is the directive; wall-clock and size never gate it.

## Queue — SEQUENCING (user-directed 2026-05-28)

The order is locked: (1) finish + MERGE PR #84, get local main fully caught up;
(2) then ONE local branch holding ALL remaining work, STARTING with a fully
automated `comprehensive-review:full-review` run, carrying every finding forward
into the PRD + directive; (3) then drain OVERHAUL2 + review findings on that one
branch. NO more per-slice PRs — local review (vitest browser + Playwright, read
the screenshots myself) before any push.

### Step 1 — land PR #84 — DONE
- [x] PR #84 squash-merged (admin, 2026-05-29; user: don't wait on CI, the
  review run catches everything). Local main caught up to 597b871 (the `feat:`
  squash → release-please will cut the next release). Branch `feat/overhaul2`
  cut off main; VIS WIP restored.

### Step 2 — comprehensive review run (FIRST thing on the branch) — DONE
- [x] REVIEW-RUN Ran `comprehensive-review:full-review` fully automated (5 phases,
  8 agents) over src/+app/. Full report in `.full-review/05-final-report.md`;
  per-phase artifacts in `.full-review/0[1-4]*.md`. Findings carried into the
  PREP lane (Step 2.5) below + docs/PRD.md §LANE: OVERHAUL2. No security
  criticals (0 prod CVEs). Headline: prep-work must land before STRUCT/HUD
  features or they inherit existing debt.

### Step 2.5 — PREP (from the review; land BEFORE OVERHAUL2 features)
- [ ] PREP-CI1 Continuous-deploy: remove the release_created gate from build-pages, always build+deploy on push:main (verify-deploy still runs); decouple Pages from APK semver. Kills the deploy-staleness class. [review CI-1]
- [ ] PREP-CI2 Promote mobile-perf gate to required-on-PR (+ paths-filter exempt docs/CI). [review CI-2]
- [ ] PREP-CI3 Add enemy-count A/B (4 vs 16, assert fps(16)≥0.6·fps(4)) + shadow A/B (fps_shadow≥0.75·fps_noshadow) to obs3-perf-snapshot-mobile via window.__bonebuster.setEnemyCount/setShadows hooks — catches PERF-1/PERF-3 count-scaling. [review CI-3]
- [ ] PREP-CI4 Add CodeQL workflow (javascript-typescript, security-extended). [review CI-4]
- [x] PREP-C2 Moved gameConstants.ts → src/store/gameConstants.ts; gameReducer/useLevelTransition/2 tests repoint; old file deleted. Runtime layer inversion (src/store→app/views value import) gone. tsc 0, 1338 unit green. [review ARCH-C2]
- [ ] PREP-C1 Extract domain types (GameState/GameStatus/LevelPhase/FadeKind/FadeTrigger/WeaponState/GameRef) out of Shell.tsx → src/store/gameState.ts; all importers move same commit. Unblocks STRUCT4 tests. [review ARCH-C1/M-2/L-5]
- [ ] PREP-DOC Add DECISIONS D22 (VIS1/VIS2 flood-lighting reversal of J1), D23 (STRUCT1 map-representation grid-vs-sector choice), extend D16 (sceneTick.ts); rewrite DESIGN.md §what-it-is/archetype-identity/lighting to match OVERHAUL2 (it currently CONTRADICTS it, and DESIGN>PRD authority); refresh ARCHITECTURE.md (src/scene/ subtree, data-flow chain, persistence STO1b shipped); fix README URL flags + file-layout tree. [review DOC-C1..C5, H1..H7]
- [ ] PREP-PERF1 Enemy LOS throttle + distance/horizon gate (cache sees+lastSeenAt, stagger by id, full-rate only when distToPlayer<SHOOT_RANGE) + sector-AABB broad-phase in castRaySectors. CRITICAL count×count fix. Determinism: aggro-latency <150ms test. [review PERF-1, TEST-10]
- [ ] PREP-PERF2 pickUvHidden: fork ENMX-UV stream ONCE → boolean array (byte-identical, O(n)). [review PERF-2/H-1]
- [ ] PREP-PERF3 Mobile: directional castShadow=false behind mid-tier check (PSX needs no realtime shadow); desktop optional 512²+tight frustum+autoUpdate=false. [review PERF-3]
- [ ] PREP-BP1 Dispose WaterSurface DataTexture (useEffect cleanup) — leaks per map load. [review BP-1]
- [ ] PREP-BP2 assertNever exhaustiveness on gameReducer + drain() switches (STRUCT4 will add variants). [review BP-2]
- [ ] PREP-TEST1 Add enemy-bullet-integration tests to bonebuster-sceneTick (hitPlayer/hitWall/in-flight/compaction — untested combat path). [review TEST-1]
- [ ] PREP-MISC Batch the small review fixes: M-1 debrisScatter bboxOf; M-5 onStartGame audio try/catch; M-6/SEC-1 seed URL ≤200 cap; M-7 writeJsonPref dev-log; CI-5 e2e canvas.clientWidth>0 assert; CI-6 require_run glob→app/views/**; CI-7 verify-deploy canvas assert; CI-8 dangerouslySetInnerHTML ban; CI-9 SHA-pin; SEC-2 CSP-meta DECISIONS note; SEC-3 smoke-URL comment; BP-3 stateRef-stale HUD constraint doc; L-2 GOAL_BONUS_AMMO const; BP-4 useFrame priorities; CI-12 rename objexoom:fpsUpdate→bonebuster:.

### Step 3 — OVERHAUL2 visual/feel/structure (same one branch)

User-directed (2026-05-28, live playtest): dark/gritty modernized-DOOM ×
Silent-Hill horror maze from the existing PSX assets — readable, atmospheric,
fully procedural. Full spec + acceptance in [`docs/PRD.md`](../docs/PRD.md)
§LANE: OVERHAUL2. VIS1/VIS2 (flood lighting + fog haze) are PROTOTYPED + parked
in a git stash ("OVERHAUL2 VIS WIP"); re-justify + commit them on the new branch
with local screenshot verification. Capture+expand PRD/directive as findings arrive.

- [x] VIS1 Flat-flood lighting (killed dark-base + flashlight-reveal; ambient 0.95 / dir 1.1 / hemi 0.7). Committed on feat/overhaul2; tsc/lint/1338 unit/5 screenshots green locally.
- [x] VIS2 Silent-Hill fog haze (fog colors [500]/[600] tinted, near 8) + weapon emissive 0.18→0.04. Committed. *Follow-up VIS2b: wire far-plane to area streaming.*
- [ ] ERR1 Asset-load error modal overlay (arcade-cabinet parity) — DO FIRST in OVERHAUL2 (surfaces problems the rest hits). [PRD ERR1]
- [ ] VIS4 Weapon hold transform — center-bottom, aiming forward (currently bottom-right/angled). [PRD VIS4]
- [ ] VIS3 Artistic shadow blended with the flood (Silent Hill), readable not flat/pitch. [PRD VIS3]
- [ ] VIS5 Kill ALL placeholders + no procedural-where-a-PSX-model-exists (ceiling/lava planes, fallbacks). [PRD VIS5]
- [ ] HUD1 Frame the scene, dark/gritty/chrome, right tactical info (not boxy floating panels). [PRD HUD1]
- [ ] HUD2 Own-only weapon display (DOOM model), no always-5 boxy bar. [PRD HUD2]
- [ ] HUD3 In-world weapon/loot pickups + chests feed the arsenal/HUD. [PRD HUD3]
- [ ] STRUCT1 Extract a base `MazeGenerator` core (lowest layer) + commit fully to procedural; drop the 1-5 picker + LevelChoice union; refLevels become biome STYLE models only. [PRD STRUCT1]
- [ ] STRUCT2 One generator PER BIOME (sewer/cathedral/underwater/etc) built on the maze core — each owns biome structure/scatter/hazards + custom triggers/traps/code; level N = a biome maze, boss-capped. Composes natively with seed forks (same phrase → same biome maze). [PRD STRUCT2]
- [ ] STRUCT3 Logarithmic difficulty scaling (enemies/tier/density/maze-size) + unit test. [PRD STRUCT3]
- [ ] STRUCT4 Log-scaled weapon UPGRADE progression: unlock base weapon → find context-appropriate upgrades (fire rate / multi-shot / spread / damage), seeded drops scaling with depth; HUD shows upgrade tier. Endless-play depth. [PRD STRUCT4]
- [ ] STRUCT5 Weighted biome-selection pressure system: per-biome pressure in the save (levels-since-last-played), weighted pick on each exit (50/30/15/5 over pressure rank) via the event PRNG — no rote cycling, stale biomes favored, next never predictable. [PRD STRUCT5]

## Queue — PRIORITY: family PRNG + seedphrase (one branch)

User-directed (2026-05-28): adopt the `~/src/arcade-cabinet` family seed
architecture — two-PRNG seedrandom model with a surfaced
adjective-adjective-noun seedphrase set in the New Game modal. FULL REWRITE
to match the sibling exactly (not a numeric bridge). Spec:
[`docs/specs/96-prng-and-landing.md`](../docs/specs/96-prng-and-landing.md).
Reference impl: `~/src/arcade-cabinet/Aethelgard-Chronicles-of-Strata/src/core/{rng,seed-phrase}.ts`.

Step-sequenced (each step informs the next; don't pre-build later steps):
- [x] SEED1 Added `src/engine/rng.ts` (family pattern): `cyrb128`, `createMapPrng(phrase)`, `forkStream(phrase, tag)`, `createEventPrng`/`createFreshEventSeed`/`advanceEventSeed`. Add `src/engine/seedPhrase.ts` (bone-buster-flavored adjective-adjective-noun word lists + `randomSeedPhrase(eventRng)`). Unit-test the hash + phrase generation. Keep mulberry32 in place for now (no callers switched yet).
- [x] SEED2 Switched `generateMap` + ALL procedural consumers to `forkStream(phrase, tag)`; `map.seed:number` → `map.seedPhrase:string`. engine.generateMap(seedPhrase) — archetype = `cyrb128(phrase)[0]%5`, tool cadence = `cyrb128(phrase)[1]%N`, pickUvHidden forks "ENMX-UV"; all 9 scatter modules + enemyMix → `forkStream(map.seedPhrase, "TAG")`; loot/nature/npc numeric consumers → `cyrb128(map.seedPhrase)[n]`; barrels "BARL"; buildMap(seedPhrase); refLevel `reflevel-N` (archetype stays index%5); archetype.applyArchetypeOverride suffix-rewrites phrases; Shell/Scene/useGameRef hold seedPhrase (+`mapSeedNum` for cosmetic pickers); urlFlags.readSeedPhraseFromUrl. CANONICAL_SEED_PHRASE = "marrowed-vile-sepulcher" → corridor. Re-blessed ~16 determinism test files + the canonical screenshots. `pnpm verify` green (1284 unit + 11 browser + assets/audio); in-game render visually confirmed. (`mulberry32`/`RNG_TAGS`/`seedFrom`/`taggedSeed` retained for the numeric-hash-keyed levelNames + cosmetic-audio pickers — not the canonical map stream.)
- [x] SEED3 New Game modal: add the seed step to Landing (suggested phrase from event PRNG, editable, randomize button); thread `{seedPhrase, eventSeed}` through Shell's start flow. `?bonebusterSeed=<phrase>` overrides; legacy numeric accepted as a phrase string.
- [x] SEED4 Event PRNG persistence: bury `eventPrngSeed` in Capacitor Preferences (first-launch mint via crypto, advance-on-New-Game, restore-on-Continue). Wire combat/loot variance + the phrase randomizer to the event stream.
- [x] SEED5 Re-bless canonical + per-archetype screenshots against the canonical phrase; update CLAUDE.md/STANDARDS/DECISIONS (supersede D19); visual-verify the New Game modal + a phrase-seeded run live.

## Queue — comprehensive-review remediation (one branch, after SEED*)

Dependency-ordered. Drain top-down on a single branch.

### Enforcement + verification (mostly shipped via #82/#83 — finish the tail)
- [x] CR-rAF Root-caused the CI headless-GL rAF stall: `waitForFrames` waited on a `requestAnimationFrame` that stops firing while the `<Canvas>` WebGL context is torn down + rebuilt mid level-transition. Fixed by racing rAF against a 32ms `setTimeout` fallback in both e2e specs so the frame countdown can't stall; removed the CI skip on the 6-level "mission complete" pose — it gates CI again.
- [x] CR-C2 Screenshot specs now assert via Playwright's built-in `expect(buf).toMatchSnapshot(name, {maxDiffPixelRatio})` (no new deps). The 3 deterministic poses (landing + flashlight on/off) are baseline-gated with committed goldens; the 2 inherently-animated poses (going-back light strobe — oscillates ~70% peak↔trough; 6-level playthrough end-state) are `snapshotName: null` capture-only since pixel-diffing them flakes at any tolerance. Verified flake-free across 3 consecutive runs. The visual-regression gate is real now (full-review F2/C-2).
- [x] CR-H1 Wired `verify-pages-deploy.mjs` as a `verify-deploy` job in release.yml (needs deploy-pages, consumes its `page_url` output + appends debug flags, uploads the landing+ingame smoke shots). Added `verify:pages` script alias. The live-deploy smoke test now runs after every Pages deploy (full-review H-1).
- [x] CR-H2 Added an `android-release` CI job running `assembleRelease` (R8/ProGuard + shrinkResources, unsigned) gated on tags + the `mobile-perf` label, so the Play-shipping APK path is built (catches ProGuard keep-rule breakage that white-screens release but not debug). Added explicit `debuggable false` to the gradle release block (full-review H-2 + L-3a).

### Determinism rigor (partly shipped — tail)
- [x] CR-TS1 Flipped `noUncheckedIndexedAccess: true`; resolved all 482 surfaced sites across 78 files with considered guards (hoist-and-narrow in loops, throwing `at()` helpers for proven picks, honest miss-handling for lookups) — zero `!`/`as T`/reordering, verified by an independent pass. 1270 unit + 9 browser green. Applied via a 7-cluster workflow (full-review TS-1).
- [x] CR-TS4 Branded `Seed` (`type Seed = number & {__seed}`) so `mulberry32(entityId)` / raw-tag XOR is a compile error (full-review TS-4).
- [x] CR-F6 Extracted the URL-flag parsers to `app/views/urlFlags.ts` (pure `*FromHref` forms + thin window wrappers); Shell.tsx imports them. Table-tested the parse boundary in bonebuster-urlFlags.test.ts (17 cases: decimal/legacy-alias accept, signed-32-bit mask quirk documented, negative/hex/scientific/float/junk/empty reject, canonical-wins, unparseable-href→null) (full-review F6).

### The big perf + reconciliation win
- [x] CR-H1perf Convert `ParticleBurstField`/`ShellEjectField`/`BodyPartField` to `InstancedMesh` (dispose-on-despawn already shipped); add `gl.info`/`Howler._howls` perf-leak probes to the perf script (full-review H1/M1/F1).
  - DONE + COMMITTED: `src/scene/effects/instancedParticles.ts` (shared `InstancedParticlePool` + per-instance-alpha material via onBeforeCompile) + ParticleBurstField → one InstancedMesh. tsc clean, dispose test green, LIT visual capture confirmed the motes render with correct warm color + glow at the fire point.
  - DONE + COMMITTED: ShellEjectField → 1 InstancedMesh (per-instance rotation accumulator); BodyPartField → 2 InstancedMeshes (shard pool + flat decal pool). tsc clean, all 3 dispose tests green (1/1/2 InstancedMeshes), LIT visual capture confirmed shells + gibs + motes render with correct warm color/glow at the fire point.
  - DONE: added a `peakHowls` probe (`globalThis.Howler._howls.length`) to obs3-perf-snapshot's sample window + an OBS3_HOWL_BUDGET=64 gate, so a regression of the CR-M1 one-shot leak fails the perf job. Draw calls were already sampled from the OBS1 fpsUpdate stream (`gl.info.render.calls`) — the instancing win shows there + in the committed baselines. CR-H1perf COMPLETE.
- [x] CR-R1 Fixed `DamageNumberField`'s per-frame `force()` — render the pool once, animate imperatively in `useFrame` (full-review R-1).
- [x] CR-M1audio Cache one-shot Howls per variant file (ONESHOT_POOL keyed by variant path) so rapid fire reuses Howls + layers via Howler sound-ids instead of allocating + leaking a fresh Howl per `play()`; resetForTesting unloads the pool. Pinned by bonebuster-howlerOneshotCache.test.ts (40 plays → ≤3 constructions) (full-review M1).

### Structural decomposition (NEXT — the remaining large phase; sequence: eng → scene; F7/F8 fold in)
- [x] CR-H1eng Decomposed `src/engine/engine.ts` (1289) into 7 acyclic modules — `mapTypes` (types/guards/consts/EPS), `arrayAt` (shared `at()` guard), `gridGen` (`generateMap`), `gridCollision` + `sectors` (per-representation primitives), `collisionAny` (kind-agnostic dispatchers), `spawn` (entity spawning), `projectiles` (enemy-bullet sim, owns the in-direction `@ai` dep — fixes H-3). engine.ts DELETED, all 62 importers repointed in the same commit (codemod-classified per symbol), ARCHITECTURE/AGENTS module tables + archetype-axis registry pointer updated. tsc 0, 1296 unit + 17 browser + 5 canonical e2e screenshots green, full `pnpm verify` clean, import graph verified acyclic.
- [x] CR-H1scene DONE — both halves (see docs/specs/97-scene-decomposition.md). **Scene (a/b/c):** `<ScatterFields>` (12-child scatter cluster), `<EntityMeshes>` (the `<EnemyField>` slot), `runSceneTick()` (the 200-line main tick as a pure fn the unchanged useFrame calls — chosen over a `<SceneTickDriver>` child to keep frame-callback order byte-identical). Scene 1270→1028. **Shell (d):** GameState transitions promoted to a PURE `gameReducer(state,action,ctx)→{state,effects,iframeUntil,consumed}` returning effects-as-data; `useGameRef` is now a thin adapter running it once against `stateRef.current` + draining effects after setState — **flushSync fully dissolved** (TS-specialist-reviewed pattern; opus reviewer confirmed zero behavior deltas + a live drive showed no mid-render-dispatch errors). `useLevelTransition` hook extracted; lifecycle constants moved to leaf `@views/gameConstants` to break the Shell↔reducer value-import cycle. Shell 1063→1050. **CR-F8 folded in** (the `collectPickup` reducer arm IS the per-kind table). 30 new gameReducer tests + 8 sceneTick tests. tsc 0, 1334 unit + 17 browser + 5 canonical screenshots green.
- [x] CR-M1scatter Extracted `src/world/scatter/sampling.ts` with the shared `bboxOf` + `nearAny` (were 6 byte-identical copies) + `SCATTER_ID_STRIDE` (1000, unified — fixes the 100-vs-1000 drift) + `scatterId(sectorId, idx)` with a dev-mode overflow guard. All 7 scatter modules import them; 103 scatter tests + 9 new sampling-primitive tests green. (Scoped: extracted the duplicated PRIMITIVES + id-stride invariant — the per-module rejection LOOPS keep their distinct accept criteria rather than forcing one `sampleSectorPoints` signature; that fuller unification wasn't worth the coupling.) Also fixed the damageNumberPool browser-test flake (structural slot detector, no longer races troika async mount) — 6/6 clean (full-review M-1).

### Remaining quality + tests + docs tail
- [x] CR-F7 DONE. Pellet spread seeded: resolveFire advances a per-shot counter (after the cooldown+ammo gates) and forks `forkStream(map.seedPhrase, "FIRE-<n>")` for the spread draws — same (seed, shotIndex) → identical hits, different seed diverges. Shell wires a `shotCounterRef`. Shell-eject + particle jitter stay Math.random (render-only, no sim effect). Extracted `onEnemyKilled(enemy, meshesRef)→isBoss` (kill side-effects) from the pellet loop; the per-pellet body stays inline (a `resolvePellet` helper would need ~14 closure params — relocates complexity, same call as SceneTickDriver). New `bonebuster-fireResolution.test.ts` (4 deterministic-combat tests). Folded forward: removed the dead duplicate RUN_LENGTH from @views/gameConstants. tsc 0, 1338 unit + 17 browser + 5 screenshots green.
- [x] CR-F8 DONE (folded into CR-H1scene step-d). `onCollectPickup` is now the `collectPickup` arm of the pure `gameReducer` — a per-PickupKind table (health / flashlight / emfReader / spiritBox / uvFlashlight / crucifix / loot bottles-books-treasure / weapon-ammo) each returning `{next, effects}`. Per-kind reducer tests in `bonebuster-gameReducer.test.ts`.
- [x] CR-F9 Audio-graph lifecycle browser tests (`howlerBus`/`ambientGraph`/`musicGraph`) (full-review F9).
- [x] CR-poly P3 tail (done): `@lhci/cli` already latest + prod audit clean → added `pnpm audit --prod --audit-level=high` CI gate (prod-only tripwire, dev CVEs stay non-blocking) (L-1); fixed the ARCHITECTURE Scene.tsx dangling "see DECISIONS" ref → "CR-H1scene backlog" (D10); added a draw-call ceiling (MOBILE_CALL_BUDGET=1400, stable on the emulator vs noisy FPS) to the mobile perf script.
- [~] CR-e2e-hooks ROOT CAUSE FIXED. The real cause (found by stuck-loop-debugger, correcting my earlier worker-throw misdiagnosis): drei's `<Text>` calls `suspend(() => preloadFont(...))` UNCONDITIONALLY — it suspends until troika's font/worker pipeline resolves, which never happens when troika's blob-worker fails to rehydrate under Vite. With no Suspense boundary, that suspension **prevented the entire BoneBusterScene subtree from committing**, so its effects (incl. the `debugKillAll` listeners) never ran. This was a LATENT PRODUCTION BUG, not just a test issue — any troika hang would silently kill all Scene effects. FIX: `DamageNumberField` now renders troika text via a non-suspending R3F `<primitive>` (local `TroikaText` over a `new TroikaTextMesh()` + `.sync()`), so the slot pool commits synchronously in every context and the scene never blocks on troika. Bundled-font pin + `optimizeDeps.include` + a `.d.ts`. Brand+SEED3-flow rot also fixed (landing + new-game). **kill test + damage-tick now green; damageNumberPool browser test stays green (the non-suspending path satisfies its 24-slot contract).** SECOND root cause ALSO fixed (stuck-loop-debugger + my GL-backend call): the HUD commit was STARVED by r3f's useFrame loop under headless SwiftShader — react rendered the new value but the DOM mutation never flushed (key/kill/portal HUD stayed stale despite fresh getState). The gameplay spec was the only one still on SwiftShader; pointed it at the ANGLE-GL backend (matching the screenshot/browser specs + real hardware, where the starvation never occurs — it's a SwiftShader-only artifact). key-pickup + kill + portal + landing + new-game now pass on ANGLE-GL. NOTE: step-d's useGameRef docstring invariant ("GameRef callbacks fire outside React render") is technically FALSE — they fire inside r3f's useFrame; flushSync removal is still correct because the reducer is pure + effects drain after setState, but the docstring should be softened. RESIDUAL (e2e-harness robustness, NOT app bugs, NOT CI-gated): full-run GPU contention flakes a few tests that pass in isolation; the enemy-damage test (#90) is timing-fragile (waits on AI aggro+attack); the run-history sql-wasm fetch fails under the Playwright dev server. Tail items — the core debug-hook breakage (both root causes) is resolved.
- [ ] [WAIT-HW] CR-shadows `shadows="soft"`→hard in the low-FPS adaptive window (full-review L2). Needs a real Pixel-5a-class device to judge the soft-vs-hard PCF cost + confirm the downgrade reads acceptably — pure on-device tuning, can't validate headlessly (the e2e GL backend renders shadows differently). Hardware-blocked.

## Closeout notes

- **Pages deploy was 11 days stale (2026-05-28):** v0.5.0 (5-17) was the last release/deploy; #82 (`chore:`) + #83 (`ci: …; fix(assets): …`) landed on main but release-please saw no releasable LEADING conventional-commit (the `fix(assets):` in #83 was not the first token), so no tag → no release.yml deploy. Working as designed. Resolved: forced `release.yml` via `workflow_dispatch -f force_deploy=true` (manual escape-hatch) → built + deployed main (sha 5e43f65) to Pages; live-verified the menu renders at <https://arcade-cabinet.github.io/bone-buster/> (HTTP 200, wordmark + 4 buttons). LESSON: a squash title's LEADING token is what release-please parses — set PR #84's title to `feat: …` so its merge cuts v0.6.0 + auto-deploys.
- Pages-deploy live-verify script drives past landing → skill → level → in-game — PR #77, 2026-05-17.
- SLA1–SLA5 slasher gameplay (meathook pull, chainsaw aggro, boss music, flavor names, signal tokens) — PR #75 follow-up, 2026-05-17.
- v0.5.0 released + GitHub Pages deploy verified visually — 2026-05-17.
- D19 dual-PRNG + R8 rebrand follow-up — PR #75, 4 commits 2026-05-17.
- Reference-asset drain (Lanes C/D/E/F) + InstancedField perf — PR #75, 26 commits 2026-05-16.
- PB1–PB5 + PA1–PA2 — PRs #66, #67, #68, #70, #71, #72, #73.
- ARCHETYPE INTERLEAVE drained — commits `a4daceb` through `be4e4af`.
- MIGRATE lane (M4 + M5) cut as non-applicable — GitHub redirect handles it.
