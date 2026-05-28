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

## Queue — comprehensive-review remediation (one branch)

Dependency-ordered. Drain top-down on a single branch.

### Enforcement + verification (mostly shipped via #82/#83 — finish the tail)
- [x] CR-rAF Root-caused the CI headless-GL rAF stall: `waitForFrames` waited on a `requestAnimationFrame` that stops firing while the `<Canvas>` WebGL context is torn down + rebuilt mid level-transition. Fixed by racing rAF against a 32ms `setTimeout` fallback in both e2e specs so the frame countdown can't stall; removed the CI skip on the 6-level "mission complete" pose — it gates CI again.
- [x] CR-C2 Screenshot specs now assert via Playwright's built-in `expect(buf).toMatchSnapshot(name, {maxDiffPixelRatio})` (no new deps). The 3 deterministic poses (landing + flashlight on/off) are baseline-gated with committed goldens; the 2 inherently-animated poses (going-back light strobe — oscillates ~70% peak↔trough; 6-level playthrough end-state) are `snapshotName: null` capture-only since pixel-diffing them flakes at any tolerance. Verified flake-free across 3 consecutive runs. The visual-regression gate is real now (full-review F2/C-2).
- [x] CR-H1 Wired `verify-pages-deploy.mjs` as a `verify-deploy` job in release.yml (needs deploy-pages, consumes its `page_url` output + appends debug flags, uploads the landing+ingame smoke shots). Added `verify:pages` script alias. The live-deploy smoke test now runs after every Pages deploy (full-review H-1).
- [x] CR-H2 Added an `android-release` CI job running `assembleRelease` (R8/ProGuard + shrinkResources, unsigned) gated on tags + the `mobile-perf` label, so the Play-shipping APK path is built (catches ProGuard keep-rule breakage that white-screens release but not debug). Added explicit `debuggable false` to the gradle release block (full-review H-2 + L-3a).

### Determinism rigor (partly shipped — tail)
- [x] CR-TS1 Flipped `noUncheckedIndexedAccess: true`; resolved all 482 surfaced sites across 78 files with considered guards (hoist-and-narrow in loops, throwing `at()` helpers for proven picks, honest miss-handling for lookups) — zero `!`/`as T`/reordering, verified by an independent pass. 1270 unit + 9 browser green. Applied via a 7-cluster workflow (full-review TS-1).
- [ ] CR-TS4 Brand `Seed` (`type Seed = number & {__seed}`) so `mulberry32(entityId)` / raw-tag XOR is a compile error (full-review TS-4).
- [x] CR-F6 Extracted the URL-flag parsers to `app/views/urlFlags.ts` (pure `*FromHref` forms + thin window wrappers); Shell.tsx imports them. Table-tested the parse boundary in bonebuster-urlFlags.test.ts (17 cases: decimal/legacy-alias accept, signed-32-bit mask quirk documented, negative/hex/scientific/float/junk/empty reject, canonical-wins, unparseable-href→null) (full-review F6).

### The big perf + reconciliation win
- [ ] CR-H1perf Convert `ParticleBurstField`/`ShellEjectField`/`BodyPartField` to `InstancedMesh` (dispose-on-despawn already shipped); add `gl.info`/`Howler._howls` perf-leak probes to the perf script (full-review H1/M1/F1).
  - DONE + COMMITTED: `src/scene/effects/instancedParticles.ts` (shared `InstancedParticlePool` + per-instance-alpha material via onBeforeCompile) + ParticleBurstField → one InstancedMesh. tsc clean, dispose test green, LIT visual capture confirmed the motes render with correct warm color + glow at the fire point.
  - DONE + COMMITTED: ShellEjectField → 1 InstancedMesh (per-instance rotation accumulator); BodyPartField → 2 InstancedMeshes (shard pool + flat decal pool). tsc clean, all 3 dispose tests green (1/1/2 InstancedMeshes), LIT visual capture confirmed shells + gibs + motes render with correct warm color/glow at the fire point.
  - REMAINING: (c) add `gl.info.render.calls` draw-call + `Howler._howls` perf-script probes to obs3-perf-snapshot so the draw-call win + Howl plateau are gated (full-review F1).
- [ ] CR-R1 Fix `DamageNumberField`'s per-frame `force()` — render the pool once, animate imperatively in `useFrame` (full-review R-1).
- [x] CR-M1audio Cache one-shot Howls per variant file (ONESHOT_POOL keyed by variant path) so rapid fire reuses Howls + layers via Howler sound-ids instead of allocating + leaking a fresh Howl per `play()`; resetForTesting unloads the pool. Pinned by bonebuster-howlerOneshotCache.test.ts (40 plays → ≤3 constructions) (full-review M1).

### Structural decomposition
- [ ] CR-H1eng Decompose `src/engine/engine.ts` (1344) along type seams into mapTypes/gridGen/collision/raycast/sectors/spawn/projectiles; move the yuka import into `projectiles.ts` (fixes the H-3 wrong-direction dep).
- [ ] CR-H1scene Extract `<EnemyField>`/`<ScatterFields>`/`<SceneTickDriver>` from `app/views/Scene.tsx` (1261); promote GameState to a `gameReducer` + extract `useLevelTransition` from `Shell.tsx` (1060), dissolving the `flushSync` buffering (full-review H-1/M-2/M-3).
- [ ] CR-M1scatter Extract a shared `src/world/scatter/sampling.ts` (`bboxOf`/`nearAny`/`sampleSectorPoints`/`SCATTER_ID_STRIDE`); collapse the 7 parallel scatter one-offs (full-review M-1).

### Remaining quality + tests + docs tail
- [ ] CR-F7 Seed pellet spread via per-shot `mulberry32`, extract `resolvePellet`/`applyMelee*`/`onEnemyKilled` from `resolveFire`, add a deterministic combat test (full-review F7).
- [ ] CR-F8 Table-drive `onCollectPickup`; add per-kind reducer tests (full-review F8).
- [ ] CR-F9 Audio-graph lifecycle browser tests (`howlerBus`/`ambientGraph`/`musicGraph`) (full-review F9).
- [ ] CR-poly P3 tail: `shadows="soft"`→hard in the low-FPS window (L2), `pnpm up @lhci/cli` + `pnpm audit --prod` gate (L-1), ARCHITECTURE sim/tick table + dangling-ref doc nits (D9/D10), mobile perf-script baseline-ratio.

## Closeout notes

- Pages-deploy live-verify script drives past landing → skill → level → in-game — PR #77, 2026-05-17.
- SLA1–SLA5 slasher gameplay (meathook pull, chainsaw aggro, boss music, flavor names, signal tokens) — PR #75 follow-up, 2026-05-17.
- v0.5.0 released + GitHub Pages deploy verified visually — 2026-05-17.
- D19 dual-PRNG + R8 rebrand follow-up — PR #75, 4 commits 2026-05-17.
- Reference-asset drain (Lanes C/D/E/F) + InstancedField perf — PR #75, 26 commits 2026-05-16.
- PB1–PB5 + PA1–PA2 — PRs #66, #67, #68, #70, #71, #72, #73.
- ARCHETYPE INTERLEAVE drained — commits `a4daceb` through `be4e4af`.
- MIGRATE lane (M4 + M5) cut as non-applicable — GitHub redirect handles it.
