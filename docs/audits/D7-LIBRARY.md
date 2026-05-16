---
title: D7-library — content audit
updated: 2026-05-16
status: current
domain: creative
---

# D7-library — content audit

Per PRD §ARCHETYPE INTERLEAVE D7: every audit produces two outputs:
(a) slotted asset assignments and (b) "ideas this asset gave me"
list.

This audit covers the LIBRARY archetype (seed % 5 === 4) — the
populated indoor space with bookshelves, kitchen scatter, and
ambient NPC chibis. Library is the most "lived-in" archetype.

## Current library slot map (post-D5)

| Slot | Asset | Status |
|---|---|---|
| Walls | procedural box-quads (taller, "indoor" feel) | shipped |
| Floor | procedural flat-color (library tint) | shipped |
| Lighting palette | library → warm reading-lamp + bookshelf shadows | shipped (E13 step-2) |
| Enemy mix | per-archetype table (library slot — mrZ/reverend/signal lean) | D5 |
| Static scatter | DebrisField / LampField / PropField / TrapField | shipped; debris instanced via corridor A1 win |
| Library-only kitchen | KitchenField (20% of sectors, max 3/sector) | shipped (COV13); **A1 instanced this slice** |
| Library-only NPCs | NpcField (0-2/sector, no AI) | shipped (COV14); NOT an A1 candidate (skinned + per-instance animation mixer) |
| Ephemeral | BodyPartField / ShellEjectField / BulletField / ParticleBurstField | shipped, NOT pooled (architectural decision — see D7-CORRIDOR) |
| Music | library/loop.ogg | shipped (A11e) |
| Ambient | library archetype slot via Howler | shipped (A11d) |
| Level name | library L-pool | shipped (D8) |

## A1-library + A2-library slot wiring (this slice)

**A1-library win #1:** DebrisField → InstancedGltfField (commit
288a7d3) — inherited from the corridor slice.

**A1-library win #2:** KitchenField → InstancedGltfField (this
slice). KitchenField is library-archetype only (20% sector opt-in
× max 3 per sector × ~10 sectors = ~6 instances max per map).
Same shape as DebrisField migration:

- Group instances by `url`.
- Render each group through `<InstancedGltfField>`.
- Per-group cap = 16 (comfortable headroom over the ~3-per-url
  worst case).

Visual gate green: all 10 archetype e2e screenshots passed
post-migration, including the dedicated "library COV13 kitchen
scatter framing" surface test (`archetypeScreenshots.spec.ts:203`).

**NpcField NOT an A1 candidate.** NpcField uses `useAnimations`
with a per-instance mixer + per-instance idle-clip phase offset.
InstancedMesh doesn't support skinned-mesh animation (each
instance would share the same animation state — all chibis
would sync to the same frame, defeating the COV14 step-3
"phase-offset so multiple chibis don't perfectly sync" intent).

**A2-library:** deferred per the architectural decision in
D7-CORRIDOR.

## Perf baseline (post-D5 + post-A1)

| Metric | Value | vs OBS3 budget |
|---|---|---|
| peakCalls | 752 | 1200 (~60% headroom) |
| peakTris | 26135 | 80000 (~68% headroom) |
| minFps | 120.4 | 50.0 (floor) |

Library runs mid-tier. The NPC field adds skinned-mesh draw
calls (each chibi = 1 call + 1 shadow-pass) but the kitchen
A1 migration in this slice claws back several debris-shaped
draw calls. Baseline will update on the next perf-gate run.

## Ideas this audit gave me

1. **Library specifically wants per-NPC LOD.** The COV14 chibis
   are the densest skinned-mesh population in any archetype.
   A low-poly distance-LOD variant + a skip-animation-when-
   off-screen optimization would target library's specific
   peak. NOTED for the same future PERF slice as D7-ARENA
   idea #1.

2. **Bookshelf wall-prop strip.** The library walls are bare
   procedural quads. A repeating bookshelf-texture strip
   (multiplied along the wall length, deterministic per-seed
   for book color variance) would sell the "library" identity
   without adding scatter geometry. PARK — needs shader path.

3. **Chibi-NPC despawn on combat trigger.** Currently NPCs
   stay through combat with no AI. They could despawn (with
   a small puff) when combat opens or the player draws a
   weapon — sells "these are bystanders" and removes the
   visual clash of chibis standing still while enemies
   attack. NOTED for a future gameplay-design pass.

4. **Per-shelf prop tinting.** KitchenField's per-instance
   yaw is deterministic but the model variant + color isn't
   currently varied. Add a per-instance color tint from a
   library-palette pool. NOTED for a future POL3-style pass.

5. **Library-specific quiet ambient layer.** Pages-turning,
   distant cough, quiet shuffling sounds. Howler graph already
   supports layered ambient (A11d/e); add a library-specific
   sample bus. PARK — needs new audio assets.

## Slot architecture changes (this slice — KitchenField → A1)

This slice migrates KitchenField onto the InstancedField factory:

```diff
- {props.map((inst) => <KitchenMesh key={inst.id} inst={inst} />)}
+ {Array.from(byUrl.entries()).map(([url, instances]) => (
+   <InstancedGltfField key={url} url={url} instances={instances} ... />
+ ))}
```

The KitchenInstance shape is already compatible with
InstancedFieldInstance (id, position, yaw — no scale variation
in COV13). No upstream changes needed.

## Acceptance trail

- [x] Slot map documented (above).
- [x] Ideas list captured (above). Items 2, 5 parked; 1, 3, 4
      noted for future passes.
- [x] A1-library win #1: covered by corridor's DebrisField →
      InstancedGltfField migration (commit 288a7d3).
- [x] A1-library win #2: KitchenField → InstancedGltfField
      (this slice). 10 archetype e2e screenshots green
      post-migration.
- [x] NpcField not an A1 candidate (skinned + per-instance
      animation mixer — recorded above).
- [x] A2-library: deferred (see D7-CORRIDOR §Architectural
      decision).
- [x] Perf baseline: 752 peakCalls / 26135 peakTris (from
      commit 5d36291 pre-KitchenField-migration; small
      additional drop expected on next run from kitchen A1).

## References

- PRD §ARCHETYPE INTERLEAVE
- docs/audits/D7-CORRIDOR.md §Architectural decision
- `src/scene/entities/KitchenField.tsx`
- `src/scene/entities/NpcField.tsx`
- `tests/perf-baselines/library.json`
