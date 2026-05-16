# Bone Buster — live work queue

**Status:** RELEASED
**Branch:** `overhaul/bone-buster` — one long-running branch held every commit while the queue drained.
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

## Queue

(empty — the overhaul backlog is drained. Authoring a new
directive starts from `docs/PRD.md` and any remaining items
there, or from new user intent.)

## Closeout note (2026-05-16)

ARCHETYPE INTERLEAVE drained — see commits `a4daceb` through
`be4e4af` and the per-archetype audit docs under `docs/audits/`.

MIGRATE lane (M4 + M5) cut as non-applicable — GitHub's
repo-rename redirect handles all the durable substitutes;
there is no separate OLD repo with a Pages deployment to
manage. PRD §MIGRATE updated with the empirical findings.
