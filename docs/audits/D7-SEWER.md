---
title: D7-sewer — content audit
updated: 2026-05-16
status: current
domain: creative
---

# D7-sewer — content audit

Per PRD §ARCHETYPE INTERLEAVE D7: every audit produces two outputs:
(a) slotted asset assignments and (b) "ideas this asset gave me"
list.

This audit covers the SEWER archetype (seed % 5 === 3) — the
underground / damp / moss-funk industrial-tunnel space. Sewer's
identity hook is the WaterSurface sectors (E7) — `isWater: true`
sectors get an animated water plane.

## Current sewer slot map (post-D5)

| Slot | Asset | Status |
|---|---|---|
| Walls | procedural box-quads (low-headroom) | shipped |
| Floor | procedural flat-color (sewer tint) | shipped |
| Water sectors | E7 WaterSurface (procedural animated texture per sector) | shipped |
| Lighting palette | sewer → low-key cool + algae green accent | shipped (E13 step-2) |
| Enemy mix | per-archetype table (sewer slot — slimy/wet variants) | D5 |
| Static scatter | DebrisField / LampField / PropField / TrapField | shipped; debris instanced via corridor A1 win |
| Ephemeral | BodyPartField / ShellEjectField / BulletField / ParticleBurstField | shipped, NOT pooled (architectural decision — see D7-CORRIDOR) |
| Body-part TTL | 8000ms (POL41) — longer atmospheric persistence in damp space | shipped |
| Music | sewer/loop.ogg | shipped (A11e) |
| Ambient | sewer archetype slot via Howler | shipped (A11d) |
| Level name | sewer S-pool | shipped (D8) |

## A1-sewer + A2-sewer slot wiring (this slice)

**No sewer-specific scatter components exist.** Sewer's archetype
identity is delivered via:

- Per-archetype lighting palette (already shipped).
- WaterSurface — per-water-sector animated plane (NOT an
  InstancedField candidate; each plane uses its own sector
  polygon as geometry).
- Body-part TTL bump to 8000ms (longer than corridor's 5000ms)
  for atmospheric carryover.
- Per-archetype enemy mix.

**A1-sewer win:** DebrisField → InstancedGltfField (commit
288a7d3) — sewer's debris density per archetype is `[3, 5]` per
sector; same migration carries over.

**A2-sewer:** deferred per the architectural decision in
D7-CORRIDOR.

## Perf baseline (post-D5 + post-A1)

| Metric | Value | vs OBS3 budget |
|---|---|---|
| peakCalls | 638 | 1200 (~88% headroom) |
| peakTris | 26533 | 80000 (~67% headroom) |
| minFps | 119.8 | 50.0 (floor) |

Sewer is the lightest archetype on draw calls — its mix doesn't
include the heavy-roster bighoss/mrZ kinds and there's no
archetype-specific scatter to add weight beyond the shared
debris/lamps/props.

## Ideas this audit gave me

1. **Dripping-water particle source.** Sewer is the obvious
   archetype for ambient dripping particles — small water motes
   that fall from ceiling height to floor at random sector
   ceiling points. Would key off the existing ParticleBurstField
   plumbing but with a `kind: "drip"` emitter on the archetype.
   PARK — needs new burst kind + emitter logic.

2. **Sewer mossy growths.** The walls are bare procedural
   box-quads. Patches of moss/algae texture mapped onto wall
   panels would sell the damp identity. Reuse the future
   per-plant GLB pipeline from D7-COURTYARD idea #1. PARK —
   wraps into the COV11 nature pipeline expansion.

3. **WaterSurface enemy-displacement ripple.** When an enemy
   steps into a water sector, the surface should ripple at the
   contact point. Mechanically: emit a `kind: "ripple"` burst
   centered on the enemy XZ. Strong sewer-identity moment.
   PARK — needs new burst kind + enemy-sector intersection
   detection.

4. **Algae bloom on settled body-parts.** POL41 already gives
   sewer the longest body-part TTL (8s). Past ~4s, settled
   gibs in a water sector could fade to a different palette
   (algae-green dominant) — sells "the sewer is consuming
   them." PARK — needs per-sector-kind decal color logic.

5. **Lower-headroom geometry.** Sewer's "underground" identity
   would read stronger with visibly lower wall heights. Could
   key off a per-archetype `wallHeight` field on the palette
   record. NOTED for a future POL3-style surface pass.

## Slot architecture changes (this slice — none)

D7-sewer is content + identity confirmation; no slot-arch
changes.

## Acceptance trail

- [x] Slot map documented (above).
- [x] Ideas list captured (above). Items 1, 2, 3, 4 parked;
      5 noted for future pass.
- [x] A1-sewer: covered by corridor's DebrisField →
      InstancedGltfField migration (commit 288a7d3). No
      sewer-specific scatter exists to migrate.
- [x] A2-sewer: deferred (see D7-CORRIDOR §Architectural
      decision).
- [x] Perf baseline updated (commit 5d36291): 638 peakCalls /
      26533 peakTris — most-headroom archetype.

## References

- PRD §ARCHETYPE INTERLEAVE
- docs/audits/D7-CORRIDOR.md §Architectural decision
- `src/scene/map/WaterSurface.tsx` (E7)
- `tests/perf-baselines/sewer.json`
