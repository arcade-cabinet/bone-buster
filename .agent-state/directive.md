# Bone Buster — live work queue

**Status:** ACTIVE
**Branch:** one long-running overhaul branch holds every commit until the queue drains.
**Authority chain:** DESIGN > ARCHITECTURE > DECISIONS > **PRD** > this file > ROADMAP.
**Spec:** [`docs/PRD.md`](../docs/PRD.md) carries the user stories, surfaces, and acceptance bars. Each item below points at its PRD section for the why and the verifiable acceptance.
**Standards:** [`STANDARDS.md`](../STANDARDS.md) carries doctrine (quality bar, slot architecture, no-end-of-turn, design tokens, etc).
**Decisions:** [`docs/DECISIONS.md`](../docs/DECISIONS.md) carries binding technical decisions.
**Audit trail:** shipped items live in `git log` + `.agent-state/decisions.ndjson` + `CHANGELOG.md`. They are not preserved in this file.

## Operating loop

1. Pick the topmost unchecked item.
2. Read its PRD section for the acceptance bar.
3. Implement, run `pnpm verify`, commit, dispatch reviewer trio locally.
4. Fold reviewer findings into the next forward commit.
5. Flip `[ ]` → `[x]` in the same commit; **delete the item from this file** in the next forward-going commit (per the prune-shipped-from-directive rule).
6. Push + open one PR per coherent slice (lane completion or larger), not per commit (per the no-pr-per-commit rule).

## Queue (topological order; lanes interleave per PRD sequencing rules)

### ITCH-FETCH — full library audit + extract

- [x] **IF1** — general-purpose itch.io fetcher. PRD §IF1.
- [x] **IF2** — owned-key metadata cache (316 packs). PRD §IF2.
- [x] **IF3** — `docs/ITCH-INVENTORY.md`. PRD §IF3.
- [x] **IF4** — `scripts/itch-allowlist.json`. PRD §IF4.
- [x] **IF5** — bulk download + extract. PRD §IF5.
- [x] **IF6** — FBX→GLB conversion pass. PRD §IF6.
- [x] **IF7** — `docs/ASSET-INVENTORY.md`. PRD §IF7.

### REBRAND — typography + palette + landing redesign

- [x] **R1** — self-hosted Bone Buster fonts via `@fontsource/*`. PRD §R1.
- [x] **R2** — Bone palette swap. PRD §R2.
- [x] **R3** — Landing redesign with SVG + framer-motion. PRD §R3.
- [ ] **R4** — animated scuff shader. PRD §R4.
- [ ] **R5** — Radix card-menu. PRD §R5.
- [ ] **R6** — audio logo sting. PRD §R6.
- [ ] **R7** — HUD palette + type refresh. PRD §R7.
- [ ] **R8** — source-string `OBJEXOOM`→`BONE BUSTER` sweep. PRD §R8.
- [ ] **R9** — Capacitor + Android namespace rename. PRD §R9.
- [ ] **R10** — release-please `package-name` rename. PRD §R10.

### IDENTITY — gameplay-design depth

- [ ] **D1** — locked-weapon HUD as status indicator. PRD §D1.
- [ ] **D2** — weapon-ammo pickups in every procedural map. PRD §D2.
- [ ] **D3** — weapon-acquired HUD beat. PRD §D3.
- [ ] **D4** — enemy rename (skeleton→rattler, wraith→phaser, imp→bouncer). PRD §D4.
- [ ] **D5** — promote enemy variants + 12 new extracts → 24 first-class kinds. PRD §D5. (Depends IF5/IF6.)
- [ ] **D6** — weapon vs enemy vulnerability tags. PRD §D6.
- [ ] **D8** — alliterative level-name generator. PRD §D8.
- [ ] **D9** — `references/` weapon promotions. PRD §D9.

### ARCHETYPE INTERLEAVE — per-archetype content + perf slice

Order: corridor → arena → courtyard → sewer → library. First slice generalizes the `InstancedField` + `EphemeralPool` factories; subsequent slices reuse.

- [ ] **CORRIDOR** — D7-corridor + A1-corridor + A2-corridor. PRD §ARCHETYPE INTERLEAVE.
- [ ] **ARENA** — D7-arena + A1-arena + A2-arena. PRD §ARCHETYPE INTERLEAVE.
- [ ] **COURTYARD** — D7-courtyard + A1-courtyard + A2-courtyard. PRD §ARCHETYPE INTERLEAVE.
- [ ] **SEWER** — D7-sewer + A1-sewer + A2-sewer. PRD §ARCHETYPE INTERLEAVE.
- [ ] **LIBRARY** — D7-library + A1-library + A2-library. PRD §ARCHETYPE INTERLEAVE.

### AUDIO — itch.io horror/ambient/SFX integration (depends on IF5)

- [ ] **A11a** — `docs/AUDIO-INVENTORY.md`. PRD §A11a.
- [ ] **A11b** — `public/assets/audio/` layout + tracked files. PRD §A11b.
- [ ] **A11c** — `src/sfx.ts` integration. PRD §A11c.
- [ ] **A11d** — per-archetype ambient. PRD §A11d.
- [ ] **A11e** — music graph integration. PRD §A11e.
- [ ] **A11f** — `scripts/verify-runtime-audio.mjs`. PRD §A11f.

### BUILD-CONFIG — Vite + Vitest + Pages alignment

- [ ] **BC1** — `vite.config.ts` overhaul matching voxel-realms pattern. PRD §BC1.
- [ ] **BC2** — `vitest.config.ts` overhaul. PRD §BC2.
- [ ] **BC3** — Pages base-path fix end-to-end (fixes the currently-broken deploy). PRD §BC3.
- [ ] **BC4** — foldable viewport + safe-area CSS. PRD §BC4.
- [ ] **BC5** — touch joysticks on foldable. PRD §BC5.
- [ ] **BC6** — responsive HUD scaling. PRD §BC6.
- [ ] **BC7** — foldable smoke test. PRD §BC7.

### RESTRUCTURE — app/ + src/ layout per arcade-cabinet conventions

- [ ] **RS1** — migration plan `docs/RESTRUCTURE-PLAN.md`. PRD §RS1.
- [ ] **RS2** — resolver + tsconfig paths. PRD §RS2.
- [ ] **RS3** — bulk `git mv` (per-bucket commits). PRD §RS3.
- [ ] **RS4** — drop project-name prefix on filenames. PRD §RS4.
- [ ] **RS5** — test imports + verify gate. PRD §RS5.
- [ ] **RS6** — docs path references. PRD §RS6.

### MIGRATE — final residual

- [ ] **M4** — OLD repo Pages redirect to new home. PRD §M4.
- [ ] **M5** — 30-day archive grace + `gh repo archive`. PRD §M5.
