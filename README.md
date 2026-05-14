---
title: OBJEXOOM
updated: 2026-05-13
status: current
domain: onboarding
---

# OBJEXOOM

> Rip and tear — a polished DOOM-flavored arcade FPS built on Vite +
> react-three-fiber + Capacitor. Originally shipped as an easter egg
> inside [`objexiv/objexiv`](https://github.com/objexiv/objexiv);
> extracted to its own repo once it grew large enough to maintain on
> its own cadence.

## Quickstart

```bash
pnpm install
pnpm dev      # serves at http://localhost:5191
```

Add `?objexoomDebug` to the URL to expose `window.__objexoom` with
`start()`, `teleport(x, y, yaw?)`, `fire()`, `killAllEnemies()`,
`collectKey()`, `collectAllPickups()`, `triggerWin()`, `getState()`.
The e2e tests drive the game through this contract — pointer-lock +
canvas-keyed input is hostile to scripted automation.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server on 5191 |
| `pnpm build` | Production build to `dist/` |
| `pnpm build:pages` | Build with `/objexoom/` base path for GitHub Pages |
| `pnpm build:native` | Build + `cap sync` for Android/iOS |
| `pnpm check` | TypeScript no-emit |
| `pnpm lint` | Biome lint |
| `pnpm test` | Vitest unit suite (163 tests in 12 suites) |
| `pnpm test:browser` | Vitest browser suite (real Chromium via Playwright) |
| `pnpm test:e2e` | Full Playwright e2e suite |
| `pnpm test:e2e:screenshots` | Regenerate the canonical 5 screenshots under `test-results/objexoom-screenshots/` |
| `pnpm assets:fbx-to-glb` | Re-bake FBX sources from `references/` into `public/assets/models/` |

## Layout

```text
src/
├── design-tokens/           # color / type / spacing / motion tokens (single source of truth)
├── __tests__/
│   ├── unit/                # vitest unit suite — pure-TS simulation coverage
│   └── browser/             # vitest browser suite (real Chromium)
├── engine.ts                # pure-TS sim: maps, raycasts, collision, types
├── buildMap.ts              # procedural map generation from a seed
├── turtle.ts                # turtle-DSL used by buildMap
├── enemyAi.ts               # per-enemy FSM tick (patrol → approach → shoot)
├── yukaIntegration.ts       # yuka EntityManager bridge for steering
├── runStats.ts              # per-run kill/damage/time reducer
├── settings.ts              # difficulty + level enums, tuning tables
├── weapons.ts               # weapon registry
├── refLevel.ts              # reference-clone level imports
├── models.ts                # GLB registry + per-kind skin rosters + A() URL helper
├── ObjexoomShell.tsx        # app lifecycle, level transitions, debug hooks
├── ObjexoomScene.tsx        # r3f canvas root, scene composition
├── ObjexoomHUD.tsx          # corner HUD, weapon chips, overlays
├── ObjexoomLanding.tsx      # main menu, difficulty/level pickers, options
├── PlayerController.tsx     # camera + input (pointer-lock + touch sticks)
├── RefLevelMap.tsx          # reference-clone level renderer
├── sfx.ts                   # Tone.js procedural music + SFX bank
└── constants.ts             # tile / player / weapon constants (palette re-exports from design-tokens)

app/                         # Vite app entry (main.tsx mounts <ObjexoomShell />)
public/
├── README.md                # asset layout convention
└── assets/
    ├── fonts/               # Black Ops One + Rajdhani woff2 files
    └── models/              # GLBs — checked in, organized by category
        ├── enemies/         # + horror/ subroster
        ├── weapons/         # ranged + slasher melee
        └── props/           # doors, lamps

references/                  # FBX/zip source assets — gitignored, local-only
scripts/                     # FBX→GLB pipeline + screenshot publisher
tests/e2e/                   # Playwright e2e specs + canonical screenshot capture
docs/                        # design / architecture / decisions / roadmap / testing / deployment
.agent-state/                # cached digest + the canonical work directive
.github/                     # CI workflows, dependabot, release-please
```

## Authority

When docs disagree, the order is:

1. [`docs/DESIGN.md`](./docs/DESIGN.md) — product truth
2. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — system truth
3. [`docs/DECISIONS.md`](./docs/DECISIONS.md) — binding decisions
4. [`docs/ROADMAP.md`](./docs/ROADMAP.md) — current state + remaining work

[`docs/README.md`](./docs/README.md) is the map; it owns no truth.

## Reading order

1. This file (you're here).
2. [`AGENTS.md`](./AGENTS.md) — operating protocol for AI agents.
3. [`docs/DESIGN.md`](./docs/DESIGN.md) — what OBJEXOOM is.
4. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — how the system
   is shaped.
5. [`docs/ROADMAP.md`](./docs/ROADMAP.md) — what's shipped, what's
   active, what's queued.
6. [`docs/DECISIONS.md`](./docs/DECISIONS.md) when you wonder "why
   was X chosen?".

## Origin

OBJEXOOM started inside `objexiv/objexiv` on the
`feat/objexoom-easter-egg` branch as a `?objexoom` query-string
easter egg. As of repo extraction (2026-05-13) the easter-egg
wrappers (query-string forwarding, `LazyObjexoom`, integration tests)
were dropped — the standalone Vite app mounts `<ObjexoomShell />`
directly. The brand-lineage commitment to Objexiv survives in the
design-token system; see [`docs/DESIGN.md`](./docs/DESIGN.md) for the
details.
