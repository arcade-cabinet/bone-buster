---
title: Roadmap
updated: 2026-05-17
status: current
domain: context
---

# BONE BUSTER — roadmap

Milestone-level human-friendly summary of where we are and what's
left. The full executable spec lives at [`PRD.md`](./PRD.md); the
machine-readable checklist is
[`.agent-state/directive.md`](../.agent-state/directive.md). When
those disagree, PRD wins.

## Current branch

`feat/ght-emf-asset` (PR #75) holds the overhaul drain — 30
commits covering reference-asset drain (Lanes C/D/E/F) +
InstancedField perf migration + D19 dual-PRNG + R8 rebrand
follow-up. Awaiting review-merge.

## Status banner

✅ **Overhaul drained.** Reference parity (E12, 57dd8fa) plus
every elevation lane through D19/R8 has shipped. PR #75 carries
the final slice; once it merges the queue is empty pending a
new lane up-prioritization (see `docs/PRD.md` § Parked).

## Shipped this branch

Selected highlights — full audit trail is in `git log` and
[`CHANGELOG.md`](../CHANGELOG.md).

**Standalone repo bring-up:**
- Canonical `polygonContains` fix
- BONE BUSTER design token system (`app/styles/tokens/`) + CSS mirror
  + horror-tactical fonts (Black Ops One + Rajdhani)
- Dependabot grouped, release-please wired, CI green
- Asset reorg + BASE_URL helper + 5 canonical screenshots verified
- BoneBusterScene decomposition (1988 → 758 line root + 15 focused
  scene modules)
- Standalone browser smoke tests (real Chromium, no mocks)
- BONE BUSTER cut out of arcade-cabinet (archive tag preserved)
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

## Overhaul-branch shipped milestones (2026-05-15 → 2026-05-17)

**Foundations:** BUILD-CONFIG (BC1–BC7), RESTRUCTURE (RS1–RS6),
ITCH-FETCH (IF1–IF7).

**Surfaces:** REBRAND R1–R10 (Bungee/Inline/Shade typography,
Bone palette, Landing redesign, scuff shader, Radix card-menu,
Howler logo sting, HUD palette+type refresh, source-string
sweep, Capacitor namespace rename, release-please rename).

**Audio:** A11a–A11f (Tone.js → Howler, sprite registry,
per-archetype ambient, music graph, runtime verifier).

**Identity:** D1–D9 (locked-weapon HUD chip, weapon-ammo
pickups, weapon-acquired beat, enemy renames + 24-kind roster,
vulnerability tags, level-name generator, weapon variant
promotions).

**Archetype interleave:** D7-X + A1-X + A2-X across all five
archetypes (corridor → arena → courtyard → sewer → library),
plus the deferred InstancedField perf migration of TrapField,
NatureField, LampField, CrucifixField (PT1–PT6).

**Reference-asset drain:** Lanes C/D/E/F (PC1–PC4 ghost-hunting
tools; PD1–PD3 + PD3b weapon variants; PE1–PE3 + PE4a–c
per-archetype scenery; PF1–PF3 horror-fantasy enemies — see
`docs/audits/horror-fantasy-enemy-audit.md`).

**Architecture follow-ups:** D19 dual-PRNG (canonical
mulberry32 + cosmetic seedrandom alea); R8 event-prefix rename
(`objexoom:` → `bonebuster:`).

## Remaining queue

(empty — see `docs/PRD.md` § Parked for non-blocking ideas.)

## Released

### 0.2.0 (2026-05-14)

Initial standalone repo extracted from `arcade-cabinet/bone-buster`. PRs #1
(release-please) and #11 (lockfile + lint baseline) merged to `main`.

See [`CHANGELOG.md`](../CHANGELOG.md) for the full release notes.
