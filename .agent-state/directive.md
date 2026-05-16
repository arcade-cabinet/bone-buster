# Bone Buster — live work queue

**Status:** ACTIVE
**Branch:** `overhaul/bone-buster` — one long-running branch holds every commit until the queue drains.
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

## Lane ordering (corrected 2026-05-16)

Foundation → assets → surface. The original ITCH-FETCH-first / REBRAND-first ordering forced double-work because new components landed in the old `src/BoneBuster*.tsx` shape that RESTRUCTURE will move. Going forward:

1. **BUILD-CONFIG** — Vite/Vitest/Pages alignment. Get the deployed gh-pages target green.
2. **RESTRUCTURE** — adopt `app/` + `src/` layout; drop project-name prefix on filenames. Migrate every shipped component (`BoneBusterWordmark`, `ScuffShader`, `audio/logoSting.ts`, `OBJEXOOM*` → `Shell/Hud/Landing/Scene`) in one mechanical pass.
3. **AUDIO** — Howler.js swap + sample integration. Replaces all Tone.js procedural-synth surface. Depends on ITCH-FETCH (shipped) + RESTRUCTURE.
4. **REBRAND** (R6-R10) — remaining rebrand items. R6 logo sting becomes sampled OGG via Howler (re-scoped).
5. **IDENTITY** — depends on REBRAND palette + ITCH-FETCH extracts.
6. **ARCHETYPE INTERLEAVE** — per-archetype content + perf. Depends on everything above.
7. **MIGRATE** — old-repo Pages redirect + 30-day archive. Parallel residual.

## Queue

### BUILD-CONFIG — Vite + Vitest + Pages alignment

- [x] **BC1** — `vite.config.ts` overhaul matching voxel-realms pattern. PRD §BC1.
- [x] **BC2** — `vitest.config.ts` overhaul. PRD §BC2.
- [x] **BC3** — Pages base-path fix end-to-end (fixes the currently-broken deploy). PRD §BC3.
- [x] **BC4** — foldable viewport + safe-area CSS. PRD §BC4.
- [ ] **BC5** — touch joysticks on foldable. PRD §BC5.
- [ ] **BC6** — responsive HUD scaling. PRD §BC6.
- [ ] **BC7** — foldable smoke test. PRD §BC7.

### RESTRUCTURE — app/ + src/ layout per arcade-cabinet conventions

- [ ] **RS1** — migration plan `docs/RESTRUCTURE-PLAN.md`. PRD §RS1.
- [ ] **RS2** — resolver + tsconfig paths. PRD §RS2.
- [ ] **RS3** — bulk `git mv` (per-bucket commits). PRD §RS3.
- [ ] **RS4** — drop project-name prefix on filenames (incl. R1-R5 shipped components). PRD §RS4.
- [ ] **RS5** — test imports + verify gate. PRD §RS5.
- [ ] **RS6** — docs path references. PRD §RS6.

### AUDIO — Howler swap + itch.io sample integration

- [ ] **A11a** — `docs/AUDIO-INVENTORY.md`. PRD §A11a.
- [ ] **A11b** — `public/assets/audio/` layout + tracked files. PRD §A11b.
- [ ] **A11c** — Howler.js swap + sprite registry, remove Tone.js procedural surface. PRD §A11c.
- [ ] **A11d** — per-archetype ambient. PRD §A11d.
- [ ] **A11e** — music graph integration. PRD §A11e.
- [ ] **A11f** — `scripts/verify-runtime-audio.mjs`. PRD §A11f.

### REBRAND — remaining items

- [ ] **R6** — logo sting via Howler + OGG sample (re-scoped from Tone.js). PRD §R6.
- [ ] **R7** — HUD palette + type refresh. PRD §R7.
- [ ] **R8** — source-string `OBJEXOOM`→`BONE BUSTER` sweep. PRD §R8.
- [ ] **R9** — Capacitor + Android namespace rename. PRD §R9.
- [ ] **R10** — release-please `package-name` rename. PRD §R10.

### IDENTITY — gameplay-design depth

- [ ] **D1** — locked-weapon HUD as status indicator. PRD §D1.
- [ ] **D2** — weapon-ammo pickups in every procedural map. PRD §D2.
- [ ] **D3** — weapon-acquired HUD beat. PRD §D3.
- [ ] **D4** — enemy rename (skeleton→rattler, wraith→phaser, imp→bouncer). PRD §D4.
- [ ] **D5** — promote enemy variants + 12 new extracts → 24 first-class kinds. PRD §D5. (Depends IF5/IF6 — shipped.)
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

### MIGRATE — final residual

- [ ] **M4** — OLD repo Pages redirect to new home. PRD §M4.
- [ ] **M5** — 30-day archive grace + `gh repo archive`. PRD §M5.
