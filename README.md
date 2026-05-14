# OBJEXOOM

> Rip and tear — a polished DOOM-flavored arcade FPS built on Vite + react-three-fiber + Capacitor. Originally shipped as an easter egg inside [`objexiv/objexiv`](https://github.com/objexiv/objexiv); extracted to its own repo once it grew large enough to maintain on its own cadence.

## Quickstart

```bash
pnpm install
pnpm dev      # serves at http://localhost:5173
```

Add `?objexoomDebug` to the URL to expose `window.__objexoom` with `start()`, `teleport(x, y, yaw?)`, `fire()`, `killAllEnemies()`, `collectKey()`, `collectAllPickups()`, `triggerWin()`, `getState()`. The e2e tests drive the game through this contract — pointer-lock + canvas input is hostile to scripted automation.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server on 5173 |
| `pnpm build` | Production build to `dist/` |
| `pnpm build:pages` | Build with `/objexoom/` base path for GitHub Pages |
| `pnpm build:native` | Build + `cap sync` for Android/iOS |
| `pnpm check` | TypeScript no-emit |
| `pnpm lint` | Biome lint |
| `pnpm test` | Vitest unit suite |
| `pnpm test:browser` | Vitest browser suite (real Chromium via Playwright) |
| `pnpm test:e2e` | Full Playwright e2e suite |
| `pnpm test:e2e:screenshots` | Regenerate the canonical 5 screenshots under `test-results/objexoom-screenshots/` |
| `pnpm assets:fbx-to-glb` | Re-bake FBX sources from `references/` into `public/models/` |
| `pnpm assets:publish-screenshots` | Copy regenerated screenshots into `docs/assets/screenshots/` |

## Layout

```
src/                    # Game code (engine, scene, shell, HUD, AI, audio, models)
src/__tests__/unit/     # Vitest unit suite (engine / FSM / map decoder / etc.)
src/__tests__/browser/  # Vitest browser suite
app/                    # Vite app entry (main.tsx mounts <ObjexoomShell />)
public/models/          # GLB assets — checked in
references/             # FBX/zip source assets — gitignored, local-only
scripts/                # FBX→GLB pipeline + screenshot publisher
tests/e2e/              # Playwright e2e + canonical screenshots
docs/                   # Spec, design notes, baseline screenshots
```

## Assets

The `public/models/` directory ships the runtime GLBs (weapons, enemies, props). The `references/` directory holds the FBX/zip source pack and stays gitignored — large, license-restricted, and the `scripts/convert-fbx.mjs` script re-derives the GLBs on demand. See `scripts/convert-fbx.mjs` for the curated source-to-glb mapping.

## Origin

OBJEXOOM started inside `objexiv/objexiv` on the `feat/objexoom-easter-egg` branch as a `?objexoom` query-string easter egg. As of repo extraction (2026-05-13) the easter-egg wrappers (query-string forwarding, `LazyObjexoom`, integration tests) were dropped — the standalone Vite app mounts `<ObjexoomShell />` directly.
