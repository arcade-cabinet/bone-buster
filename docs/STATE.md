---
title: Current state
updated: 2026-05-17
status: current
domain: context
---

# Current state

Snapshot of where Bone Buster stands. Refreshed on each
material milestone; for the truly live picture read
`.agent-state/directive.md` and `git log`.

## Shipped to date

- **Reference-clone parity** — 100% reached at E12
  (commit `57dd8fa`). Every mechanic in the
  `js13k2019-yet-another-doom-clone` reference is ported
  + tested.
- **Elevation phases E1–E13** — full catalog at
  [`docs/ELEVATION.md`](./ELEVATION.md).
- **Perf + complexity + arch sweep** — CONV1 (PRNG
  consolidation), QW1–QW10, A3 postprocess chain, A4 tiered
  preload, T5 mobile-perf CI gate, S1 Android release
  hardening.
- **Repo rebrand + move** — `objexiv/objexoom` →
  `arcade-cabinet/bone-buster` on 2026-05-15. Local working
  copy stays at `~/src/objexiv/objexoom`; GitHub's git-
  protocol redirect routes the old origin URL transparently.
- **Overhaul lane stack drained** (2026-05-15 → 2026-05-17):
  BUILD-CONFIG, RESTRUCTURE, ITCH-FETCH, REBRAND R1–R10,
  AUDIO A11a–A11f, IDENTITY D1–D9, ARCHETYPE INTERLEAVE
  (5 slices × D7-X/A1-X/A2-X). See
  [`docs/ROADMAP.md`](./ROADMAP.md) for the milestone list.
- **Reference-asset drain** (Lanes C/D/E/F) — PC1–PC4 ghost-
  hunting tools, PD1–PD3 + PD3b weapon variants, PE1–PE3 +
  PE4a–c per-archetype scenery, PF1–PF3 horror-fantasy
  enemies. Shipped in PR #75.
- **InstancedField perf migration** (PT1–PT6) — TrapField /
  NatureField / LampField / CrucifixField all migrated;
  per-instance draw calls collapsed.
- **D19 dual-PRNG + R8 event-prefix rename** —
  `docs/DECISIONS.md` §D19. Cosmetic stream (seedrandom alea)
  isolates skin pickers + `pickNaturePlant` +
  `pickSpiritBoxPhoneme` from canonical world-shape
  byte-stability. Window-event prefix renamed
  `objexoom:` → `bonebuster:`.

Full audit trail: `git log` + `.agent-state/decisions.ndjson`
(searchable via `ctx_search source:"decisions:bone-buster"`).
Human-readable release history: `CHANGELOG.md` (generated
by release-please from Conventional Commit messages).

## In flight

**PR #75** — `feat/ght-emf-asset`, 30 commits. Every CI gate
green (verify, android, lighthouse, perf, CodeQL, CodeRabbit).
Awaiting human review-merge.

## Known issues

- **No known runtime bugs.** Visual gate green (5 canonical +
  10 per-archetype e2e screenshots); 962 unit + 6 browser
  tests pass; perf within budget across all 5 archetypes.
- Dependabot low-severity alert on `tmp` transitive
  (GHSA-52f5-9888-hmc6, CVE-2025-54798). Not user-facing;
  no path in this codebase invokes the vulnerable surface.

## Active branch

`feat/ght-emf-asset` — single long-running branch holding
every overhaul-drain commit. Squash-merges to `main` once
PR #75 reviews complete.
