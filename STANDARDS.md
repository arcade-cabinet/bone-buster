---
title: Standards
updated: 2026-05-14
status: current
domain: quality
---

# STANDARDS

Non-negotiable quality + brand rules. These survive across sessions
and contributors. When something here conflicts with a contributor's
preference, the standards win.

## Code

- **Strict TypeScript.** `strict: true`, no `any` without an inline
  `// type-safety: <reason>` justification.
- **Biome only.** No ESLint, no Prettier. `biome.json` is the single
  source. See [`DECISIONS.md` D4](./docs/DECISIONS.md#d4).
- **Tab indent**, double quotes, trailing commas everywhere,
  semicolons always (the biome defaults this repo's config sets).
- **Conventional Commits** — `feat:`, `fix:`, `chore:`, `docs:`,
  `refactor:`, `perf:`, `test:`, `ci:`, `build:`.
- **Squash-merge PRs.** No merge commits on `main`.
- **No `--no-verify`**, no `--admin` merges, no force-push to main.
- **Decompose by responsibility, not line count.** A 400-line config
  table is fine; a 250-line file owning three subsystems is not. The
  reader-can-hold-it-in-head test is the gate.

## Quality bar — modernized polished DOOM

Every shipped feature is benchmarked against "what does this
look, feel, sound like in DOOM 2016 / Eternal, modernized and
polished?" — never against "what's the minimum that satisfies
the directive line?" If the implementation reads as
student-grade compared to that bar, it's a bug to fold
forward, not a shipped item.

Concrete polish checklist applied to every visual/audio
feature:

- **Damage numbers:** punch-in scale (1.2→1.0 ease over 120ms),
  tiered color by magnitude, kill-confirm uses distinct
  glyph weight + brighter color + larger scale + slight
  upward velocity boost. Numbers track the enemy's head,
  not frozen world position. Outline + drop-shadow for
  legibility. Crit-stack on rapid same-target hits.
- **Hit feedback:** screen-shake magnitude scaled by damage
  taken; hitstop (1-2 frames) on enemy kills;
  chromatic-aberration pulse on player hits; muzzle-flash
  bloom scales with weapon damage tier.
- **Audio stings:** layered cues (sub-bass + tonal + ambient
  duck), never just isolated notes.
- **Materials:** procedural detail (tri-planar, normal maps,
  emissive variance) per archetype, not flat tinted color.
- **Particles:** layered systems (impact spark + smoke puff
  + ember trail), not single-color bursts.
- **Lighting:** dynamic per-shot point lights, gobo-like
  flicker on lamps, light-falloff curves matched per
  archetype palette.
- **UI animations:** spring-eased, never linear; entry/exit
  cards have stagger; numbers tick rather than snap.

Commit messages must cite which polish dimensions were
applied. If none apply, justify why in the commit body.
Background reviewers catch code smell; the agent's
foreground judgement catches polish-bar shortfall before
commit.

## Slot architecture pattern

Every new visual/audio feedback feature must answer:

1. Does it observe an existing entity/event/pose? → it's a
   slot. Mount as a sibling, listen, render, fade.
2. Does it change how the rendered thing is rendered? → it's
   part of the host component's render contract.
3. Does it fire audio? → it's a bus channel.

If none of the three answer cleanly, sit with the design
before writing code.

Full spec at [`docs/SLOT-ARCHITECTURE.md`](./docs/SLOT-ARCHITECTURE.md).
Reference shapes: `HitChromaticAberration`,
`SecretFoundFlash`, `EnemyHitFlash`, `WeaponSwapDip`.

## Continuous execution — no end-of-turn

The directive is a continuous queue, not a turn boundary.
Stopping at the end of a turn — even with a scheduled
wake-up — is a stop. After every shipped commit, pick the
next `[ ]` item and start it in the same turn.

End-of-turn summaries that say "next wake picks up X" are
stops in disguise. Only stop on:
- directive drained AND no forward-sweep work surfaces,
- test/CI failure needing user knowledge,
- destructive action needing per-op authorization,
- ambiguous design question that flips scope.

Context auto-compacts. Long turns are fine. See the
global CLAUDE.md "There is no such thing as a pause point"
section for the canonical list of banned phrases.

## Game design

- **Procedural geometry + curated assets** — the mix, not one or the
  other. Walls, sectors, lighting, particles come from code; enemies,
  weapons, props come from GLBs.
- **Determinism in the sim.** No `Math.random()`, no
  `performance.now()` in `engine.ts` / `enemyAi.ts` / `buildMap.ts` /
  `turtle.ts` / `runStats.ts`. Seedable RNG only. The commit-gate
  enforces this.
- **Reference parity.** BONE BUSTER is a port of the structure of
  `reference-codebases/js13k2019-yet-another-doom-clone` (gitignored;
  developer-local). Behavior gaps vs the reference are bugs, not
  features. **100% reference parity reached** as of E12 (57dd8fa).
  All forward work is **elevation** per [`docs/PRD.md`](./docs/PRD.md).
- **Visuals are first-class.** Every render/UI/asset change must
  re-shoot `pnpm test:e2e:screenshots` AND be visually inspected.
  Visual blindness is a process bug — fix the harness if you can't
  capture.

## Asset coverage maximization (user directive 2026-05-14)

> "I want as much possible value from ALL the PSX assets — anything
> that makes sense in a level."

The 3DPSX library is ~1,400+ GLBs across `PSX Mega Pack II v1.8`,
`Props/*`, `Fantasy/*`, `Vehicles/*`, `Environment/*`, and
`Characters/*`. The bar for wiring an asset is **"does it make sense
in a level?"**, not "is it cheap enough to fit a synthetic byte
budget."

- Every new mechanic (E5 barrels, E4 lamps, E2 bosses, E6 switches,
  E3 scatter) MUST exploit a variant pool of multiple PSX skins,
  seeded by id so the same instance always renders the same skin.
- Prefer the richer variant when it exists (e.g. metal_barrel_hr_*
  over the 6.8 KB Farm barrel). Asset weight is a per-asset tuning
  decision, NOT a CI gate.
- `scripts/verify-runtime-assets.mjs` reports per-category totals
  but does NOT enforce arbitrary budgets — those were removed in
  688104d after they cost quality on barrel.glb.
- New asset categories surface tasks: when a new pack is mounted
  (Vehicles, Light Sources, Traps, Debris), open a directive item
  for wiring at least one feature that uses them.

## Design tokens

- Component code references the semantic `ROLE.*` layer from
  [`app/styles/tokens/`](../app/styles/tokens/) — NOT raw hex, NOT
  rgba, NOT scale steps. See
  [`DECISIONS.md` D7](./docs/DECISIONS.md#d7).
- Typography uses `FONT_FAMILY.display` (Black Ops One) or
  `FONT_FAMILY.body` (Rajdhani). Never `"Inter"` / `"Poppins"` /
  `"Helvetica"` literals — those bypass the offline-safe fontset.
- The four `LINEAGE.*` anchors in
  [`app/styles/tokens/colors.ts`](../app/styles/tokens/colors.ts) are
  arcade-cabinet-brand load-bearing. Edits there require a brand decision,
  not a tweak.
- New visual axis? Add a scale + ROLE entry; don't reach for an
  off-palette literal. The CSS mirror in
  [`app/tokens.css`](./app/tokens.css) gets updated in the same commit.

## Audio

- Procedural via Tone.js — no audio files shipped.
- All SFX have a `panForPosition` variant so spatialization stays
  consistent across sectors.

## Testing

- **Unit (`pnpm test`)** runs in under 2 seconds total. Anything
  slower belongs in browser/e2e.
- **Browser tests** drive real Chromium via `@vitest/browser`.
- **E2E tests** drive the built game via Playwright on port 5191 with
  the `?bonebusterDebug` hook contract (R8b — legacy `?objexoomDebug`
  still accepted via the storage-key migration shim).
- **No test is "flaky" — it's broken.** Fix the race or replace the
  wait with a deterministic poll. Don't quarantine.
- See [`docs/TESTING.md`](./docs/TESTING.md) for the full strategy.

## Mobile

- Touch input is primary; pointer-lock + keyboard is the desktop
  add-on.
- Mid-tier device (Pixel 5a class) is the perf target — test there,
  not on flagship.
- Respect safe areas (`env(safe-area-inset-*)`).

## Documentation

- Every commit that changes behavior updates the relevant doc in the
  same commit. Stale docs are bugs.
- `CHANGELOG.md` is generated by release-please from Conventional
  Commit messages. Don't hand-edit it.
- Frontmatter (`title:`, `updated:`, `status:`, `domain:`) on all
  `.md` files in root and `docs/`.
- Decisions are append-only in
  [`docs/DECISIONS.md`](./docs/DECISIONS.md). Supersede; don't
  overwrite.

## Asset URLs

Every asset URL in `src/assets/models.ts` flows through `A()` so
`import.meta.env.BASE_URL` is honored. Raw `/assets/...` literals in
loader call sites are bugs (will 404 in gh-pages). See
[`DECISIONS.md` D10](./docs/DECISIONS.md#d10).

## Git hygiene

- One commit per logical change.
- Never amend a pushed commit.
- One long-running branch per overhaul slice (current:
  `feat/ght-emf-asset`); reviewer trio runs locally per commit,
  findings fold forward, push + open PR only when the slice is
  fully done. See `docs/DECISIONS.md` §D12 (supersedes D8).
- Tag releases via release-please, not by hand.
