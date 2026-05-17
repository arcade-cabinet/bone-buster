# Bone Buster — live work queue

**Status:** RELEASED
**Branch:** one long-running perf/parked branch per slice. PRs squash-merge to main when their slice is fully verified + reviewers folded.
**Authority chain:** DESIGN > ARCHITECTURE > DECISIONS > **PRD** > this file > ROADMAP.
**Spec:** [`docs/PRD.md`](../docs/PRD.md) carries the user stories, surfaces, and acceptance bars. Each item below points at its PRD section for the why and the verifiable acceptance.
**Standards:** [`STANDARDS.md`](../STANDARDS.md) carries doctrine (quality bar, slot architecture, no-end-of-turn, design tokens, etc).
**Decisions:** [`docs/DECISIONS.md`](../docs/DECISIONS.md) carries binding technical decisions.
**Audit trail:** shipped items live in `git log` + `.agent-state/decisions.ndjson` + `CHANGELOG.md`. They are not preserved in this file.

## Operating loop (for the next directive)

1. Pick the topmost unchecked item.
2. Read its PRD section for the acceptance bar.
3. Implement, run `pnpm verify`, commit, dispatch reviewer trio locally.
4. Fold reviewer findings into the next forward commit.
5. Flip `[ ]` → `[x]` in the same commit; **delete the item from this file** in the next forward-going commit (per the prune-shipped-from-directive rule).
6. Push + open one PR per coherent slice (lane completion or larger), not per commit (per the no-pr-per-commit rule).

## Queue — Post-overhaul drain (user-directed 2026-05-16)

Mandate: drain everything — directive, PRD §Parked, residual perf wins surfaced by the Lighthouse gate now in CI. Each lane ships as its own squash-merged PR.

### Lane A — Perf follow-up (Vike/Lighthouse-adjacent)
(empty — PA1 vendor-split + PA2 title-preload shipped via PR #66 using Rolldown's `advancedChunks.groups` API + Vike's `injectFilter` for font auto-preload suppression.)

### Lane B — PRD §Parked drain
(empty — PB1/PB2/PB3/PB4/PB5 all shipped: PR #67 type rename, PR #68 kill banner, PR #70 InstancedMultiGltfField for prop/large-prop fields, PR #71 per-skin melee damage profiles, PR #72 EMF reader as the PB5 vertical slice. Follow-up ghost-hunting tools — spirit box / UV flashlight / crucifix — land as separate slices once the EMF shape proves out; see `docs/GHOST-HUNTING.md` for the slice plan.)

### Ship rules
- One PR per lane item, squash-merged.
- Reviewer trio (code/security/simplification) dispatched locally per commit; findings folded forward.
- Lighthouse gate must stay green on every Lane A merge; perf snapshot must stay green on every Lane B item that touches scene/render.
- Prune from this file in the commit that closes the item.

## Closeout note (2026-05-16)

ARCHETYPE INTERLEAVE drained — see commits `a4daceb` through
`be4e4af` and the per-archetype audit docs under `docs/audits/`.

MIGRATE lane (M4 + M5) cut as non-applicable — GitHub's
repo-rename redirect handles all the durable substitutes;
there is no separate OLD repo with a Pages deployment to
manage. PRD §MIGRATE updated with the empirical findings.
