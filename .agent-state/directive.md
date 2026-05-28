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

### Structural decomposition
- [ ] CR-H1eng Decompose `src/engine/engine.ts` (1344) along type seams into mapTypes/gridGen/collision/raycast/sectors/spawn/projectiles; move the yuka import into `projectiles.ts` (fixes the H-3 wrong-direction dep).
- [ ] CR-H1scene Extract `<EnemyField>`/`<ScatterFields>`/`<SceneTickDriver>` from `app/views/Scene.tsx` (1261); promote GameState to a `gameReducer` + extract `useLevelTransition` from `Shell.tsx` (1060), dissolving the `flushSync` buffering (full-review H-1/M-2/M-3).
- [x] CR-M1scatter Extracted `src/world/scatter/sampling.ts` with the shared `bboxOf` + `nearAny` (were 6 byte-identical copies) + `SCATTER_ID_STRIDE` (1000, unified — fixes the 100-vs-1000 drift) + `scatterId(sectorId, idx)` with a dev-mode overflow guard. All 7 scatter modules import them; 103 scatter tests + 9 new sampling-primitive tests green. (Scoped: extracted the duplicated PRIMITIVES + id-stride invariant — the per-module rejection LOOPS keep their distinct accept criteria rather than forcing one `sampleSectorPoints` signature; that fuller unification wasn't worth the coupling.) Also fixed the damageNumberPool browser-test flake (structural slot detector, no longer races troika async mount) — 6/6 clean (full-review M-1).

### Remaining quality + tests + docs tail
- [ ] CR-F7 Seed pellet spread via per-shot `mulberry32`, extract `resolvePellet`/`applyMelee*`/`onEnemyKilled` from `resolveFire`, add a deterministic combat test (full-review F7).
- [ ] CR-F8 Table-drive `onCollectPickup`; add per-kind reducer tests (full-review F8).
- [ ] CR-F9 Audio-graph lifecycle browser tests (`howlerBus`/`ambientGraph`/`musicGraph`) (full-review F9).
- [x] CR-poly P3 tail (done): `@lhci/cli` already latest + prod audit clean → added `pnpm audit --prod --audit-level=high` CI gate (prod-only tripwire, dev CVEs stay non-blocking) (L-1); fixed the ARCHITECTURE Scene.tsx dangling "see DECISIONS" ref → "CR-H1scene backlog" (D10); added a draw-call ceiling (MOBILE_CALL_BUDGET=1400, stable on the emulator vs noisy FPS) to the mobile perf script.
- [ ] [WAIT-HW] CR-shadows `shadows="soft"`→hard in the low-FPS adaptive window (full-review L2). Needs a real Pixel-5a-class device to judge the soft-vs-hard PCF cost + confirm the downgrade reads acceptably — pure on-device tuning, can't validate headlessly (the e2e GL backend renders shadows differently). Hardware-blocked.

## Closeout notes

- Pages-deploy live-verify script drives past landing → skill → level → in-game — PR #77, 2026-05-17.
- SLA1–SLA5 slasher gameplay (meathook pull, chainsaw aggro, boss music, flavor names, signal tokens) — PR #75 follow-up, 2026-05-17.
- v0.5.0 released + GitHub Pages deploy verified visually — 2026-05-17.
- D19 dual-PRNG + R8 rebrand follow-up — PR #75, 4 commits 2026-05-17.
- Reference-asset drain (Lanes C/D/E/F) + InstancedField perf — PR #75, 26 commits 2026-05-16.
- PB1–PB5 + PA1–PA2 — PRs #66, #67, #68, #70, #71, #72, #73.
- ARCHETYPE INTERLEAVE drained — commits `a4daceb` through `be4e4af`.
- MIGRATE lane (M4 + M5) cut as non-applicable — GitHub redirect handles it.
