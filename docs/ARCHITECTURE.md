---
title: Architecture
updated: 2026-05-13
status: current
domain: technical
---

# OBJEXOOM — system architecture

## Top-down

```
┌───────────────────────────────────────────────────────────┐
│  Capacitor shell (Android / iOS) — wraps the web bundle   │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Vite + React 19  (app/)                            │  │
│  │  ┌────────────────────┐  ┌───────────────────────┐  │  │
│  │  │  ObjexoomShell     │  │  design-tokens        │  │  │
│  │  │  (lifecycle,       │  │  (colors, type,       │  │  │
│  │  │   debug hooks,     │  │   spacing, motion)    │  │  │
│  │  │   level transit.)  │  └───────────────────────┘  │  │
│  │  └─────┬──────────────┘                             │  │
│  │        │                                            │  │
│  │  ┌─────▼──────────┐    ┌────────────────────────┐   │  │
│  │  │ ObjexoomScene  │    │  ObjexoomHUD           │   │  │
│  │  │ (r3f canvas,   │    │  (corner readouts,     │   │  │
│  │  │  3D world)     │    │   weapon chips, ammo,  │   │  │
│  │  │                │    │   overlays)            │   │  │
│  │  └─────┬──────────┘    └────────────────────────┘   │  │
│  │        │                                            │  │
│  │  ┌─────▼─────────────────────────────────────────┐  │  │
│  │  │  Pure-TS simulation                           │  │  │
│  │  │  engine.ts | buildMap.ts | turtle.ts |        │  │  │
│  │  │  enemyAi.ts | yukaIntegration.ts | runStats   │  │  │
│  │  └───────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │  Static assets   │
                  │  public/assets/  │
                  │  ├── fonts/      │
                  │  └── models/     │
                  └──────────────────┘
```

## Layer responsibilities

### Pure-TS simulation (no DOM, no three, no React)

The sim is deterministic, side-effect-free, and 100% covered by unit
tests. No `Math.random()`, no `performance.now()` — everything seeded.

| Module | Owns |
| --- | --- |
| `src/engine.ts` | Map types (`ObjexoomGridMap`, `ObjexoomSectorMap`), raycasts, collision, enemy/bullet/pickup types, sector portal computation, `polygonContains` |
| `src/buildMap.ts` | Procedural map generation (grid + sector variants) from a seed |
| `src/turtle.ts` | Logo-style turtle DSL used by `buildMap` for shape generation |
| `src/enemyAi.ts` | Per-enemy FSM tick (patrol → approach → shoot). Pure function `tickEnemyFsm(enemy, ctx) → next` |
| `src/yukaIntegration.ts` | Stateful yuka EntityManager bridge — mirror sim positions in, run steering, write target velocity back |
| `src/runStats.ts` | Per-run kill/damage/time accounting, reducer-shaped |
| `src/settings.ts` | Difficulty + level enums, tuning tables (`DIFFICULTY_TUNING`) |
| `src/weapons.ts` | Weapon registry (id → spec) |
| `src/refLevel.ts` | Reference-clone level imports, ManyEnemies spawner |

### Rendering layer (r3f + three)

| Module | Owns |
| --- | --- |
| `src/ObjexoomScene.tsx` | r3f Canvas root, scene composition, MapGeometry, SectorMapGeometry, EnemyMesh, WeaponViewmodel, KeyMarker, ExitPortal, RealDoor, TreasureChest — **flagged for decomposition; see DECISIONS** |
| `src/PlayerController.tsx` | Camera + movement input (pointer-lock + touch sticks), pointer-lock state |
| `src/models.ts` | Enemy + weapon + prop GLB registry + per-kind skin rosters, BASE_URL-aware URL helper `A()` |
| `src/RefLevelMap.tsx` | Renderer for reference-clone level layouts |

### UI layer

| Module | Owns |
| --- | --- |
| `src/ObjexoomShell.tsx` | App lifecycle (landing ↔ in-game ↔ overlay), level transitions, debug hook attachment, fade trigger |
| `src/ObjexoomHUD.tsx` | Corner HUD blocks (HP, KILLS, KEY), weapon chips, ammo readout, crosshair, overlay cards (PAUSED, YOU DIED, MISSION COMPLETE), touch sticks + FIRE button, CLICK TO ENGAGE |
| `src/ObjexoomLanding.tsx` | Main menu (NEW GAME, OPTIONS, HOW TO PLAY), difficulty + level pickers, options pane, music loading indicator |

