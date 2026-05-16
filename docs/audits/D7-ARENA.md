---
title: D7-arena — content audit
updated: 2026-05-16
status: current
domain: creative
---

# D7-arena — content audit

Per PRD §ARCHETYPE INTERLEAVE D7: every audit produces two outputs:
(a) slotted asset assignments and (b) "ideas this asset gave me"
list. Slot if obvious; ideas either ship inside the slice OR get
parked at `docs/REBRAND.md`'s "Parked" list.

This audit covers the ARENA archetype (seed % 5 === 1) — the
high-enemy-density open combat space. Arena is where the player
faces the densest enemy mix and the loudest combat moments.

## Current arena slot map (post-D5)

| Slot | Asset | Status |
|---|---|---|
| Walls | procedural box-quads | shipped |
| Floor | procedural flat-color | shipped (POL3 candidate for swap to PBR floorTextures.ts) |
| Lighting palette | arena → warm crimson + amber emergency | shipped (E13 step-2) |
| Enemy mix | mrZ(1) bouncer(8) rattler(8) phaser(3) bighoss(1) gawker(2) dolly(1) | D5 |
| Static scatter | DebrisField / LampField / PropField / TrapField | shipped; debris instanced via corridor A1 win |
| Ephemeral | BodyPartField / ShellEjectField / BulletField / ParticleBurstField | shipped, NOT pooled (architectural decision — see D7-CORRIDOR) |
| Music | arena/loop.ogg (combat mood) | shipped (A11e) |
| Ambient | arena archetype slot via Howler | shipped (A11d) |
| Level name | "Annexed Atrium" / "Ash Arc" / etc | shipped (D8) |

## A1-arena + A2-arena slot wiring (this slice)

Arena reuses the `InstancedField` + `EphemeralPool` factories
shipped in the corridor slice. No new factory work needed —
the corridor slice's whole job was to GENERALIZE the factories
so subsequent archetypes (arena, courtyard, sewer, library)
inherit the win without per-archetype migration code.

What actually carries over from corridor:

- **DebrisField → InstancedGltfField** (commit `288a7d3`): debris
  is per-map, not per-archetype. Arena's debris instances are
  drawn through the same component path; the same group-by-url
  + InstancedMesh win applies. Arena's debris density per
  `DENSITY_BY_ARCHETYPE` is `[3, 5]` per sector — well within
  the 64-per-url cap.

- **Ephemeral pool deferral** (D7-CORRIDOR §Architectural
  decision): EphemeralPool's slot model doesn't fit the per-frame
  physics + per-mesh material lifecycle of the shell/body-part/
  bullet/particle pools. Arena fires more shells + body parts
  per second than any other archetype (densest enemy mix), so
  if any archetype were to drive an InstancedBufferAttribute
  shader path, it'd be arena. Parked alongside corridor's same
  decision — revisit if perf data shows ephemeral motes
  dominating peakCalls.

## Perf baseline (post-D5 + post-A1)

| Metric | Value | vs OBS3 budget |
|---|---|---|
| peakCalls | 1013 | 1200 (~18% headroom) |
| peakTris | 67903 | 80000 (~18% headroom) |
| minFps | 120.0 | 50.0 (floor) |

Arena leads all archetypes on draw calls because its enemy mix
is heaviest. Each first-class kind is a skinned GLTF mesh = 1
draw call (+1 shadow pass) per spawn; arena routinely has 12-20
enemies in the cluster the OBS3 PT1C framing captures. That's
mid-tier 30+ calls just from enemies before lighting/scatter/UI.

The A1 corridor migration nudges arena's debris-portion down,
but the enemy-portion dominates. A1-arena's measurable win is
in the ~25-30 debris draw calls reclaimed, not visible at the
arena peak because the peak is enemy-bound, not scatter-bound.

## Ideas this audit gave me

Things the arena slice surfaces that don't fit the current
backlog. Either implemented inline below or parked at
`docs/REBRAND.md`'s "Parked" list:

1. **Per-enemy-kind LOD swap.** At cluster framing distance,
   the 12-20 GLBs in frame are all full-detail. A simple
   distance-based LOD (use the lowest-tri variant when > 30u
   from camera, full when closer) would directly attack the
   arena peakTris/peakCalls. PARK — needs an LOD asset path
   for each of the 24 kinds; significant pipeline work.

2. **Shadow-pass halving on distant enemies.** Each enemy
   contributes a shadow draw call AND a primary draw call —
   skip shadows beyond 25u. The shadowmap is the second-tier
   render pass; halving its enemy participation roughly halves
   the enemy-related draw calls. NOTED for a future PERF slice.

3. **Arena-specific crowd-edge prop ring.** The arena floor is
   currently a flat polygon. PSX-vibe arena spaces (DOOM E1M9,
   Quake 1 arena maps) have a low ring of dressed props at the
   wall-floor seam — pipe stubs, crates, bone piles — that read
   as "this is a combat arena, not a hallway." PARK — needs
   new GLBs; significant slot work.

4. **Per-enemy-kind audio variation.** Arena's heaviest mix
   makes individual enemy sounds blend; per-kind cue sounds
   (rattler hiss vs bighoss footfall) would read clearer.
   PARK — needs new audio assets + the music graph extension
   from A11e.

5. **Arena's `bighoss` as a sub-boss.** Arena's mix has `bighoss(1)`
   — the only place the kind appears in the 5-archetype lineup.
   The PRD doesn't explicitly slot bighoss as boss-class but its
   density (1-per-arena) suggests it could read as one. NOTED
   for a future gameplay-design pass — would need a sub-boss
   music mood + HP tuning + a kill-locked exit guard.

## Slot architecture changes (this slice — none)

D7-arena is content + identity confirmation; no slot-arch changes.
The DebrisField migration was already done in the corridor slice
and applies to all archetypes automatically.

## Acceptance trail

- [x] Slot map documented (above).
- [x] Ideas list captured (above). Items 1, 3, 4 parked; 2 noted
      for future PERF slice; 5 noted for future gameplay-design pass.
- [x] A1-arena: covered by corridor's DebrisField → InstancedGltfField
      migration (commit 288a7d3) since DebrisField is per-map, not
      per-archetype. Arena's per-baseline call count was captured
      in tests/perf-baselines/arena.json by the perf-gate update
      (commit 5d36291).
- [x] A2-arena: deferred (see D7-CORRIDOR §Architectural decision).
- [x] Perf baseline updated (commit 5d36291): peakCalls 494 → 1013
      reflecting the D5 24-kind enemy roster.

## References

- PRD §ARCHETYPE INTERLEAVE
- docs/REBRAND.md §"Enemy roster — 24 first-class kinds"
- docs/audits/D7-CORRIDOR.md §Architectural decision
- `src/scene/entities/DebrisField.tsx`
- `tests/perf-baselines/arena.json`
