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

Step-2 migrations (shipped this slice):
- DebrisField → InstancedGltfField (single-url-per-mesh groups) — SHIPPED in commit `288a7d3`
- KitchenField → InstancedGltfField (library-only, same shape) — SHIPPED in commit `be4e4af`
- ShellEjectField → EphemeralPool — DEFERRED (see §Architectural decision below).
  EphemeralPool was deleted entirely in commit `0ec99bd` after the
  simplifier + perf reviewers independently flagged it as wrong-fit;
  per-frame physics + per-mesh independent opacity require a separate
  `InstancedBufferAttribute` shader path that's its own slice.

Step-3: tests/perf-baselines/corridor.json regression gate updated
(commit `5d36291`). Post-A1 peakCalls = 810 (down 24 from 834
baseline). Bigger win — arena's 1013 calls — surfaced the OBS3
budget bump from 1000/100k to 1200/80k tris.

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
- [x] ~~EphemeralPool factory module shipped (commit a4daceb).~~
      **Deleted post-review**: zero production callers + slot model
      wrong-fit for ephemeral physics (see Architectural decision
      below + memory note `ephemeral-pool-not-instancing.md`).
      Per the meta-rule "only build what the current step needs;
      let the work surface the next step," the abstraction was
      shipped speculatively. Both the simplifier and performance
      reviewers flagged it on the post-PR review. The right design
      for ephemeral pooling is an `InstancedBufferAttribute` shader
      path — re-add when a real ephemeral migration justifies it.
- [x] Factories split into procedural + GLB forms (commit ebe1706)
      to satisfy React rules-of-hooks (useGLTF must be unconditional).
      Procedural form retained even though the only initial use
      was the (now-deleted) EphemeralPool wrapper — InstancedField
      with caller-provided geometry/material is still useful for
      future procedural sources, and the split is what makes the
      GLB wrapper's useGLTF call unconditional.
- [x] Step-2a: DebrisField → InstancedGltfField (commit 288a7d3).
      Groups instances by url; one InstancedMesh per unique url,
      one draw call per group instead of N. 5 canonical + 10
      archetype e2e screenshots stayed green.
- [ ] Step-2b: at least one ephemeral pool migrated. **DEFERRED —
      see Architectural decision below.**
- [ ] Step-3: perf-baseline regression gate updated. Pending.

## Architectural decision — ephemeral pools

ShellEjectField, BodyPartField, BulletField, ParticleBurstField
all share an architectural shape that EphemeralPool DOES NOT fit:

1. **Per-frame physics.** Each mote/shell/shard updates position
   + rotation + (sometimes) velocity every frame in `useFrame`,
   not just at spawn.
2. **Per-mesh independent materials.** Opacity decays over a
   per-instance TTL; some pools also vary color/radius/emissive
   per instance. Three.js InstancedMesh has ONE shared material
   per draw call — per-instance opacity requires custom shader
   work (`InstancedBufferAttribute` + `onBeforeCompile`).

EphemeralPool as built writes matrices on a `slots` prop change
in `useEffect`, with the implicit contract that slots are
spawn-once-then-static-then-expired. That's the right design
for *scatter* with TTL (e.g. a footstep decal field that pops
in, persists, then fades), but it is NOT the right design for
ballistic particle fields where every frame writes new positions.

Two real options for closing the gap:

**Option A — per-mote InstancedBufferAttribute opacity.** Add
an `instanceOpacity` attribute on the InstancedMesh, branch the
material's fragment shader to multiply gl_FragColor.a by it.
Pool the `useFrame` body writes per-mote position via setMatrixAt
AND per-mote opacity via setAttributeAt. Big-bang change touching
all four files; requires shader patches.

**Option B — leave the ephemeral fields alone.** They already
use QW3 module-scope shared geometry. The remaining draw-call
cost is per-mote, but the QW3 fix already eliminated the
GPU-resident geometry churn that was the original perf wedge.
Profile first; if peakCalls in the corridor baseline shows
ephemeral motes dominating, revisit with Option A.

**Decision: Option B.** Reasoning:
- The factory's whole job (per the PRD) is collapsing N draw
  calls into 1 for *scatter* — the static, GLB-backed sources.
  Ephemeral pools were named in the audit but the audit author
  (myself) underestimated the per-frame + per-material shape.
- A1 already wins on debris (the biggest static scatter pool);
  step-3 will measure whether the ephemeral pools are actually
  on the critical path.
- If the perf-baseline data demands Option A, that's a separate
  slice with shader-level work + its own test surface. Forcing
  it through EphemeralPool now would either ship a broken pool
  (slot model wrong) or balloon the corridor slice into a shader
  refactor.

This is exactly the "use-case enumeration" the CLAUDE.md asks
for: the ephemeral fields have a per-frame physics + per-mesh
material lifecycle that's genuinely different from the static
scatter the factory was built for. The hybrid is "static scatter
→ InstancedField; ephemeral physics → leave as-is until shader
work is justified by data."

## References

- PRD §ARCHETYPE INTERLEAVE
- docs/REBRAND.md §"Enemy roster — 24 first-class kinds"
- `src/scene/render/InstancedField.tsx`
- `src/scene/render/EphemeralPool.tsx`
- `tests/perf-baselines/corridor.json`