### Audio layer

| Module | Owns |
| --- | --- |
| `src/sfx.ts` | Tone.js procedural music + SFX bank — pan-aware, mood-switched, loaded on demand |

### Design system

| Module | Owns |
| --- | --- |
| `src/design-tokens/colors.ts` | `LINEAGE`, `SCALE` (50–950 per axis), semantic `ROLE` layer, back-compat `OBJEXOOM_PALETTE` |
| `src/design-tokens/typography.ts` | `FONT_FAMILY`, `FONT_WEIGHT`, `LETTER_SPACING`, `FONT_SIZE`, `LINE_HEIGHT` |
| `src/design-tokens/spacing.ts` | Spacing scale |
| `src/design-tokens/motion.ts` | Duration + easing tokens |
| `src/design-tokens/index.ts` | Barrel re-export |
| `app/tokens.css` | CSS-custom-property mirror (`--obx-*`) |
| `app/fonts.css` | 12 `@font-face` declarations |

## Data flow — single frame

1. Vite serves `app/main.tsx` → mounts `<ObjexoomShell />`.
2. Shell holds `state: GameState` (status, hp, ammo, weapon, kills,
   key, run stats) and `map: ObjexoomMap` (built from
   `buildMap(seed, level)`).
3. `<ObjexoomScene>` mounts `<Canvas>` with the current map + a
   `gameRef` for sim callbacks. Inside the canvas:
   - `useFrame` ticks every enemy via `tickEnemyFsm`
   - yuka EntityManager runs steering
   - Mesh transforms are written **via refs**, not React state, so the
     scene re-renders only on map/level changes
4. Bullets created via `makeEnemyBullet` advance with
   `stepEnemyBullet`; collisions go through `castRayAny`.
5. Player damage flows: enemy → `gameRef.current.onHit(damage)` → sets
   `hp` in state → HUD re-renders only the HP block.
6. Win condition: `gameRef.current.onWin()` → Shell transitions phase
   → going_back machine flips → onReachSpawn → MISSION COMPLETE
   overlay.

## Debug hook contract

Add `?objexoomDebug` to the URL to expose `window.__objexoom`:

```ts
type DebugHooks = {
  getState(): {
    status, hp, ammo, weapon, kills, hasKey, totalEnemies,
    run: RunStats, mapKind, playerSpawn, keyPosition,
    exitPosition, enemySpawns
  };
  start(): void;
  teleport(x: number, y: number, yawRad?: number): void;
  fire(): void;
  killAllEnemies(): void;
  collectKey(): void;
  collectAllPickups(): void;
  triggerWin(): void;
};
```

Pointer-lock + canvas-keyed input is hostile to scripted automation,
so the e2e suite drives the game exclusively through this contract.
The hook is gated by `process.env.NODE_ENV !== "production"` AND the
URL param — neither alone enables it.

## Critical contracts

- **Sim purity.** Anything imported by `engine.ts` / `buildMap.ts` /
  `enemyAi.ts` / `turtle.ts` / `runStats.ts` MUST be deterministic.
  No `Math.random()`, no `Date.now()`, no module-level mutable state.
  The commit-gate enforces this.
- **GLB URL resolution.** Three's loaders ignore Vite's `base` env, so
  every asset URL in `models.ts` flows through `A()` which prefixes
  `import.meta.env.BASE_URL`. In dev/build the base is `/`; in
  gh-pages it's `/objexoom/`. Both work identically downstream.
- **No Objexiv imports.** This is a standalone game. The commit-gate
  rejects any `@objexiv/*` or relative-up-to-Objexiv import.
- **Refs over state in the scene.** React re-renders inside `<Canvas>`
  are expensive. Game state that ticks every frame (positions,
  rotations, velocities, animation phase) lives in `useRef` and
  mutates in `useFrame`; React only learns about it on a phase change.
