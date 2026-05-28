---
title: Scene + Shell decomposition (CR-H1scene)
updated: 2026-05-28
status: current
domain: technical
---

# CR-H1scene — decomposing BoneBusterScene + BoneBusterShell

`app/views/Scene.tsx` (BoneBusterScene, ~1130 lines pre-split) and
`app/views/Shell.tsx` (BoneBusterShell, ~1060 lines) are the two God-components
the full-review H-1 flagged. This doc records the use-case enumeration and the
binding architectural decisions for the split so the cadence survives
compaction.

## Use-case enumeration — what BoneBusterScene actually owns

The component conflated six responsibilities behind one wall:

1. **Spawn/instance state** — ~18 `useRef`s holding spawned scatter / enemy /
   pickup / barrel instance lists + their three.js mesh-lookup maps.
2. **The per-frame simulation tick** — a 200-line default-priority `useFrame`
   driving yuka, the phase-aware win condition, the going-back light strobe,
   lava damage, trap tick/disarm, pickup collection, the enemy AI loop, and
   bullet integration.
3. **Auxiliary per-frame loops** — five smaller `useFrame`s: crucifix-expiry
   prune, key-pickup proximity, EMF nearest-enemy dispatch, spirit-box
   proximity dispatch, and the muzzle-light decay.
4. **Presentational scatter cluster** — 12 `<*Field>` / `<VehicleWreck>`
   children, each a pure render of a spawned instance list.
5. **Dynamic-entity meshes** — enemy (+ hit-flash + UV slots), pickup, and
   barrel `.map()` blocks, each registering its group into a lookup map.
6. **Lighting / muzzle / effects refs + the fire-event wiring.**

## Frame-ordering invariant — the constraint that shapes the split

r3f runs `useFrame` callbacks in **(priority, registration-order)** order:
same-priority callbacks fire in the order they mounted. Bone Buster relies on
this deliberately:

- `WeaponViewmodel` runs at **priority −1** (updates the muzzle anchor's world
  matrix first).
- The **muzzle-light decay** block runs at **priority +1** (reads the anchor
  pose + `muzzleFlashUntil` AFTER every default-priority block + the fire
  handler — documented at its call site).
- Everything else (main tick, crucifix prune, key pickup, EMF, spirit-box)
  runs at **default priority**, and their *relative* order is currently their
  source order in BoneBusterScene.

**Therefore:** any extraction that moves a default-priority `useFrame` into a
child component changes its registration order relative to the siblings left
behind — a real, if subtle, behavior risk. The explicitly-priority-pinned
blocks (−1, +1) are robust to registration order because priority dominates.

## Decision — extraction boundary

| Step | What moves | Risk |
| --- | --- | --- |
| a | `<ScatterFields>` — the 12-child scatter cluster | none (pure JSX) — DONE |
| b | `<EntityMeshes>` — enemy/pickup/barrel mesh maps (the directive's `<EnemyField>`) | none (pure JSX, ref identity preserved) — DONE |
| c | `runSceneTick(deps)` pure function in `src/scene/tick/sceneTick.ts` — the 200-line MAIN tick BODY, called from a `useFrame` that STAYS in BoneBusterScene | low — registration unmoved, so frame order is byte-identical |
| d | Shell `gameReducer` promotion + CR-F8 `onCollectPickup` table + `useLevelTransition` extraction + flushSync dissolution | medium — logic refactor, pinned by Shell browser test + e2e playthrough |

**Why a pure `runSceneTick(deps)` function, NOT a `<SceneTickDriver>` child
component (the surfaced refinement):** the step-c investigation showed the
200-line main tick is deeply coupled to BoneBusterScene's effect layer and the
fire-resolution path through ~18 shared mutable refs (`phaseRef` is written in
an effect, `yukaEntitiesRef` in the spawn-sync effect, `timeScaleBusRef` in the
key-acquire effect AND the fire handler, etc). A `<SceneTickDriver>` child would
have to either thread ~25 mutable refs as props, or drag that whole web of
effects + fire-handling into the child — which RELOCATES the God-component
rather than decomposing it, and risks shifting `useFrame` registration order
(see the frame-ordering invariant above).

Instead, follow the idiom the codebase ALREADY uses for its frame loop
(`tickEnemyLoop`, `resolveFire`, `timeScaleBus` are all extracted units the
`useFrame` calls into): lift the tick BODY into a pure `runSceneTick(deps)` in
`src/scene/tick/sceneTick.ts`, taking a single `deps` object of the refs/values
it reads. The `useFrame(...)` registration STAYS in BoneBusterScene — so frame
order is byte-identical — and shrinks to a single `runSceneTick({...})` call.
This cuts ~200 lines from Scene, matches the established pattern, and carries
zero frame-order risk.

The five auxiliary default-priority `useFrame`s (crucifix prune, key pickup,
EMF, spirit-box) and the priority-pinned blocks stay registered in place; only
the MAIN tick's body moves. (The smaller aux loops are <20 lines each and
already cohesive — extracting them would be churn for no readability gain.)

**Rejected — `<SceneTickDriver>` child component:** would re-home the
shared-ref web and risk frame-order drift; relocates rather than decomposes.

## Verification bar (every step)

`pnpm verify` green + the 5 canonical e2e screenshots pass byte-for-byte
(the full 6-level playthrough exercises win condition → lava → traps →
pickups → enemy AI → bullets end-to-end), and the Shell browser test
(`BoneBusterShell.browser.test.tsx`) stays green for the step-d reducer work.
