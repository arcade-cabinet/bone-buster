---
title: Testing
updated: 2026-05-13
status: current
domain: quality
---

# OBJEXOOM — testing strategy

Three suites, three purposes. All run from the repo root with `pnpm`.

## Unit — `pnpm test`

12 suites, 163 tests, vitest in jsdom. Lives at
[`src/__tests__/unit/`](../src/__tests__/unit/).

Covers the pure-TS simulation: engine math, build-map output,
bullets, pickups, enemy FSM, run-stats reducer, settings tuning,
yuka steering, turtle DSL, sfx tone gating, fade controller.

**Discipline:** every export from `engine.ts` / `buildMap.ts` /
`enemyAi.ts` / `turtle.ts` / `runStats.ts` has at least one test.
Every conditional branch is exercised. Error paths are tested.

Run a single suite:

```bash
pnpm test -- engine
```

## Browser — `pnpm test:browser`

vitest browser project (real Chromium via `@vitest/browser-playwright`).
Currently empty — first standalone smoke tests are queued
([ROADMAP](./ROADMAP.md) → standalone browser smoke).

Lives at `src/__tests__/browser/`. Covers anything that needs a real
DOM + real fonts + real WebGL: HUD render snapshots, Shell lifecycle
transitions, pointer-lock fallback paths, font-loaded layout shifts.

## End-to-end — `pnpm test:e2e`

Playwright, lives at [`tests/e2e/`](../tests/e2e/). Two specs:

- `screenshots.spec.ts` — captures the 5 canonical poses (landing,
  flashlight-on, flashlight-off, going-back-strobe, mission-complete)
  to `test-results/objexoom-screenshots/`. Each pose drives the game
  through the `window.__objexoom` debug hooks.
- `objexoom.spec.ts` — gameplay smoke: NEW GAME → difficulty → level
  → game starts, kill counter saturates, etc.

Run only the screenshot pass:

```bash
pnpm test:e2e:screenshots
```

### Important: Chromium backend

Headless SwiftShader (the default Playwright backend) **deadlocks** on
the shadow-map composite during `page.screenshot`. The screenshot
spec launches its own Chromium with `--use-angle=gl --enable-webgl
--ignore-gpu-blocklist --window-position=9999,9999` and captures via
CDP `Page.captureScreenshot` (which bypasses Playwright's stability
gate). Don't switch back to default-args + `page.screenshot`.

### Port discipline

Vite dev pinned to **5191** (not 5173). Playwright config probes
that URL. See [DECISIONS D9](./DECISIONS.md#d9).

## What we don't run yet

- **Coverage gates** — vitest can emit coverage reports
  (`pnpm test -- --coverage`); no CI gate enforces a floor yet.
- **Visual regression** — screenshots are captured but not diffed
  against a baseline. Manual visual review is the gate (see
  [STANDARDS](../STANDARDS.md#visuals-are-first-class)).
- **Performance regression** — no Lighthouse / Core Web Vitals gate.
  Mobile + low-end perf will get an FPS budget once PA16 lands.

## Adding a test

1. Identify the layer (unit / browser / e2e). If it touches three.js
   or the DOM, it's browser or e2e, not unit.
2. Drop the file in the matching `__tests__` subdir using the existing
   naming convention (`objexoom-<module>.test.ts`).
3. Run `pnpm test` (or `:browser` / `:e2e`) and confirm it passes.
4. If it's a regression test for a bug fix, name the bug in the test
   description: `it("polygonContains handles horizontal edges (regression: lava floor false-negatives)", ...)`.
