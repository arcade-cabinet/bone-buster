---
title: PSX Mega Pack II inventory + archetype assignments
updated: 2026-05-16
status: current
domain: technical
---

# PSX Mega Pack II — inventory + archetype assignments (PE4 step-1)

The PSX Mega Pack II extraction at
`references/_extracted/psx/psx-mega-pack-ii-v1-8/PSX Mega Pack II/Models/other-formats/FBX/`
holds **549 GLBs** across 12 categories. Too large for one slice;
this doc enumerates the categories, assigns each to one or more
archetypes from `src/world/scatter/propPool.ts`, and records the
"ideas this asset gave me" for follow-up gameplay slices.

Per-archetype wiring slices land as **PE4a..PE4n**, each driving from
one row of the assignments table.

## Why a doc instead of code

549 GLBs is ~5× the size of every other reference-asset extraction
combined. Naive bulk-wiring would silently bloat the prop catalogue
and confuse the per-archetype identity work PE1-PE3 just landed.
Doing the inventory pass first ensures every batch lands with a clear
"this asset reads as this archetype, in this density, for this
reason" justification, AND surfaces the assets that need bespoke
follow-up handling (interior structural assembly, weapon variants,
hero-prop pickup integrations).

## Counts per category

| Category | GLBs | Notes |
|---|---|---|
| Modular Structures | 210 | Wall/floor/ceiling/stairs modules. ARCHITECTURE — not scatter. |
| Props | 137 | Decorative scatter — the main scatter-pool source. |
| Large Props & Machinery | 52 | Pipes / tanks / shipping containers / chimneys. Sewer + arena. |
| Debris & Misc | 34 | Bricks / gravel / rubble. Arena + sewer + ambient damage tells. |
| Weapons & Tools | 31 | Weapon viewmodels + hand tools. Mixed: some for variants, some scatter. |
| Modular Props | 27 | Smaller modular décor (signage, tile patterns). |
| Buildings | 14 | Garages / sheds / warehouses. Hero structural; not scatter. |
| Decals | 12 | Graffiti + posters. Decal field, not scatter. |
| Light Sources | 10 | Lamps on/off pairs. LampField extension. |
| Masks | 9 | Halloween masks. Hero-prop pickups or NPC accessory. |
| Structures | 7 | Larger one-off structures. Bespoke. |
| Doors & Gates | 6 | Door variants. DoorField extension. |

## Per-archetype assignments

Each row identifies the subset of a category that fits one of the
five archetypes (`corridor` / `arena` / `courtyard` / `sewer` /
`library`) and the per-slice ID that will land it.

### PE4a — Props subset for corridor (industrial residential)
Source: `FBX/Props/` (137 candidates).
Pull: small handheld items, paint cans, tools, cleaning supplies,
crates that read as "abandoned hallway / loading bay" clutter.
Target: extends `POOLS.corridor` (currently 11 entries → ~20).
Estimated wired count: **8-10** GLBs.

### PE4b — Large Props & Machinery for sewer (industrial drag)
Source: `FBX/Large Props & Machinery/` (52 candidates).
Pull: pipe variants (already partially served by PE3 — coordinate
to avoid duplicate silhouettes), shipping containers, distillery,
chimneys.
Target: extends `POOLS.sewer` (currently 18 → ~25-28).
Estimated wired count: **6-8** GLBs.

### PE4c — Debris & Misc for arena (rubble identity)
Source: `FBX/Debris & Misc/` (34 candidates).
Pull: brick piles, gravel, debris stacks. The arena archetype reads
as "after the fight" so debris fits its visual register exactly.
Target: extends `POOLS.arena` (currently 11 → ~17-18).
Estimated wired count: **6-8** GLBs.

### PE4d / PE4e / PE4f — ALREADY SHIPPED

Verified during the PE4d-f staging pass: `lampScatter.ts` (COV1)
already wires all 5 lamp models × on/off pairs, `doors.ts` (COV7)
already wires the 6 door + gate variants, and `decals.ts` (COV6)
already wires all 12 graffiti + posters. The PE4d/e/f items were
in the directive based on the inventory's original "what's
available?" pass; they were already drained in earlier slices
(COV1 / COV6 / COV7) — the inventory pass had stale awareness of
those completions.

No further work for D / E / F lanes; pruned from directive without
new commits beyond the pruning commit itself.

### PE4g — Modular Structures (DEFERRED beyond PE4)
Source: `FBX/Modular Structures/` (210 candidates).
This is wall/floor/ceiling architecture. The existing renderer paints
walls procedurally — adopting modular structural meshes is a much
larger architectural shift (would require rewriting the
`MapGeometry`/`SectorMapGeometry` rendering path). Not in scope for
PE4. Tracked as a separate "structural overhaul" follow-up that
SHOULD wait until the existing procedural floors and walls have been
visually-judged adequate and the upgrade ROI is clear.

### PE4h — Modular Props subset
Source: `FBX/Modular Props/` (27 candidates).
Pull: standalone décor pieces that DON'T require modular assembly
to read. Targets any archetype that benefits. Tight slice: only the
items that read alone — defer the truly modular ones to a follow-up.
Estimated wired count: **4-6** GLBs.

### PE4i — Weapons & Tools (HOLD)
Source: `FBX/Weapons & Tools/` (31 candidates).
Some are weapon viewmodels (candidates for melee/pistol/chaingun skin
pool expansions); others are hand tools that read as scatter
(hammers, wrenches, screwdrivers). Mixed bag. HOLD until the existing
PD lane finishes draining — adding to the skin pools right now would
collide with PD3b's pending Stylized Guns scene-split.

### PE4j — Buildings (DEFER)
Source: `FBX/Buildings/` (14 candidates).
These are hero structures (garages, sheds, warehouses). They aren't
scatter — they'd be exit-portal-scale set pieces or per-archetype
landmark structures. Defer to a future "landmark / set piece" lane.

### PE4k — Masks (NPC accessory)
Source: `FBX/Masks/` (9 candidates).
Halloween masks. Read as hero pickup or as NPC accessory props. NOT
scatter. Defer to a future NPC slice.

### PE4l — Structures (DEFER as PE4g)
Source: `FBX/Structures/` (7 candidates).
Same shape as Buildings. Defer.

## Estimated PE4 effort total

If PE4a-PE4f land in sequence, they contribute roughly **35-45 new
PROP_CATALOGUE / lamp / door / decal entries** across the affected
archetypes — a meaningful identity bump per archetype, with
mechanically minor surface changes (each slice is "extend a registry
+ table + tests").

Items g/h/i/j/k/l stay parked at the end of this doc with explicit
"defer to … because …" justifications so future planning can pick
them up without re-doing the inventory.

## What this doc deliberately doesn't do

- Pick exact filenames for each PE4* slice — that's the per-slice
  step-1, where visual judgement on individual GLBs lives.
- Define new POOLS keys, profile tables, or any other code shape —
  PE4 step-1 is intentionally docs-only, per the directive's
  "no code in PE4 step-1" rule. Each PE4* slice does its own
  asset selection + wiring + contract test update.
- Touch the canonical screenshot battery — every PE4* slice MUST
  preserve append-only ordering against PROP_CATALOGUE indices so
  seed=N screenshots stay byte-stable, exactly as PE1 + PE2 + PE3
  did.

## Next slice

PE4a (corridor props subset) is the natural first pick: corridor
has the fewest archetype-true scatter entries today and benefits
most per-GLB-added. PE4b (sewer industrial) is a close second.
