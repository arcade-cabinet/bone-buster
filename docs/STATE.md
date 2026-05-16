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
| REBRAND | not started | R1 — install Bone Buster fonts |
| IDENTITY | not started | D1 — locked-weapon HUD chips |
| ARCHETYPE INTERLEAVE | not started | corridor slice (depends on IF5/IF6 for new extracts) |
| AUDIO | not started | A11a — audio inventory (depends on IF5) |
| BUILD-CONFIG | not started | BC1 — vite.config.ts overhaul |
| RESTRUCTURE | not started | RS1 — migration plan doc |
| MIGRATE | not started | M4 — OLD repo Pages redirect |

Order within a lane is topological. Across lanes:
ITCH-FETCH gates D5/D7/D9/A11; REBRAND gates anything
visual; BUILD-CONFIG fixes the deployed Pages site
(currently broken — see PRD §BC3); RESTRUCTURE happens
when imports are stable.

## Known issues

- **GH Pages deploy is broken.** Diagnosed 2026-05-15:
  `https://arcade-cabinet.github.io/bone-buster/`
  returns 200 but `index.html` references
  `/objexoom/assets/index-*.js` (404). Root cause:
  `vite.config.ts:8` hardcodes `base: "/objexoom/"` for
  `mode === "github-pages"`. Fix tracked at PRD §BC3.
- **No actively known runtime bugs.** Phase 21 polish
  cleared the last regression batch; visual gate is
  green; mobile-perf baseline is within budget on the
  Pixel 5a-class CI target.

## Active branch

`docs/p22-rebrand-brainstorm` — the docs-only PR #60
landing the rebrand sweep. After PR #60 merges, work
moves to the long-running `overhaul` branch for the
code + asset overhaul drainage.
