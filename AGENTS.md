---
title: Agents protocol
updated: 2026-05-14
status: current
domain: operating
---

# AGENTS.md

Operating protocol for any AI agent working in this repository.

## Before any action

1. Read [`CLAUDE.md`](./CLAUDE.md) — entry point with profile includes.
2. Read [`.agent-state/digest.md`](./.agent-state/digest.md) — cached
   short summary of where things stand.
3. Read the relevant section of
   [`.agent-state/directive.md`](./.agent-state/directive.md) only if
   you're about to mark something `[x]` or pick the next item.
4. `git status && git log --oneline -10`.
5. Skim [`docs/ROADMAP.md`](./docs/ROADMAP.md) for the human-readable
   view of what's in flight.

## Authority chain

When two docs disagree, use this order:

1. [`docs/DESIGN.md`](./docs/DESIGN.md) — product truth
2. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — system truth
3. [`docs/DECISIONS.md`](./docs/DECISIONS.md) — binding decisions
4. [`docs/PRD.md`](./docs/PRD.md) — remaining-work spec (acceptance criteria + DAG)
5. [`.agent-state/directive.md`](./.agent-state/directive.md) — executable checklist mirror of PRD
6. [`docs/ROADMAP.md`](./docs/ROADMAP.md) — milestone summary

## Stack rules

