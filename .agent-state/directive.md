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

## Queue — Reference-asset drain (user-directed 2026-05-16)

Mandate: drain unwired assets in `references/` and `references/_extracted/`. 798 GLBs/FBXs extracted; ~75 wired. Most-impactful pulls split across four lanes. Each lane ships as its own squash-merged PR.

### Lane C — Ghost Hunting Tools follow-ups (`docs/GHOST-HUNTING.md`)

Builds on PR #72's EMF vertical. Each slice opens its own PR. Asset extraction lands first because every subsequent tool needs viewmodels from the same zip.

### Lane D — Unused weapon-pack variants (mirrors PB4)

Pattern-match PB4's per-skin profile architecture for the ranged + extra-melee assets. Each slice = (a) wire the URL pool, (b) extend the profile table, (c) pick deterministic per-run, (d) contract test.

- [ ] PD3b Stylized Guns scene-split — Blender scene-split for `references/Stylized Guns 3D Models PRO.zip` (single combined FBX → 3-5 individual GLBs). Append-extends `CHAINGUN_SKIN_URLS` from 3 → 6-8 entries. Pure asset-pipeline slice; identity profile on canonical seed still pinned via existing PD3 contract test.

### Lane E — Per-archetype scenery packs

`references/_extracted/psx/psx-mega-pack-ii-v1-8/` carries 549 GLBs; the per-archetype scatter pools currently reference ~30. Wire the obvious archetype matches first. Each slice = inventory pass (Bash + Blender preview) → assign per-archetype prop GLBs → extend `PROP_CATALOGUE` / archetype prop pool → re-bake canonical archetype screenshot.

- [ ] PE2 Courtyard archetype — wire `references/_extracted/psx/psx-farm-assets/PSX-Farm Assets/` (85 GLBs: trees, apples, wooden posts, fences, hay bales). Maps cleanly to the courtyard's outdoor identity. Extend `propPool` with `COURTYARD_FARM_PROPS`. Visual gate: canonical courtyard screenshot shows farm-flavored scenery.
- [ ] PE3 Sewer archetype — wire `references/_extracted/psx/psx-electrical/PSX-Electrical/Assets/` (pipes, valves, machinery — 10 GLBs) into sewer-archetype propScatter. Replaces the current corridor-flavored placeholders in sewer with archetype-true industrial scenery.
- [ ] PE4 Mega Pack II ingest pass — 549 GLBs is too large for one slice. Architectural step before any code: inventory pass via Bash + Blender previews to bucket the pack into archetype buckets, then per-archetype follow-up slices land as PE4a..PE4n. Step-1 produces `docs/MEGA-PACK-II-INVENTORY.md` with per-archetype assignments + "ideas this asset gave me" list. No code in PE4 step-1.

### Lane F — Unwired horror-fantasy enemies

`references/_extracted/psx/psx-horror-fantasy-megapack/` carries 23 enemy GLBs; current `EnemyKind` union has 24 entries, ~10 of which point at horror-fantasy GLBs. The unwired 13 (bigfoot, alien_invader, anomaly_monster, !NEW Abomination2, multiple clowns) are candidates for new variants of existing kinds or net-new kinds.

- [ ] PF1 Enemy-kind expansion audit — `docs/audits/horror-fantasy-enemy-audit.md` (new). Per-GLB: name, mesh size, animation rigging status (the `_rigged/` subdir has rigged variants), suggested role (boss tier / regular / variant of existing). Use-case enumeration step before any spawn-table edits.
- [ ] PF2 Add bigfoot + alien_invader as new `EnemyKind` variants per the PF1 audit. New enemy mix entries per archetype; new MELEE_HP_TIERS rows; new animation mixer wiring in `EnemyMesh`. Spawn-table integration deferred to PF3 to keep PF2's surface tight (asset + type + base mechanics only).
- [ ] PF3 Spawn-table integration — extend per-archetype enemy mix weights so the new PF2 kinds actually spawn. Canonical archetype screenshot refresh; mobile-perf regression check stays green (more variant draw calls = potential perf hit).

### Ship rules

- One PR per lane item, squash-merged. Lane C items are sequential within the lane (PC1 unlocks PC2 etc); Lanes D, E, F can interleave.
- Reviewer trio (code/security/simplification) dispatched locally per commit; findings folded forward.
- Lighthouse gate must stay green on every merge; perf snapshot must stay green on every Lane D/E/F merge that touches scene/render or adds draw calls.
- Canonical screenshot byte-stability is the gate: refLevel(0) must NOT change because of any of these slices. Per-archetype canonical screenshots ARE allowed to change when their archetype's scenery (PE) or enemy mix (PF3) changes — that's the point of the slice — but every change requires an explicit screenshot refresh commit.
- Prune from this file in the commit that closes the item.

## Closeout note (2026-05-16)

PB1–PB5 + PA1–PA2 fully shipped via PRs #66, #67, #68, #70, #71, #72, #73 (directive bookkeeping). See `CHANGELOG.md` / `git log` for the audit trail.

ARCHETYPE INTERLEAVE drained — see commits `a4daceb` through
`be4e4af` and the per-archetype audit docs under `docs/audits/`.

MIGRATE lane (M4 + M5) cut as non-applicable — GitHub's
repo-rename redirect handles all the durable substitutes;
there is no separate OLD repo with a Pages deployment to
manage. PRD §MIGRATE updated with the empirical findings.
