---
title: Bone Buster
updated: 2026-05-15
status: current
domain: onboarding
---

# Bone Buster

> **They had it coming.** A procedural arcade FPS in the PSX-jank
> tradition. Pistol-and-pumper combat against rattling skeletons,
> phasing wraiths, and a roster of 24 distinct enemy kinds across
> 5 procedurally-mixed archetypes (corridor / arena / courtyard /
> sewer / library). Built on Vite + react-three-fiber +
> Capacitor; ships to web, Android, and iOS from one codebase.

Lives at [`arcade-cabinet/bone-buster`](https://github.com/arcade-cabinet/bone-buster)
as part of the arcade-cabinet org family.

## Quickstart

```bash
pnpm install
pnpm dev      # serves at http://localhost:5191
```

Add `?debug` to the URL to expose `window.__bonebuster` with
`start()`, `teleport(x, y, yaw?)`, `fire()`, `killAllEnemies()`,
`collectKey()`, `collectAllPickups()`, `triggerWin()`,
`getState()`. The e2e tests drive the game through this
contract — pointer-lock + canvas-keyed input is hostile to
scripted automation otherwise.

Other URL flags: `?seed=N` pins the run seed for deterministic
dev/repro sessions; `?archetype=<name>` forces the seed to
land on a chosen archetype (`corridor` / `arena` / `courtyard`
/ `sewer` / `library`).

> Note: the URL-flag names above (`?bonebusterDebug`,
> `?bonebusterSeed`, `?bonebusterArchetype`, `window.__bonebuster`)
> are the post-rebrand contract. The R8 source sweep flipped the
> underlying implementation to match; legacy `?objexoom*` aliases are
> retained as an R8b compatibility shim.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server on 5191 |
| `pnpm build` | Production build to `dist/` |
| `pnpm build:pages` | Build with the `/bone-buster/` base path for GitHub Pages |
| `pnpm build:native` | Build + `cap sync` for Android/iOS |
| `pnpm check` | TypeScript no-emit |
| `pnpm lint` | Biome lint |
| `pnpm test` | Vitest unit suite (~840 tests) |
| `pnpm test:browser` | Vitest browser suite (real Chromium via Playwright, 6 tests) |
| `pnpm test:e2e` | Full Playwright e2e suite |
| `pnpm test:e2e:screenshots` | Regenerate the canonical 5 screenshots |
| `pnpm test:perf` | OBS3 desktop perf snapshot (per-archetype draw-call + fps baseline) |
| `pnpm test:perf:mobile` | OBS3 mobile perf probe (CDP-driven against a Pixel 5a-class emulator; CI-gated behind the `mobile-perf` label) |
| `pnpm verify` | The merge gate: lint + check + test + test:browser + assets:verify-runtime |
| `pnpm assets:fbx-to-glb` | Re-bake FBX sources from `references/` into `public/assets/models/` |
| `pnpm assets:verify-runtime` | Audit every GLB referenced by `models.ts` exists at the resolved path |

## Layout

```text
src/
├── design-tokens/           # color / type / spacing / motion tokens
├── __tests__/
│   ├── unit/                # vitest unit suite
│   └── browser/             # vitest browser suite (real Chromium)
├── engine.ts                # pure-TS sim: maps, raycasts, collision, types
├── buildMap.ts              # procedural map generation from a seed
├── prng.ts                  # canonical mulberry32 + per-system RNG tags
├── enemyAi.ts               # per-enemy FSM tick
├── runStats.ts              # per-run kill/damage/time reducer
├── settings.ts              # difficulty + level enums, tuning tables
├── weapons.ts               # weapon registry
├── refLevel.ts              # hand-authored E1M1 reference map
├── models.ts                # GLB registry + per-kind skin rosters + A() URL helper
├── preload.ts               # tier-1/2/3 asset preload orchestrator
├── BoneBusterShell.tsx      # app lifecycle, level transitions, debug hooks
├── BoneBusterScene.tsx      # r3f canvas root, scene composition
├── BoneBusterHUD.tsx        # corner HUD, weapon chips, overlays
├── BoneBusterLanding.tsx    # landing screen
├── PlayerController.tsx     # camera + input (pointer-lock + touch sticks)
├── sfx.ts                   # Howler-based audio facade (A11c — replaced Tone.js)
├── howlerBus.ts             # variant-aware loop pool + crossfade primitives
├── musicGraph.ts            # mood → music-bed routing
└── ambientGraph.ts          # archetype → ambient-bed routing

public/
├── README.md                # asset layout convention
└── assets/
    ├── fonts/               # Bone Buster typography (Bungee, Space Grotesk, JetBrains Mono, Tilt Prism) self-hosted via @fontsource/*
    ├── audio/               # itch.io horror SFX + ambient music (in-flight via the AUDIO lane)
    └── models/              # GLBs — checked in, organized by category
        ├── enemies/         # + horror/ subroster (24 kinds in-flight)
        ├── weapons/         # ranged + slasher melee
        └── props/           # doors, lamps, decals, debris, kitchen, nature, etc

references/                  # FBX/zip source assets — gitignored, local-only
raw-assets/                  # itch.io fetched archives + extracted GLBs — gitignored
scripts/                     # FBX→GLB pipeline + itch fetcher + screenshot publisher
tests/e2e/                   # Playwright e2e specs + canonical screenshot capture
docs/                        # design / architecture / decisions / rebrand / etc
.agent-state/                # canonical work directive + decisions ledger
.github/                     # CI workflows, dependabot, release-please
```

## Authority

When docs disagree, the order is:

1. [`docs/DESIGN.md`](./docs/DESIGN.md) — product truth (visual + audio identity)
2. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — system truth
3. [`docs/DECISIONS.md`](./docs/DECISIONS.md) — binding decisions
4. [`docs/REBRAND.md`](./docs/REBRAND.md) — locked Bone Buster identity spec (palette, typography, enemy roster)
5. [`.agent-state/directive.md`](./.agent-state/directive.md) — current work backlog

## Reading order

1. This file (you're here).
2. [`AGENTS.md`](./AGENTS.md) — operating protocol for AI agents.
3. [`docs/DESIGN.md`](./docs/DESIGN.md) — what Bone Buster is.
4. [`docs/REBRAND.md`](./docs/REBRAND.md) — the locked identity spec.
5. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — how the system is shaped.
6. [`docs/DECISIONS.md`](./docs/DECISIONS.md) — "why was X chosen?".

## Identity

| Field | Value |
| --- | --- |
| Name | Bone Buster |
| Tagline | They had it coming. |
| Display font | Bungee (with Bungee Inline + Bungee Shade layered for letterpress depth) |
| Body font | Space Grotesk |
| Mono font | JetBrains Mono |
| Flair font | Tilt Prism (animated phase transitions only) |
| Palette | Bone (warm-cream bone tones + buster-orange action + dried-blood accent on charcoal-violet) |
| Enemies | 24 first-class kinds (rattler, phaser, bouncer, plaguebeak, jester, reverend, stagged, grub, signal, heap, heap2, gorehead, bighoss, stomper, butcher, bloodphaser, devil, dolly, gawker, oneye, goliath, swiney, mrZ, lupin) |
| Archetypes | corridor, arena, courtyard, sewer, library |
| Asset pipeline | references/ (local FBX/zip source) → references/_extracted/ (converted GLBs) → public/assets/models/ (shipped) |

## License + credits

Code: see `LICENSE`. Sample art + audio under their respective
itch.io / pack-creator licenses — `docs/CREDITS.md` enumerates
the upstream packs. Built with React, Three.js, drei,
react-three/postprocessing, Howler.js, Vite, Capacitor, Biome,
Vitest, Playwright.
