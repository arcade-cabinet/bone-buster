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

## In flight

- ObjexoomScene.tsx decomposition (~1900 lines → focused modules)
- Standalone browser smoke tests against ObjexoomShell
- Objexiv-side cutover (delete easter-egg dir, prune deps, open PR)

## Remaining queue

### DS — design system rollout

- DS.7: tokens into scene materials (lava, key glow, fire muzzle,
  pickup tint)

### AO — asset organization

- AO.4: slasher (melee) weapon GLBs into a `slasher/` subdir once the
  melee slot wires up
- AO.5: PWA manifest + favicon set (apple-touch-icon, 192/512
  maskable, theme-color from `--obx-bg-void`)
- AO.6: `index.html` head wires manifest + favicons

### B2 — mobile + CI

- B2.1: `cap add android` and verify `pnpm build:native` produces an
  APK
- B2.4: `.github/workflows/cd.yml` deploys `pnpm build:pages` to
  GitHub Pages on release tag

### PARITY — reference-clone parity

(Closes once each item ships + is verified visually against
`reference-codebases/js13k2019-yet-another-doom-clone/`.)

- PA1: ManyEnemies spawner — verify the existing `src/refLevel.ts`
  hook still drives correctly post-extraction
- PA9: Shell ejection on shotgun fire
- PA10: Weapon recoil offset on viewmodel
- PA-MOD7: Wire `gltfjsx` to auto-generate typed React components per
  GLB (so muzzle bones become addressable)
- PA11: Body-part physics — gravity arc + spin on death
- PA16: Adaptive resolution via `gl.setPixelRatio` on low FPS
- PA-FULL: End-to-end deep dive against the reference clone — log
  every mechanic the reference has and OBJEXOOM doesn't, then close
  the gap one commit at a time

## Released

### 0.2.0 (2026-05-13)

Initial standalone repo extracted from `objexiv/objexiv`. PRs #1
(release-please) and #11 (lockfile + lint baseline) merged to `main`.

See [`CHANGELOG.md`](../CHANGELOG.md) for the full release notes.
