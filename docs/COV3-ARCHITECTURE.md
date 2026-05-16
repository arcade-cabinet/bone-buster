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
  `BoneBusterSectorMap`).
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

### Step 2 (shipped)

Modular wall pieces for refLevel 0 sector edges. New optional
`useModularWalls?: boolean` field on `BoneBusterSectorMap`; refLevel 0
opts in, refLevels 1+2 keep procedural box-walls. Implementation:
one stretched GLB clone per non-portal edge (vs. tiling). 4 wall
variants in the pool, deterministic per-edge pick via
`pickWallUrl(hash)` keyed on `sectorId * 100 + edgeIdx`.

### Step 3 (closed-by-design, no commit needed)

Original framing assumed tiled walls with separate doorway cutout
GLBs. Step-2's stretch-one-clone-per-edge approach makes this moot:
portal edges are skipped entirely (the doorway IS the gap), so no
cutout asset is needed. If a future step revisits tiling for variety
along very long edges, the doorway-cutout question returns then.

### Step 4 (shipped)

Per-archetype wall pools via `WALLS_BY_ARCHETYPE: Record<PropArchetype, readonly string[]>`.
Each of the 5 archetypes (corridor / arena / courtyard / sewer /
library) has its own 4-GLB pool drawn from distinct PSX Mega Pack II
prefix families (`hr_*`, `hs_*`, `rg_*`, `rtx_*`, `rx_*`). The
corridor pool is the literal step-2 array unchanged so refLevel 0
canonical screenshots stay byte-stable. `pickWallUrl(archetype, hash)`
gains the archetype argument; `SectorMapGeometry` resolves it via
`pickArchetype(map)`. `refLevel.ts` sets `useModularWalls: true` for
ALL ref levels — refLevel 0 stays corridor (canonical bytes), refLevels
1+2 light up arena and courtyard pools respectively.

### Step 5 (shipped) — modular walls on procedural grid maps

`MapGeometry` (grid path) gained a `<GridWall>` inline component that
mounts a cloned GLB per wall cell using `pickWallUrl(archetype, hash)`
where archetype is resolved from `pickArchetype(map)` once per render.
The per-cell hash retains the original `gx*31 + gy*17` formula so
neighboring cells get different variants. GLBs are scaled to fill the
cell slot (X/Y from native 2-unit dims, Z stretches the thin native
depth so the wall reads solid from any angle). Adoption is
unconditional — every procedural grid map gets archetype walls.
Canonical screenshots stay byte-stable because the canonical refLevel-0
pose runs on `SectorMapGeometry`, not the grid path.

## Single-source

This doc lives in the chain `DESIGN > ARCHITECTURE > DECISIONS > PRD >
directive`. If a step ships and the spec needs revision, edit this
doc in the same commit that ships the step.
