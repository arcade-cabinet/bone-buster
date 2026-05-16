---
title: Ghost Hunting Tools
updated: 2026-05-16
status: current
domain: product
---

# Ghost Hunting Tools — design

A gameplay layer that overlays single-player Phasmophobia-style
detection mechanics on the existing Bone Buster FPS loop. Inventory
is drawn from `references/PSX Ghost Hunting Tools Release.zip`.

## Single-player adaptation

Phasmophobia's 4-player co-op model doesn't transplant. Two of the
six tools are inherently multiplayer / meta-game and are **dropped**:

| Tool | Phasmo role | Bone Buster fit | Decision |
| --- | --- | --- | --- |
| Spirit box | Voice-prompt to identify ghost type | Single-player adapter possible — random phoneme on proximity, learn the pattern | KEEP (step-3) |
| EMF reader | Handheld pulse meter on ghost proximity | 1:1 fit; HUD chip 1-5 pulse, no asset wire-in needed for v1 | **STEP-1** |
| UV flashlight | Reveals fingerprints (evidence accumulation) | Single-player adapt: UV cone reveals a hidden enemy class | KEEP (step-4) |
| Walkie-talkie | Inter-player comms | No multiplayer in Bone Buster | DROP |
| Crucifix | Consumable; aborts in-progress hunt | Adapter: placeable item that disrupts enemy spawn radius for ~10s | KEEP (step-5) |
| Tape recorder | EVP evidence; meta-game upgrade currency | Tied to inter-run progression Bone Buster doesn't have | DROP |

## Use-case enumeration

Per the architectural-thinking rule (`CLAUDE.md`), step 1 of this
system is naming the actual users / triggers / lifecycle moments:

1. **EMF chip**: passive HUD readout, never user-triggered — pulses
   per-frame based on nearest-enemy distance. Always on once the
   tool is acquired. Lifecycle: acquired (pickup) → active (every
   tick of every map). Storage: a single owned-flag on `GameState`,
   a per-frame distance calc in `useFrame`.
2. **Spirit box (step-3)**: cooldown-gated speech bubble triggered
   when an enemy is within radius. Lifecycle: acquired → cooldown
   timer → speech event → cooldown reset. Storage: cooldown
   timestamp on a ref, event dispatch into the existing audio bus.
3. **UV flashlight (step-4)**: a third light source on the player
   camera (existing flashlight is white-cone; UV is purple-cone)
   that masks-in a hidden enemy variant. Lifecycle: acquired →
   toggle (key 6) → cone-visibility check per enemy per frame.
   Storage: same shape as the existing POL28 flashlight slot.
5. **Crucifix (step-5)**: placeable item dropped at player position
   on use; emits a fixed-radius enemy-spawn debuff for N seconds.
   Lifecycle: acquired (one in inventory) → place → countdown →
   despawn. Storage: a small list of active crucifix instances on
   `GameState` with positions + expiry timestamps.

## Step-1 — EMF reader

The minimum slice that proves the loop:

- New `GameState.ghostHuntingTools.emf: boolean` ownership flag.
- `pickup: 'emf'` added to the PickupKind union; world spawns one
  EMF reader at refLevel(0) so the canonical screenshot keeps the
  proof-of-presence pickup visible.
- HUD chip slot under the existing keys/score line: shows "EMF 1"
  through "EMF 5" as a stepwise color ramp keyed off proximity to
  nearest live enemy. Hidden when EMF flag is false.
- Distance thresholds match Phasmo's "EMF 5 = within touching
  distance" semantic: <2 tiles = 5, <4 = 4, <8 = 3, <16 = 2, else 1
  (when any enemy exists on map).
- Unit test: `pickEmfReading(distance)` deterministic mapping.

Out of scope for step-1: no asset wire-in (the EMF reader is a HUD
chip, not a held weapon — the existing slasher pack doesn't need an
extra GLB for it; if/when the design wants a viewmodel, the GHT pack
extraction lands then). No new enemy class. No audio sting (a
follow-up audio commit can layer in the Phasmo-style click).

## Slice ordering

Strict dependency order — each slice exists because the previous one
revealed it, not because the long-term map dictated it. Refactors
that happen between slices are the system learning from the next use
case, not failures.

1. **EMF chip** (this PR / PB5 step-1) — proves the
   ghost-tools-as-passive-readout shape end-to-end.
2. **Asset extraction + viewmodel** — once EMF is real and people
   want a held version, extract the GHT zip and wire `useGhostTool`
   into the weapon-slot system. May require a separate weapon-slot
   "tool" lane distinct from `WeaponId`.
3. **Spirit box** — needs the audio bus + an "ambient voice" layer
   not yet present.
4. **UV flashlight** — needs a hidden-enemy variant class and the
   second-light-cone rendering pipe.
5. **Crucifix** — needs the placeable-item / debuff system; this is
   the most architecture-heavy slice and lands last.

Each subsequent slice opens its own PR. Don't pre-design slice N+1's
schema while building N.
