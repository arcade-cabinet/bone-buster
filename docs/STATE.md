---
title: Current state
updated: 2026-05-15
status: current
domain: context
---

# Current state

Snapshot of where Bone Buster stands. Refreshed on each
material milestone; for the truly live picture read
`.agent-state/directive.md` and `git log`.

## Shipped to date

- **Reference-clone parity** — 100% reached at E12
  (commit 57dd8fa). Every mechanic in the
  `js13k2019-yet-another-doom-clone` reference is ported
  + tested.
- **Elevation phases** — E1 through E13 shipped. Catalog
  at [`docs/ELEVATION.md`](./ELEVATION.md).
- **Perf + complexity + arch sweep** — five-specialist
  audit landed 2026-05-15. CONV1 (PRNG consolidation),
  quick-wins QW1-QW10, postprocess chain (A3), tiered
  preload (A4), mobile-perf CI gate (T5), Android release
  hardening (S1) all shipped.
- **Repo rebrand + move** — repo renamed
  `objexiv/objexoom` → `arcade-cabinet/bone-buster` on
  2026-05-15. Local working copy stays at
  `~/src/objexiv/objexoom`; GitHub's git-protocol redirect
  routes the old origin URL transparently.
- **Documentation overhaul (in PR #60)** — every doc
  surface swept to Bone Buster identity; PRD rewritten as
  authoritative remaining-work spec; directive slimmed to
  lean queue; doctrine moved into `STANDARDS.md`.

Full audit trail: `git log` + `.agent-state/decisions.ndjson`
(searchable via `ctx_search source:"decisions:bone-buster"`).
Human-readable release history: `CHANGELOG.md` (generated
by release-please from Conventional Commit messages).

## In flight

The active work-unit is the **overhaul** lane stack in
[`docs/PRD.md`](./PRD.md):

| Lane | Status | What's next |
| --- | --- | --- |
| ITCH-FETCH | not started | IF1 — adapt voxel-realms fetcher |
| REBRAND | DRAINED | R5b/R6/R7/R8/R8b/R9/R10 all shipped (commits in overhaul branch) |
| IDENTITY | DRAINED | D1/D2/D3/D4/D5/D6/D8/D9 all shipped |
| ARCHETYPE INTERLEAVE | DRAINED | all 5 archetypes audited; corridor + library A1 migrations shipped (DebrisField + KitchenField); A2 (ephemeral pool) deferred per architectural decision |
| AUDIO | DRAINED | A11a-A11f all shipped — Howler swap, music graph, ambient graph, runtime audio verifier |
| BUILD-CONFIG | DRAINED | BC1-BC7 all shipped; gh-pages base path fixed |
| RESTRUCTURE | DRAINED | RS1-RS6 all shipped; `app/` + `src/` layout adopted, all imports updated |
| MIGRATE | CUT | M4 + M5 cut as non-applicable — GitHub's repo-rename redirect IS the durable substitute. See PRD §MIGRATE for empirical findings. |

## Known issues

- **No actively known runtime bugs.** The overhaul slice (PR #62)
  drained the full directive; visual gate green (5 canonical + 10
  per-archetype e2e screenshots); 818 unit tests pass; perf within
  budget across all 5 archetypes (post-D5 + post-A1 baselines).

## Active branch

`overhaul/bone-buster` — the single long-running branch that
holds every commit for this overhaul slice. PR #62 squash-merges
to main on 2026-05-16.
