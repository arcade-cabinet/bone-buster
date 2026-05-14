---
title: Roadmap
updated: 2026-05-13
status: current
domain: context
---

# OBJEXOOM — roadmap

This is the operating queue. The canonical machine-readable copy lives
at [`.agent-state/directive.md`](../.agent-state/directive.md); this
file is the human-friendly summary.

## Current branch

`feat/objexoom-game-buildout` — long-running until the game is FULLY
done. See [`DECISIONS.md` D8](./DECISIONS.md#d8) for the rationale.

## Shipped this branch

- Canonical `polygonContains` fix (lava-floor false-negatives on
  horizontal edges)
- OBJEXOOM design token system (src/design-tokens/) with semantic
  ROLE layer and Objexiv lineage anchors
- CSS mirror via `app/tokens.css` with `--obx-*` custom properties
- Self-hosted horror-tactical fonts: Black Ops One + Rajdhani
  (12 woff2 files, ~120 KB)
- Dependabot grouped non-major + major per ecosystem
- HUD adopted full token stack (semantic colors + Black Ops One
  display + Rajdhani body)
- Landing + Shell adopted tokens (wordmark uses the warmer gradient,
  key flash recolored to amber)
- Asset reorg: 27 GLBs moved to `public/assets/models/`
- BASE_URL helper `A()` in `models.ts` (fixes asset 404s in dev AND
  gh-pages)
- e2e screenshot suite green at the new pinned port (5191)
- Visual verification of all 5 canonical poses
- Standalone root docs: this ROADMAP plus DESIGN, ARCHITECTURE,
  DECISIONS, TESTING, DEPLOYMENT

- ObjexoomScene.tsx decomposition (1988 → 758 line root + 15 focused
  modules under `src/scene/`)
- Standalone browser smoke tests (real Chromium, no mocks)
- OBJEXOOM cut out of Objexiv via archive tag
- DOOM reference parity audit complete — [`PARITY.md`](./PARITY.md)
- 3DPSX asset inventory complete — [`ASSET_INVENTORY.md`](./ASSET_INVENTORY.md)
- Elevation roadmap drafted — [`ELEVATION.md`](./ELEVATION.md)
- All script aliases aligned with arcade-cabinet sister projects

## In flight

- WASM/asset sync infrastructure (postinstall + prebuild hook,
  copy-public-assets, verify-runtime-assets CI gate)

## Remaining queue

### PARITY — true gaps vs reference (2 items)

Only items left are real ❌/⚠️ from the audit. See
[`PARITY.md`](./PARITY.md) for the full table.

- PA16 / E12: Adaptive resolution via `gl.setPixelRatio` on low FPS —
  **only critical-tier parity gap left**, blocks mobile perf
- PA9b: Extend shell ejection to chaingun fires (reference ejects on
  every chaingun shot; we currently only fire on shotgun)
- PA-MOD7: Wire `gltfjsx` to auto-generate typed React components per
  GLB (so muzzle bones become addressable)

### ELEVATION — beyond reference (E1-E13)

Full doc: [`ELEVATION.md`](./ELEVATION.md). Sequencing:

**Phase 1 — critical infra:**

- E12: Adaptive resolution (also PA16)
- E9: sql.js persistent run history

**Phase 2 — mechanical elevation:**

- E1: Full melee weapon slot (5 GLBs already shipped)
- E5: Destructible barrels with AoE damage
- E6: Switches + secret walls + hidden rooms

**Phase 3 — visual elevation:**

- E3: Decorative sector prop scatter (3DPSX Mega Pack has 200+)
- E4: Lit lamp props with shadow projection
- E2: Boss enemies (rigged horror final_rigged.fbx tier)

**Phase 4 — polish + variety:**

- E13: Level archetype deepening
- E7: Animated water + sewer biome
- E8: Flamethrower weapon
- E11: Per-level ambient creature SFX
- E10: 3D HUD elements

### Outstanding minor work

- DS.7: tokens into scene materials (lava, key glow, fire muzzle,
  pickup tint)
- AO.5/AO.6: PWA manifest + favicon set + head wiring
- B2.1: `cap add android` and verify APK build
- B2.4: `cd.yml` deploys `pnpm build:pages` to GitHub Pages on release

## Released

### 0.2.0 (2026-05-13)

Initial standalone repo extracted from `objexiv/objexiv`. PRs #1
(release-please) and #11 (lockfile + lint baseline) merged to `main`.

See [`CHANGELOG.md`](../CHANGELOG.md) for the full release notes.
