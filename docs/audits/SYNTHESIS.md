---
title: Audit Synthesis — Phase 21 Plan
updated: 2026-05-15
status: current
domain: context
---

# Audit synthesis — 5 specialists, 1 plan

5 specialists audited the repo in parallel post-Phase 20. Headlines:

| Audit | Headline | Severity floor |
|---|---|---|
| [PERF](PERF-AUDIT.md) | Draw-call dominated. Corridor 834 / courtyard 887 calls burn 80-90% of budget at 18-32k tris. Walls + static scatter clone-per-instance. | Mobile-critical |
| [SECURITY](SECURITY-AUDIT.md) | STRONG. Zero CVEs, zero injection sinks, debug-gate verified at bytecode. 2 MEDIUMs (sourcemap fingerprint, Android debug-build). | Defense-in-depth |
| [COMPLEXITY](COMPLEXITY-AUDIT.md) | `mulberry32` copy-pasted 13× with one divergent variant in barrels.ts. 4 god files: Shell(1129), Scene(1046), engine(1174), HUD(868). | Future foot-gun |
| [ARCHITECTURE](ARCHITECTURE-AUDIT.md) | Sim purity held. `(seed>>>0)%5` inlined at 11+ sites. 10+ scattered `Record<PropArchetype,T>` with no central axis registry. | Forward-looking |
| [TEST](TEST-AUDIT.md) | 625 unit / 6 browser / 5 canonical all green. Zero `.skip`/`.todo`. `objexoom-fade.test.ts` is a tautology. OBS3 desktop-only. | Excellent baseline |

## Convergent findings (3+ audits agree)

These are the highest-leverage shipping targets because multiple specialists independently arrived at them:

### CONV1 — `src/prng.ts` extraction (PERF + COMPLEXITY + ARCHITECTURE)
- COMPLEXITY F1/F5: 13× copy with `barrels.ts:189` using `|0` instead of `>>> 0` — silent determinism risk.
- ARCHITECTURE §2.3: 12 inline copies + per-system XOR tags scattered with no central registry.
- PERF context: scatter modules are the hot path; consolidating PRNG is a prereq for any scatter-side perf refactor.
- **Action:** new `src/prng.ts` with `mulberry32(seed)` + `RNG_TAGS` registry. Tests pin byte-stability (same input → same output for every existing consumer).
- **Effort:** 3 hours. **Net LOC:** -80.

### CONV2 — Shell + Scene + engine.ts decomposition (COMPLEXITY + ARCHITECTURE)
- COMPLEXITY F2/F3/F4: 3 god files, 1129/1046/1174 LOC.
- ARCHITECTURE §2.1: ARCHITECTURE.md:71 self-flags this; no DECISIONS entry tracks it.
- **Action:** start with `src/scene/hooks/useGameRef.ts` extraction (§2.1 surgical first commit). ~150 LOC moves out of Shell.
- **Effort:** 6 hours. **Risk:** behavior-preserving by construction.

### CONV3 — `map.archetype` denormalization (ARCHITECTURE + COMPLEXITY)
- ARCHITECTURE §2.2: `(seed>>>0)%5` inlined at engine.ts:378, buildMap.ts:26, every scatter module.
- COMPLEXITY F6 (adjacent): `pickArchetype(map)` is called redundantly across consumers.
- **Action:** add `archetype: PropArchetype` to `ObjexoomMap` type. `buildMap.ts` populates once. All consumers read `map.archetype`.
- **Effort:** 4 hours. **Unblocks:** 6th archetype + curated levels (ARCH §6).

## Quick wins — under 2 hours each (mostly PERF)

| # | From | What | Win |
|---|---|---|---|
| QW1 | PERF #2 quick win 1 | Hoist `Vector3` scratches in `fireResolution.ts:129,145,173-174` | Tiny but in hot path |
| QW2 | PERF #3 quick win 2 | Drop `castShadow` on `LampField.tsx:51-57` lamp pointLights | -6 shadow passes/frame per lit lamp |
| QW3 | PERF #2 quick win 3 | Hoist BodyShard/Shell/Mote geometries+materials to module scope | -50KB/sec GC churn |
| QW4 | PERF #6 quick win 4 | Gate ChromaticAberration on `pulseActive` only | -1 fullscreen pass/frame for 99% of frames |
| QW5 | PERF #5 quick win 5 | Delete redundant `mesh.lookAt(player)` in `enemyTickLoop.ts:200-213` | -1 matrix recompute per enemy/frame |
| QW6 | PERF #4 quick win 7 | Flashlight shadow 1024² → 512² | Halves shadow-map cost |
| QW7 | SEC #1 | Strip sourcemaps from gh-pages artifact in `release.yml` | -10MB public artifact, blocks dep-version fingerprinting |
| QW8 | COMPLEXITY F6 | Rename `src/scene/hooks/` → `src/scene/tick/` | Reader cognitive load — zero behavior change |
| QW9 | TEST S1 / COMPLEXITY F12 | Fix `objexoom-fade.test.ts` tautology (import real table or delete) | One real test, not a self-asserting copy |
| QW10 | PERF #8 | Pin `AdaptiveResolution` useFrame to `priority={2}` | Fixes OBS1 sampling contract |

## Architectural changes — multi-day

