# AGENTS.md

Operating protocol for any AI agent working in this repository.

## Before any action

1. Read `CLAUDE.md` (entry point with profile includes).
2. Read `.agent-state/digest.md` (cached short summary of where things stand).
3. Read the relevant section of `.agent-state/directive.md` only if you're about to mark something `[x]` or pick the next item.
4. `git status && git log --oneline -10`.

## Stack rules

- **Vite-only.** No Next.js, no SSR, no `next/navigation`, no `"use client"` directives outside their original purpose (they're harmless in Vite but a flag that code came from Objexiv without cleanup).
- **No Objexiv imports.** This is a standalone game. The commit-gate enforces this.
- **pnpm only.** No npm install, no yarn. The commit-gate enforces this too.
- **Conventional Commits + squash-merge.** release-please drives versioning.

## Game architecture

- **`src/engine.ts` + `src/buildMap.ts` + `src/turtle.ts`** — pure-TS sim. Maps, raycasts, collision, spawning. No DOM, no three.js, no Math.random in sim code (use seedable RNG).
- **`src/enemyAi.ts`** — FSM tick function with explicit states (0=patrol, 1=approach, 3=shoot). Tested via pure unit assertions in `src/__tests__/unit/objexoom-enemyAi.test.ts`.
- **`src/yukaIntegration.ts`** — yuka EntityManager bridge: mirror sim positions, run steering, write back. Stateful, isolated.
- **`src/ObjexoomScene.tsx`** — r3f scene tree. Drives mesh transforms from refs, NOT React state.
- **`src/ObjexoomShell.tsx`** — game lifecycle, level transitions, debug hook attach.
- **`src/models.ts`** — pose + animation registry per enemy/weapon/prop. Per-kind skin roster, deterministic pick by id.

## Asset pipeline

- GLBs live under `public/models/` and ARE tracked.
- Raw FBX/zip sources live under `references/` and are gitignored.
- `pnpm assets:fbx-to-glb` regenerates the curated GLBs. Edit `scripts/convert-fbx.mjs` to add new sources.
- After regenerating, run `pnpm test:e2e:screenshots && pnpm assets:publish-screenshots` so the canonical screenshots reflect the new assets.

## Test discipline

- **Unit (`pnpm test`)**: pure-TS, no DOM, no canvas. Engine, FSM, decoder, RNG, run-stats. Should run in under 3 seconds.
- **Browser (`pnpm test:browser`)**: Vitest in real Chromium. UI components, HUD, audio nodes.
- **E2E (`pnpm test:e2e`)**: Playwright driving the actual built game via `?objexoomDebug` hooks. Includes the 5 canonical screenshot poses.

## Debug-hook contract

When `?objexoomDebug` is in the URL, `window.__objexoom` exposes:

```ts
type ObjexoomDebugHooks = {
  getState: () => unknown;
  start: () => void;
  teleport: (x: number, y: number, yawRad?: number) => void;
  fire: () => void;
  killAllEnemies: () => void;
  collectKey: () => void;
  collectAllPickups: () => void;
  triggerWin: () => void;
};
```

Every e2e test relies on this contract. Extending it is fine — breaking it requires updating every spec.

## Capacitor / mobile

- `pnpm cap:sync` after touching `capacitor.config.ts` or `android/` (commit-gate enforces).
- `pnpm build:native` for full web build + cap sync.
- Mobile-first input: touch wins, pointer-lock fallback. No keyboard-only paths.

## Visual regression discipline

The 5 canonical screenshots under `docs/assets/screenshots/` are the visual contract. Any change to rendering, UI, or asset GLBs must:

1. Re-run `pnpm test:e2e:screenshots`.
2. Publish via `pnpm assets:publish-screenshots`.
3. Visually inspect the diff — agent's responsibility, not the user's.

## Forbidden

- `console.log` in committed source (use a typed logger if one is added).
- `// TODO`, `// FIXME`, `// stub`, `placeholder` in committed source.
- `Math.random()` in `engine.ts`, `enemyAi.ts`, `buildMap.ts`, `turtle.ts`, `runStats.ts` (deterministic RNG only).
- Pushing to `main` directly without a PR.
- `--no-verify` on commits or pushes.
