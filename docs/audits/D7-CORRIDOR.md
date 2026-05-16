---
title: D7-corridor — content audit
updated: 2026-05-16
status: current
domain: creative
---

# D7-corridor — content audit

Per PRD §ARCHETYPE INTERLEAVE D7: every audit produces two outputs:
(a) slotted asset assignments and (b) "ideas this asset gave me"
list. Slot if obvious; ideas either ship inside the slice OR get
parked at `docs/REBRAND.md`'s "Parked" list.

This audit covers the CORRIDOR archetype (seed % 5 === 0) — the
PSX-vibe interior tunnel canon, the player's first impression.

## Current corridor slot map (post-D5)

| Slot | Asset | Status |
|---|---|---|
| Walls | procedural box-quads | shipped |
| Floor | procedural flat-color | shipped (POL3 candidate for swap to PBR floorTextures.ts) |
| Lighting palette | corridor → cool indigo + amber accent | shipped (E13 step-2) |
| Enemy mix | rattler(6) bouncer(3) mrZ(2) signal(1) reverend(1) stagged(1) | D5 |
| Static scatter | DebrisField / LampField / PropField / TrapField | shipped, NOT instanced (A1-corridor target) |
| Ephemeral | BodyPartField / ShellEjectField / BulletField / ParticleBurstField | shipped, NOT pooled (A2-corridor target) |
| Music | corridor/loop.ogg (exploration mood) | shipped (A11e) |
| Ambient | corridor archetype slot via Howler | shipped (A11d) |
| Level name | "Crimson Crawl" / "Cinder Cell" / etc | D8 |

## A1-corridor + A2-corridor slot wiring (this slice)

InstancedField + EphemeralPool factory modules in
`src/scene/render/` are the new infrastructure. They are
generic — every archetype reuses them. The corridor slice's
job is to PROVE them out before the other 4 archetype slices
adopt.

Step-2 migrations (subsequent commits in this slice):
- DebrisField → InstancedField (single-url-per-mesh groups)
- ShellEjectField → EphemeralPool (single-url canonical shell)

Step-3: tests/perf-baselines/corridor.json regression gate.
Pre-migration peakCalls = 834; target post-migration ≤ 700
(one InstancedField collapses ~30 debris draw calls into 1).

## Ideas this audit gave me

Things the corridor slice surfaces that don't fit the current
backlog. Either implemented inline below or parked at
`docs/REBRAND.md`'s "Parked" list:

1. **Per-archetype debris palette.** Corridor debris is currently
   the same pool as every other archetype (PSX dungeon rubble).
   Corridor could lean into industrial scrap (pipes, conduit,
   torn paneling) vs. courtyard's organic litter (leaves, bones,
   broken crockery). PARK — needs new GLBs, not in slice.

2. **Animated wall-strip lights.** The corridor's "interior
   tunnel" mood would read stronger with a lit fluorescent strip
   procedurally animated (flicker on the same RNG-tag as the
   per-archetype lighting palette). PARK — needs new shader path.

3. **InstancedField shadowmap budget.** When InstancedField mounts
   castShadow on instanced meshes, the shadowmap call count goes
   up linearly. Worth measuring — could be the perf-baseline's
   limiting factor. NOTED for A1-step-2 perf-baseline pass.

4. **EphemeralPool TTL reclamation.** Current pattern mounts a new
   Three node per shell. EphemeralPool's `expired` flag enables
   reusing slots — but the SHELL_TTL_MS 4-second budget means
   80 active slots peak. Pool size = 80, no extension needed —
   the pool is bounded by physics, not by allocation pressure.
   This applies to BodyPartField + ShellEjectField + BulletField;
   ParticleBurstField has its own tighter TTL.

5. **GLB skin variant for corridor walls.** The walls are
   currently procedural box-quads with a flat color. A
   PSX-vibe "concrete with rebar exposed" wall texture would
   sell the archetype identity without adding geometry. PARK —
   wraps into POL3 floor-texture's wall extension.

## Slot architecture changes (this slice — none)

D7-corridor is content + identity; no slot-arch changes. The
factory mounts are added to existing slot mounts.

## Acceptance trail

- [x] Slot map documented (above).
- [x] Ideas list captured (above). Items 1, 2, 5 parked; 3-4 noted
      for step-2 perf-baseline pass.
- [x] InstancedField factory module shipped (commit a4daceb).
- [x] EphemeralPool factory module shipped (commit a4daceb).
- [ ] Step-2: at least one Field migrated to InstancedField,
      at least one Pool migrated to EphemeralPool. Pending.
- [ ] Step-3: perf-baseline regression gate updated. Pending.

## References

- PRD §ARCHETYPE INTERLEAVE
- docs/REBRAND.md §"Enemy roster — 24 first-class kinds"
- `src/scene/render/InstancedField.tsx`
- `src/scene/render/EphemeralPool.tsx`
- `tests/perf-baselines/corridor.json`