| # | From | What | Effort | Win |
|---|---|---|---|---|
| A1 | PERF Architectural A | InstancedMesh for walls + static scatter (props/lamps/debris/decals/large-props/nature/kitchen/npcs) | 2-3 days | -200-400 draw calls. Corridor 834 → ~450. |
| A2 | PERF Architectural B | InstancedMesh for ephemeral pools (body parts, shells, motes, bullets) | 1-2 days | -500 draw calls in heavy combat. Flattens GC. |
| A3 | PERF Architectural C | Selective postprocess chain — Bloom gated by AdaptiveResolution lowQuality flag | 1 day | -30% fragment time when mobile throttled |
| A4 | PERF Architectural D | Tiered asset preload (critical / map-mount / deferred) | 1 day | -2s TTI on cold-start mobile |
| A5 | PERF Architectural E | Music synth defer — `ensureSfxCritical` vs `ensureMusic` | 0.5 day | -300ms time-to-first-shot mobile |
| A6 | ARCHITECTURE §2.4 | `src/archetype/registry.ts` enumerating all archetype-keyed records | 0.5 day | Unblocks 6th archetype with a checklist |
| A7 | ARCHITECTURE §7.5 | D15/D16/D17/D18 backfill in DECISIONS.md (AUDIO1, ARCH2, ARCH3, persistence) | 2 hours | Restores audit trail |

## Test gate hardening

| # | From | What | Effort |
|---|---|---|---|
| T1 | TEST G1 | POL1 score HUD end-to-end browser test (~25 lines) | 1 hour |
| T2 | TEST G2 | AdaptiveResolution `stepPixelRatio` pure-fn unit tests (7 cases) | 2 hours |
| T3 | TEST §6 | Per-archetype visual gate depth — courtyard wreck, library kitchen, library NPCs, sewer water, corridor enemy-hit-mid-burst | 2 hours |
| T4 | TEST §7 | OBS3 capture `avgFps` from `fpsUpdate`, budget at 55 (desktop) | 1 hour |
| T5 | TEST §7 | OBS3 mobile-emulator job (Pixel 5a system image), `avgFps >= 30` budget | 1 day |
| T6 | TEST S2 | Stop swallowing screenshot failures in `tests/e2e/objexoom.spec.ts` `.catch` calls | 30 min |
| T7 | TEST S3/F1 | Replace `waitForTimeout(900)` in `screenshots.spec.ts` with RAF-counting hooks | 1 hour |
| T8 | TEST G5 | Unit test for `src/assetUrl.ts` `A()` BASE_URL helper (gh-pages/Capacitor regression vector) | 30 min |

## Security follow-ups (defense-in-depth)

| # | From | What | Severity |
|---|---|---|---|
| S1 | SEC #2 | Android `allowBackup="false"` + R8 minification (when release build wired) | MEDIUM (deployment readiness) |
| S2 | SEC #3 | CSP meta tag in index.html (`default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; …`) | LOW |
| S3 | SEC #4 | `network_security_config.xml` with `cleartextTrafficPermitted="false"` | LOW |

## Recommended Phase 21 sequencing

Run convergent items first — they're prereqs or unlock subsequent work:

1. **CONV1** — `src/prng.ts` (3h)
2. **CONV3** — `map.archetype` denormalization (4h)
3. **QW1–QW10** quick wins, parallel-ready (each <2h)
4. **CONV2** — `useGameRef` extraction (6h)
5. **A6** + **A7** — archetype registry + DECISIONS backfill (4h total)
6. **T1**–**T8** test hardening (interleaved with above as gates demand)
7. **A1** — InstancedMesh static scatter (2-3 days, the big perf win)
8. **A2** — InstancedMesh ephemeral pools (1-2 days)
9. **A3**–**A5** — postprocess / preload / music defer (≤1 day each)
10. **T5** — Pixel 5a emulator perf gate (1 day, the actual mobile-readiness gate)
11. **S1**–**S3** — security DiD pass (≤2h each)

After CONV1+CONV3 ship, the rest can fan out — most have no dependencies on each other.

## Not doing

Items explicitly considered and declined:

- **OBS3 desktop-only** is a known scope limit (TEST §7). T5 closes it.
- **`as any` in 2 tests** (COMPLEXITY F-table) — both are invalid-input tests for empty-return paths. Replace with `@ts-expect-error` if it bothers you; otherwise leave.
- **SHA-pin GitHub Actions** (SEC #8) — INFO-level. Industry norm to use major-tag pins for hobby-scale projects. Dependabot already covers github-actions.
- **`__objexoomJeepSqliteReady` global** (SEC #6) — namespace pollution, no exploit value. Leave.
- **`enemyAi.test.ts` describe-scope shared `const map`** (TEST S4) — cosmetic. 40 sites would have to change. Not worth it.
- **Music timer drift instrumentation** (PERF instrumentation gap #4) — captured but currently in budget. Add only if drift becomes user-visible.

## Decision authorities

- **CONV1+CONV3+CONV2 = ARCH3.5-grade refactors** — write D-entries in DECISIONS.md when shipping (per ARCHITECTURE §7.5 pattern).
- **A1+A2 InstancedMesh** — re-snapshot `tests/perf-baselines/*.json` (numbers will move). Use `// no-visual-impact: <reason>` override only if the visual gate stays byte-stable; otherwise re-bless the screenshots.
- **T5 mobile gate** — adds CI time. If the Android emulator job pushes total CI past 10min, gate behind a `[mobile-perf]` label or run on release only.