- **Vite-only.** No Next.js, no SSR, no `next/navigation`, no `"use client"` directives.
- **pnpm only.** No npm install, no yarn. The commit-gate enforces this.
- **Conventional Commits + squash-merge.** release-please drives
  versioning. See [`DECISIONS.md` D5](./docs/DECISIONS.md#d5).
- **Biome only.** No ESLint, no Prettier. See
  [`DECISIONS.md` D4](./docs/DECISIONS.md#d4).
- **Design tokens.** Use `ROLE.*` from
  [`app/styles/tokens/`](./app/styles/tokens/), NOT raw hex / rgba /
  scale steps. See [`DECISIONS.md` D7](./docs/DECISIONS.md#d7).

## Game architecture

Full diagram in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

- **`src/engine/*` + `src/world/buildMap.ts` + `src/ai/turtle.ts`** — pure-TS
  sim. Maps, raycasts, collision, spawning. No DOM, no three.js, no
  `Math.random()` in sim code (use seedable RNG). `src/engine/` is
  decomposed along type seams: `mapTypes` (types + guards), `gridGen`
  (`generateMap`), `gridCollision` + `sectors` (per-representation
  primitives), `collisionAny` (kind-agnostic dispatchers), `spawn`
  (entity spawning), `projectiles` (enemy-bullet sim).
- **`src/world/barrels.ts`** — pure-sim destructible barrel registry. Spawn,
  ray-test, AoE resolution. Mirrors the engine modules' shape: returns IDs +
  flags to the caller, no side effects. 14 unit tests in
  `src/__tests__/unit/bone-buster-barrels.test.ts`.
- **`src/ai/enemyAi.ts`** — FSM tick function with explicit states
  (0=patrol, 1=approach, 3=shoot). Tested via pure unit assertions in
  `src/__tests__/unit/bone-buster-enemyAi.test.ts`.
- **`src/store/runHistory.ts`** — sql.js persistence layer for per-run
  stats. Pure-async open/insert/list/best/count/clear API; serialized
  as base64 in localStorage. WASM via `prepare-web-wasm.mjs`. Browser
  smoke test in `src/__tests__/browser/runHistory.browser.test.ts`.
- **`src/ai/yukaIntegration.ts`** — yuka EntityManager bridge: mirror
  sim positions, run steering, write back. Stateful, isolated.
- **`app/views/Scene.tsx`** — r3f scene tree orchestrator. Drives
  mesh transforms from refs, NOT React state. Hosts the fire-path,
  the per-frame AI tick, the barrel explosion queue (`explodeBarrelRef`
  late-bind pattern). At 868 LOC as of PR #12; ARCH2 extracts
  `useFireResolution` + `useEnemyTickLoop` before E3. Renamed to
  `BoneBusterScene.tsx` by PRD §R8 source-string sweep.
- **`app/views/Shell.tsx`** — game lifecycle, level transitions,
  debug-hook attach, run-history recording on terminal status.
  Renamed to `BoneBusterShell.tsx` by PRD §R8 source-string sweep.
- **`src/assets/models.ts`** — pose + animation registry per
  enemy/weapon/prop. Per-kind skin roster, deterministic pick by id.
  URLs flow through `A()` (in `src/assets/assetUrl.ts`) so `import.meta.env.BASE_URL`
  is honored; see [`DECISIONS.md` D10](./docs/DECISIONS.md#d10).

## Design tokens

- `app/styles/tokens/colors.ts` — `LINEAGE`, `SCALE`, semantic `ROLE`
  layer, plus the new `BONE_PALETTE` (PRD §R2) and the
  current-name `OBJEXOOM_PALETTE` flat-key export (used by the
  3D scene materials surface; renamed to `BONE_BUSTER_PALETTE`
  by PRD §R8 source-string sweep, kept as back-compat alias
  after the sweep).
- `app/styles/tokens/typography.ts` — `FONT_FAMILY`, weights, spacing,
  sizes, line-heights.
- `app/tokens.css` — `--obx-*` CSS mirror.
- `app/fonts.css` — 12 `@font-face` declarations for Black Ops One +
  Rajdhani.

Component code uses `ROLE.actionFire` (not `SCALE.blood[500]`, not
`"#b91c1c"`). Specific scale steps need a `// scale-step: <reason>`
inline justification.

## Asset pipeline

- GLBs live under `public/assets/models/` and ARE tracked. Layout doc:
  [`public/README.md`](./public/README.md).
- Raw FBX/zip sources live under `references/` and are gitignored.
- `pnpm assets:fbx-to-glb` regenerates the curated GLBs. Edit
  `scripts/convert-fbx.mjs` to add new sources.
- After regenerating, run `pnpm test:e2e:screenshots` to refresh the
  canonical poses. They land under `test-results/objexoom-screenshots/`
  (path preserved post-rebrand — the canonical screenshot harness's
  output directory wasn't sweep-renamed to keep diff noise low and
  avoid invalidating the `tests/perf-baselines/` cross-reference;
  see R8b storage-key migration shim for the same pattern).

## Test discipline

Full doc: [`docs/TESTING.md`](./docs/TESTING.md).

- **Unit (`pnpm test`)** — 177 tests across 13 suites, pure-TS, no DOM, no canvas.
  Should run in under 2 seconds.
- **Browser (`pnpm test:browser`)** — Vitest in real Chromium. Empty
  for now; first standalone smoke tests queued.
- **E2E (`pnpm test:e2e`)** — Playwright driving the actual built
  game via `?bonebusterDebug` hooks. Includes the 5 canonical
  screenshot poses + 10 per-archetype poses.

## Ports

Vite dev pinned to **5191**, preview to **8191**, with
`strictPort: true`. Playwright config probes 5191. NOT Vite's default
5173 — see [`DECISIONS.md` D9](./docs/DECISIONS.md#d9).

## Debug-hook contract

When `?bonebusterDebug` is in the URL, `window.__bonebuster`
exposes the following surface (legacy `?objexoomDebug` /
`window.__objexoom` aliases also accepted via R8b shim):

```ts
type BoneBusterDebugHooks = {
  getState(): unknown;
  start(): void;
  teleport(x: number, y: number, yawRad?: number): void;
  fire(): void;
  killAllEnemies(): void;
  collectKey(): void;
  collectAllPickups(): void;
  triggerWin(): void;
};
```

Every e2e test relies on this contract. Extending is fine; breaking
requires updating every spec. The hook is gated by
`process.env.NODE_ENV !== "production"` AND the URL param — neither
alone enables it.

## Capacitor / mobile

- `pnpm cap:sync` after touching `capacitor.config.ts` or `android/`.
- `pnpm build:native` runs the full web build + cap sync.
- Mobile-first input: touch wins, pointer-lock fallback. No
  keyboard-only paths.

## Visual regression discipline

The 5 canonical poses are the visual contract. Any change to
rendering, UI, or asset GLBs must:

1. Re-run `pnpm test:e2e:screenshots`.
2. Read your own output (test-results PNGs) and judge against the
   spec.
3. Commit the changed screenshots alongside the change that produced
   them.

Visual blindness IS a bug. If you cannot capture the change, fix the
harness before the feature.

## Forbidden

- `console.log` in committed source (use a typed logger if added).
- `// TODO`, `// FIXME`, `// stub`, `placeholder` in committed source.
- `Math.random()` in `src/engine/*`, `enemyAi.ts`, `buildMap.ts`,
  `turtle.ts`, `runStats.ts` (deterministic RNG only).
- Pushing to `main` directly without a PR.
- `--no-verify` on commits or pushes.
- Editing decisions in [`docs/DECISIONS.md`](./docs/DECISIONS.md) — append
  a superseding decision instead.

## Long-running branch

One long-running branch per overhaul slice. The reviewer trio
(code-review + security + simplification) runs locally per
commit; findings fold forward into the next commit on the same
branch. Push + open one PR per coherent slice — not per commit.
See [`DECISIONS.md` §D12](./docs/DECISIONS.md#d12-per-item-feature-branches-off-latest-main-not-one-long-running-branch)
(supersedes D8). Hotfixes and unrelated work still get focused
PRs off latest `origin/main`.
