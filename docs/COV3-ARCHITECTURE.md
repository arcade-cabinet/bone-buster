---
title: COV3 — Modular Structures architecture
updated: 2026-05-14
status: current
domain: technical
---

# COV3 — Modular Structures architecture

Plan-of-record for replacing the procedural sector geometry with
modular PSX Mega Pack II Structure pieces. Multi-step arc; each step
is a separate commit so the renderer can be evaluated in pieces.

## Use cases

1. **Floor surface identity** — instead of one tinted `<shapeGeometry>`
   per sector, scatter asphalt / concrete tile GLBs over the floor.
   Player perceives texture variation and "this is a real surface,
   not a flat color."
2. **Wall surface identity** — instead of one `<boxGeometry>` per
   edge, place modular wall pieces along edges with seeded variant
   pick (`wall_concrete_*`, `wall_brick_*`, `beam_*`).
3. **Doorway cutouts** — at portal edges (sector-to-sector openings),
   the wall pieces need to be omitted or replaced with `doorway_*`
   pieces.
4. **Archetype identity** (E13 dependency) — different archetypes
   (corridor / sewer / library) use different tile/wall sets so a
   sewer reads differently from a library.

## Per-step plan

### Step 1 (this commit)

Asphalt floor tiles scattered over refLevel 0's sector floors.
RefLevel 1 + 2 retain the procedural floor shape. Walls + ceilings +
collision unchanged across all refLevels.

**Why refLevel 0 first:** it's the smallest test surface; if the
visual character is wrong on the smallest map, fix it before applying
to bigger maps.

**Why floor only:** the renderer rewrites are tractable when each
surface type ships separately. Walls / doorways are step-2 and step-3.

**Acceptance for step-1:**
- New `src/scatter/floorTiles.ts` exports `spawnFloorTiles(map)` →
  `FloorTileInstance[]`. Deterministic per `map.seed XOR 0x464C5254`
  ("FLRT" tag). Returns `[]` for any refLevel other than index 0
  (gated by a new `map.useModularFloor: boolean` field on
  `ObjexoomSectorMap`).
- New `src/scene/entities/FloorTileField.tsx` renders one cloned mesh
  per FloorTileInstance.
- `SectorMapGeometry` detects `map.useModularFloor` and OMITS the
  procedural floor shape for sectors in that map. The procedural
  floor stays for legacy maps.
- ≥10 distinct tile instances on the refLevel-0 spawn sector alone.
- Unit tests pin determinism + the gating contract.
- Visual: a screenshot of refLevel 0 shows visible tile variation in
  the floor (asphalt grain reads as a real surface, not flat color).

**Asset pool:** 4 asphalt variants (`asphalt_hr_1.glb`,
`asphalt_hr_1_large.glb`, `asphalt_hr_2.glb`, `asphalt_hr_3.glb`).

### Step 2 (future commit)

Modular wall pieces for refLevel 0 sector edges. Same gating field
(`map.useModularWalls`). Procedural box-walls stay on refLevels 1+2.

### Step 3 (future commit)

Doorway cutouts at portal edges. Required for step-2's walls not to
hide the navigation paths between sectors.

### Step 4 (future commit, E13 dependency)

Per-archetype tile/wall asset sets so each archetype reads visually
distinct.

## Single-source

This doc lives in the chain `DESIGN > ARCHITECTURE > DECISIONS > PRD >
directive`. If a step ships and the spec needs revision, edit this
doc in the same commit that ships the step.
