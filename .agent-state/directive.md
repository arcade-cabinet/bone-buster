# Bone Buster — live work queue

**Status:** ACTIVE
**Branch:** one long-running branch per slice. PRs squash-merge to main when their slice is fully verified + reviewers folded.
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
6. Push + open one PR per coherent slice (lane completion or larger), not per commit (per the no-pr-per-commit rule).

## Queue

(empty — overhaul + v0.5.0 shipped + live Pages deploy verified end-to-end.)

## Closeout notes

- Pages-deploy live-verify script drives past landing → skill → level → in-game — PR #77, 2026-05-17.
- SLA1–SLA5 slasher gameplay (meathook pull, chainsaw aggro, boss music, flavor names, signal tokens) — PR #75 follow-up, 2026-05-17.
- v0.5.0 released + GitHub Pages deploy verified visually — 2026-05-17.
- D19 dual-PRNG + R8 rebrand follow-up — PR #75, 4 commits 2026-05-17.
- Reference-asset drain (Lanes C/D/E/F) + InstancedField perf — PR #75, 26 commits 2026-05-16.
- PB1–PB5 + PA1–PA2 — PRs #66, #67, #68, #70, #71, #72, #73.
- ARCHETYPE INTERLEAVE drained — commits `a4daceb` through `be4e4af`.
- MIGRATE lane (M4 + M5) cut as non-applicable — GitHub redirect handles it.
