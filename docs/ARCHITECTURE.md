---
title: Architecture
updated: 2026-05-13
status: current
domain: technical
---

# BONE BUSTER — system architecture

## Top-down

```
┌───────────────────────────────────────────────────────────┐
│  Capacitor shell (Android / iOS) — wraps the web bundle   │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Vite + React 19  (app/)                            │  │
│  │  ┌────────────────────┐  ┌───────────────────────┐  │  │
│  │  │  BoneBusterShell     │  │  design-tokens        │  │  │
│  │  │  (lifecycle,       │  │  (colors, type,       │  │  │
│  │  │   debug hooks,     │  │   spacing, motion)    │  │  │
│  │  │   level transit.)  │  └───────────────────────┘  │  │
│  │  └─────┬──────────────┘                             │  │
│  │        │                                            │  │
│  │  ┌─────▼──────────┐    ┌────────────────────────┐   │  │
│  │  │ BoneBusterScene  │    │  BoneBusterHUD           │   │  │
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
| `src/engine/engine.ts` | Map types (`BoneBusterGridMap`, `BoneBusterSectorMap`), raycasts, collision, enemy/bullet/pickup types, sector portal computation, `polygonContains` |
| `src/world/buildMap.ts` | Procedural map generation (grid + sector variants) from a seed |
| `src/ai/turtle.ts` | Logo-style turtle DSL used by `buildMap` for shape generation |
| `src/ai/enemyAi.ts` | Per-enemy FSM tick (patrol → approach → shoot). Pure function `tickEnemyFsm(enemy, ctx) → next` |
| `src/ai/yukaIntegration.ts` | Stateful yuka EntityManager bridge — mirror sim positions in, run steering, write target velocity back |
| `src/store/runStats.ts` | Per-run kill/damage/time accounting, reducer-shaped |
| `src/store/settings.ts` | Difficulty + level enums, tuning tables (`DIFFICULTY_TUNING`) |
| `src/shared/weapons.ts` | Weapon registry (id → spec) |
| `src/world/refLevel.ts` | Reference-clone level imports, ManyEnemies spawner |

### Rendering layer (r3f + three)

| Module | Owns |
| --- | --- |
| `app/views/Scene.tsx` | r3f Canvas root, scene composition, MapGeometry, SectorMapGeometry, EnemyMesh, WeaponViewmodel, KeyMarker, ExitPortal, RealDoor, TreasureChest — **flagged for decomposition; see DECISIONS** |
| `app/components/PlayerController.tsx` | Camera + movement input (pointer-lock + touch sticks), pointer-lock state |
| `src/assets/models.ts` | Enemy + weapon + prop GLB registry + per-kind skin rosters, BASE_URL-aware URL helper `A()` |
| `app/components/RefLevelMap.tsx` | Renderer for reference-clone level layouts |

### UI layer

| Module | Owns |
| --- | --- |
| `app/views/Shell.tsx` | App lifecycle (landing ↔ in-game ↔ overlay), level transitions, debug hook attachment, fade trigger |
| `app/views/HUD.tsx` | Corner HUD blocks (HP, KILLS, KEY), weapon chips, ammo readout, crosshair, overlay cards (PAUSED, YOU DIED, MISSION COMPLETE), touch sticks + FIRE button, CLICK TO ENGAGE |
| `app/views/Landing.tsx` | Main menu (NEW GAME, OPTIONS, HOW TO PLAY), difficulty + level pickers, options pane, music loading indicator |

### Audio layer

| Module | Owns |
| --- | --- |
| `src/audio/sfx.ts` | Tone.js procedural music + SFX bank — pan-aware, mood-switched, loaded on demand |

### Design system

| Module | Owns |
| --- | --- |
| `app/styles/tokens/colors.ts` | `LINEAGE`, `SCALE` (50–950 per axis), semantic `ROLE` layer + nested `ROLE.surface/text/accent/brand` (PRD §R2), `BONE_PALETTE` 14-anchor export, current-name `OBJEXOOM_PALETTE` flat-keys (renamed to `BONE_BUSTER_PALETTE` by R8) |
| `app/styles/tokens/typography.ts` | `FONT_FAMILY`, `FONT_WEIGHT`, `LETTER_SPACING`, `FONT_SIZE`, `LINE_HEIGHT` |
| `app/styles/tokens/spacing.ts` | Spacing scale |
| `app/styles/tokens/motion.ts` | Duration + easing tokens |
| `app/styles/tokens/index.ts` | Barrel re-export |
| `app/tokens.css` | CSS-custom-property mirror (`--obx-*`) |
| `app/fonts.css` | 12 `@font-face` declarations |

### Persistence layer (STO1a, partial; STO1b pending)

| Module | Owns |
| --- | --- |
| `src/platform/persistence/preferences.ts` | Thin facade over `@capacitor/preferences` — `readPref`/`writePref`/`removePref` + JSON variants. App code MUST go through this module; **direct `localStorage` access in `src/**` is forbidden**. Best-effort writes (swallows quota/lock failures). |
| `src/platform/persistence/settingsStore.ts` | KV settings persistence — `validateSettings(unknown)` runtime narrows foreign blobs to the live `BoneBusterSettings` shape; `loadSettings()` / `saveSettings()` are the public surface for `BoneBusterShell` to async-hydrate + auto-save settings across sessions. |
| `src/store/runHistory.ts` | E9 run history — currently sql.js + manual base64 blob (STO1b will replace with `@capacitor-community/sqlite` + jeep-sqlite WASM). Exports `openRunHistory()`, `RunRecord`, `RunInsert`, `formatRunDuration` (POL32 — shared formatter for landing chip + future HUD surfaces). |

**Settings persistence flow:**
1. Mount: `BoneBusterShell` initializes with `DEFAULT_SETTINGS` (or `{...DEFAULT_SETTINGS, level: "procedural"}` when URL has `?archetype`).
2. Async-hydrate effect: `loadSettings()` reads from Preferences; if a valid blob exists, `setSettings(persisted)`. Flag `settingsHydratedRef.current = true`.
3. Save-on-change effect: gated on `settingsHydratedRef.current`, writes the current settings to Preferences on every change. The guard prevents the boot DEFAULT_SETTINGS from clobbering a persisted blob during the brief async window.
4. URL override (`?archetype`) wins as a per-load short-circuit — the debug harness path that swaps to procedural maps without first clearing storage.

**Why this lives in `src/platform/persistence/` instead of `src/store/settings.ts`:** the settings module is pure type + constants (no async, no I/O); the persistence module is the boundary where Capacitor lives. Keeping them separate means `src/store/settings.ts` stays trivially unit-testable without mocking the native plugin.

## Data flow — single frame

1. Vite serves `app/main.tsx` → mounts `<BoneBusterShell />`.
2. Shell holds `state: GameState` (status, hp, ammo, weapon, kills,
   key, run stats) and `map: BoneBusterMap` (built from
   `buildMap(seed, level)`).
3. `<BoneBusterScene>` mounts `<Canvas>` with the current map + a
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

Add `?debug` to the URL to expose `window.__bonebuster`:

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
  gh-pages it's `/bone-buster/`. Both work identically downstream.
- **No arcade-cabinet imports.** This is a standalone game. The commit-gate
  rejects any `@arcade-cabinet/bone-buster` import, or any relative import
  that escapes upward into a sibling arcade-cabinet repo.
- **Refs over state in the scene.** React re-renders inside `<Canvas>`
  are expensive. Game state that ticks every frame (positions,
  rotations, velocities, animation phase) lives in `useRef` and
  mutates in `useFrame`; React only learns about it on a phase change.
- **HUD slot pattern.** Every transient HUD ceremony (SecretFoundFlash,
  KeyPickupCeremony, PickupChip, DifficultyChip, GoingBackOverlay,
  MissionCompleteCeremony) is a sibling component under
  `app/views/hudOverlays/` mounted via `<HUDOverlays>`. Each slot is
  self-contained: listens for its trigger (event OR prop), renders an
  AnimatePresence-wrapped element with spring-eased entry/exit, fades
  itself out. Adding a new slot is one-file + one-line in HUDOverlays.
  Spec: [`docs/SLOT-ARCHITECTURE.md`](SLOT-ARCHITECTURE.md).
- **Slot trigger choice — event vs. prop.** Two trigger styles coexist:
  - **Event-driven** (`addBoneBusterListener("type", h)`): the slot is
    already mounted when the event fires. Examples: `SecretFoundFlash`,
    `KeyPickupCeremony`, `PickupChip`. Cheap to wire; works because the
    HUD is up.
  - **Prop-driven** (monotonic counter prop): the slot is part of a
    subtree that **mounts AFTER the trigger condition flips**. Example:
    `DifficultyChip` (POL31) — the HUD subtree only renders when
    `status !== "landing"`, and `<AnimatePresence mode="wait">` on the
    landing→game transition adds a ~350ms exit animation before the
    new subtree mounts. An event dispatched at transition time would
    fire BEFORE the listener registered. The fix is to drive the slot
    from a prop the parent owns (e.g. `runId: number` bumped per
    transition); the slot's `useEffect(() => trigger, [runId])` runs
    on first mount and is race-free by construction.
  Rule: if the slot's subtree mounts after the trigger event would
  fire, **use a prop**, not an event listener.
