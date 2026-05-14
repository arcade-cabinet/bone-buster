---
title: Roadmap
updated: 2026-05-14
status: current
domain: context
---

# OBJEXOOM — roadmap

Milestone-level human-friendly summary of where we are and what's
left. The full executable spec lives at [`PRD.md`](./PRD.md); the
machine-readable checklist is
[`.agent-state/directive.md`](../.agent-state/directive.md). When
those disagree, PRD wins.

## Current branch

`feat/objexoom-game-buildout` — long-running until the game is FULLY
done. See [`DECISIONS.md` D8](./DECISIONS.md#d8) for the rationale.

## Status banner

✅ **100% reference parity reached** (E12 adaptive resolution shipped
57dd8fa). All remaining work is **elevation** — features beyond what
the reference clone's 13 KB budget could touch.

## Shipped this branch

Selected highlights — full audit trail is in `git log` and
[`CHANGELOG.md`](../CHANGELOG.md).

**Standalone repo bring-up:**
- Canonical `polygonContains` fix
- OBJEXOOM design token system (`src/design-tokens/`) + CSS mirror
  + horror-tactical fonts (Black Ops One + Rajdhani)
- Dependabot grouped, release-please wired, CI green
- Asset reorg + BASE_URL helper + 5 canonical screenshots verified
- ObjexoomScene decomposition (1988 → 758 line root + 15 focused
  scene modules)
- Standalone browser smoke tests (real Chromium, no mocks)
- OBJEXOOM cut out of Objexiv (archive tag preserved)
- Standalone root docs: ROADMAP, DESIGN, ARCHITECTURE, DECISIONS,
  STANDARDS, TESTING, DEPLOYMENT, PARITY, ASSET_INVENTORY,
  ELEVATION, PRD
- Script aliases aligned with arcade-cabinet sister projects
- WASM sync infra (`scripts/prepare-web-wasm.mjs` postinstall +
  prebuild) + asset verification gate
  (`scripts/verify-runtime-assets.mjs`)

**Reference parity:**
- PARITY audit complete — every reference mechanic catalogued
- **PA16/E12** adaptive resolution closed the last critical gap

**Elevation Phase 1 (DONE):**
- **E12** Adaptive resolution via `gl.setPixelRatio` — 57dd8fa
- **E9** sql.js persistent run history — 5d74778

**Elevation Phase 2 progress:**
- **E1** BLADE melee weapon slot — 8d71475

## Remaining queue (next-up first)

Full per-item acceptance criteria + asset paths + dependencies live
in [`PRD.md`](./PRD.md).

### Standalone hardening (parallel)

- **B1.7** FBX→GLB regeneration verification
- **B2.1** Capacitor Android APK
- **B2.4** GitHub Pages CD on release tag
- **AO.4** Slasher weapon bundle reorg
- **AO.5/.6** PWA manifest + favicon set
- **INF2** Build-time copy-public-assets w/ budget enforcement
- **DS.7** Design tokens into scene materials

### Phase 2 — Mechanical elevation

- **E5** Destructible barrels with AoE damage
- **E6** Switches + secret walls + hidden rooms

### Phase 3 — Visual elevation

- **PA-MOD7** Wire `gltfjsx` for typed GLB components (E4 blocker)
- **E3** Decorative sector prop scatter
- **E4** Lit lamp props with real shadow projection
- **E2** Boss enemies (rigged horror tier)

### Phase 4 — Polish + variety

- **PA9b** Extend shell ejection to chaingun fires
- **E13** Procedural archetype deepening (5 archetypes)
- **E7** Animated water + sewer biome
- **E8** Flamethrower weapon
- **E11** Per-level ambient creature SFX
- **E10** 3D HUD elements (floating key mini-model, etc)

## Estimated work to "fully done"

~50-60 forward commits per PRD.md's commit-count estimates.

## Released

### 0.2.0 (2026-05-14)

Initial standalone repo extracted from `objexiv/objexiv`. PRs #1
(release-please) and #11 (lockfile + lint baseline) merged to `main`.

See [`CHANGELOG.md`](../CHANGELOG.md) for the full release notes.
