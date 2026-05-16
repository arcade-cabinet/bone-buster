---
title: D7-courtyard — content audit
updated: 2026-05-16
status: current
domain: creative
---

# D7-courtyard — content audit

Per PRD §ARCHETYPE INTERLEAVE D7: every audit produces two outputs:
(a) slotted asset assignments and (b) "ideas this asset gave me"
list. Slot if obvious; ideas either ship inside the slice OR get
parked at `docs/REBRAND.md`'s "Parked" list.

This audit covers the COURTYARD archetype (seed % 5 === 2) — the
outdoor / open-sky combat space with organic scatter (nature) and
a courtyard-only anchor prop (the COV10 vehicle wreck).

## Current courtyard slot map (post-D5)

| Slot | Asset | Status |
|---|---|---|
| Walls | procedural box-quads (lower-walled vs corridor) | shipped |
| Floor | procedural flat-color (courtyard tint) | shipped |
| Lighting palette | courtyard → daylight overcast / open-sky | shipped (E13 step-2) |
| Enemy mix | per-archetype table (courtyard slot) | D5 |
| Static scatter | DebrisField / LampField / PropField / TrapField | shipped; debris instanced via corridor A1 win |
| Courtyard-only scatter | NatureField (4-8 instances/sector) + VehicleWreck (1 per map at farthest-sector centroid) | shipped (COV11 / COV10) |
| Ephemeral | BodyPartField / ShellEjectField / BulletField / ParticleBurstField | shipped, NOT pooled (architectural decision — see D7-CORRIDOR) |
| Music | courtyard/loop.ogg | shipped (A11e) |
| Ambient | courtyard archetype slot via Howler | shipped (A11d) |
| Level name | courtyard C-verdant pool | shipped (D8) |

## A1-courtyard + A2-courtyard slot wiring (this slice)

The corridor slice generalized `InstancedField` + `EphemeralPool`
so subsequent archetypes inherit. Courtyard's archetype-specific
scatter (NatureField + VehicleWreck) is evaluated against the
factory below.

**NatureField — NOT an A1 candidate without asset refactor.**
NatureField calls `useGLTF(NATURE_MEGA_PACK_URL)` on `Mega_Nature.glb`,
which is a multi-mesh aggregate (every plant/tree variant inside
one GLB). Each `NatureInstance` clones the ENTIRE scene, so all
plant meshes render at every instance position. Migrating to
InstancedGltfField would call `findFirstMesh` and render only the
first mesh in the megapack — a visible regression (only one plant
kind would draw, not the full pack).

To unlock A1 for NatureField we'd need either:
- Split Mega_Nature.glb into per-plant GLBs + assign one per
  instance + group-by-url like DebrisField. Asset pipeline work.
- A multi-InstancedMesh-per-GLB factory variant that creates one
  InstancedMesh per mesh inside the aggregate. Factory work.

Both are out of this slice's scope. Park in `docs/REBRAND.md`'s
"Parked" list. The existing NatureField is rare enough per map
(4-8 / sector × ~8 sectors = ~50 max) that the GPU cost isn't
the limiting factor; the courtyard baseline (885 calls / 17824
tris) is healthy.

**VehicleWreck — NOT an A1 candidate by definition.** One wreck
per map. Instancing is for many copies of one mesh; a singleton
has no instancing benefit.

**A1-courtyard win:** DebrisField → InstancedGltfField (commit
288a7d3) — courtyard's debris density per archetype is `[2, 4]`
per sector, well within the 64-per-url cap. Same shape as corridor.

**A2-courtyard:** deferred per the architectural decision in
D7-CORRIDOR.

## Perf baseline (post-D5 + post-A1)

| Metric | Value | vs OBS3 budget |
|---|---|---|
| peakCalls | 885 | 1200 (~36% headroom) |
| peakTris | 17824 | 80000 (~78% headroom) |
| minFps | 120.3 | 50.0 (floor) |

Courtyard runs lighter than arena because its enemy mix is less
dense and its open-sky layout means fewer LampField pointlights
contributing per-frame shadow-pass calls.

## Ideas this audit gave me

1. **Split Mega_Nature.glb into per-plant GLBs.** Enables
   InstancedGltfField for NatureField with a per-instance plant
   variant selector (deterministic via the NATU PRNG tag). PARK
   — significant asset pipeline work; benefits all archetypes
   that want vegetation in future (sewer mossy growths, library
   indoor plants, etc).

2. **Per-archetype nature palette.** Currently courtyard uses
   the full Mega_Nature.glb everywhere. With variant splitting
   from idea #1, courtyard could lean broadleaf-temperate while
   a future sewer-vegetation slot could lean mosses/funguses.
   PARK — wraps into idea #1.

3. **VehicleWreck color tinting.** The wreck is currently a
   single deterministic variant per seed. A per-map rust-pass
   color modulator (deterministic via VEHL PRNG) would sell
   weathering without new assets. NOTED for a future POL3-style
   surface pass.

4. **Courtyard sky-dome dressing.** The archetype is "open-sky"
   but the actual ceiling is the same flat shader as other
   archetypes. A simple gradient skydome + a far-distance
   silhouette ring (PSX-vibe pixel buildings on the horizon)
   would sell the outdoor identity strongly. PARK — needs
   shader + asset work.

5. **VehicleWreck collision.** Spec says "collision-flat — the
   player can walk through it." Could read as solid prop with
   navigation-block radius matching the wreck's footprint.
   NOTED for a future gameplay polish slice.

## Slot architecture changes (this slice — none)

D7-courtyard is content + identity confirmation; no slot-arch
changes. NatureField + VehicleWreck stay as-is; A1's debris win
carries over from corridor.

## Acceptance trail

- [x] Slot map documented (above).
- [x] Ideas list captured (above). Items 1, 2, 4 parked; 3, 5
      noted for future passes.
- [x] A1-courtyard: covered by corridor's DebrisField →
      InstancedGltfField migration (commit 288a7d3). NatureField
      not an A1 candidate without asset refactor (recorded above).
      VehicleWreck is a singleton.
- [x] A2-courtyard: deferred (see D7-CORRIDOR §Architectural
      decision).
- [x] Perf baseline updated (commit 5d36291): 885 peakCalls /
      17824 peakTris — healthy headroom on both axes.

## References

- PRD §ARCHETYPE INTERLEAVE
- docs/audits/D7-CORRIDOR.md §Architectural decision
- `src/scene/entities/NatureField.tsx`
- `src/scene/entities/VehicleWreck.tsx`
- `tests/perf-baselines/courtyard.json`
