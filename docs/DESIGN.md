---
title: Design
updated: 2026-05-13
status: current
domain: product
---

# OBJEXOOM — design truth

## Pitch

A polished DOOM-flavored arcade FPS that ports the structure of
[js13k2019-yet-another-doom-clone](https://github.com/xem/yetanotherdoomclone)
into modern web tech (Vite + react-three-fiber + Capacitor) and lifts
the visual presentation toward horror-tactical instead of 16-bit
arcade. OBJEXOOM was incubated inside Objexiv as an easter egg, then
extracted to its own repo once it deserved its own cadence.

## What it IS

- A standalone web game. Plays in any modern browser. No Objexiv
  backend, no auth, no network.
- A Capacitor app shell — same source compiles to Android + iOS native
  packages.
- A continuous arcade run — pick a difficulty + level, fight through
  procedurally-generated sector maps, collect keys, hit exits, advance.
- A procedural-AND-curated mix. Walls / floors / sectors / lighting
  are code; enemies / weapons / pickups / props are real GLB assets
  from the local 3DPSX library.

## What it is NOT

- Not a faithful 1:1 DOOM port. It mirrors the reference clone's
  structure (sector-portal rendering, key-and-door progression, lava
  damage, ammo + weapon swap), not literal id Software content.
- Not a multiplayer game. Single-player only.
- Not an Objexiv feature. The brand connection is deliberate
  (gradient lineage in the design tokens), but functionally and
  legally independent.
- Not a Next.js app. Vite-only. SSR was rejected; see
  [`DECISIONS.md`](./DECISIONS.md#why-vite).

## Identity

OBJEXOOM honors Objexiv visually — the indigo + violet gradient axis
is preserved — and stands on its own with new horror-tactical axes:

| Anchor | Source | Role |
| --- | --- | --- |
| `indigo[400]` `#6172f3` | inherited from Objexiv | HUD chrome, secondary accent |
| `violet[400]` `#a855f7` | inherited from Objexiv | hero accent, menu highlights |
| `amber[400]` `#f59e0b` | inherited from Objexiv | pickups, KEY ACQUIRED, fire |
| `ink[900]` `#060912` | inherited from Objexiv | world background, ambient |
| `blood[500]` `#b91c1c` | **new for OBJEXOOM** | damage flash, low-HP, enemy emissive |
| `ember[400]` `#ff7518` | **new for OBJEXOOM** | lava, going-back-strobe |

Full scales (50–950) and semantic role layer live in
[`src/design-tokens/colors.ts`](../src/design-tokens/colors.ts). The
CSS mirror is [`app/tokens.css`](../app/tokens.css). Code should
reference the semantic `ROLE.*` layer, not raw scale steps.

## Typography

- **Display face**: [Black Ops One](https://fonts.google.com/specimen/Black+Ops+One)
  — stencil-cut military horror, single weight (400). Wordmark, every
  overlay heading (MISSION COMPLETE / YOU DIED / LEVEL COMPLETE),
  menu items, HUD numerics.
- **Body face**: [Rajdhani](https://fonts.google.com/specimen/Rajdhani)
  — condensed tactical sans, five weights (300–700). HUD labels,
  difficulty descriptions, hint copy.

Both fonts are self-hosted in
[`public/assets/fonts/`](../public/assets/fonts/) (Capacitor must
work offline; CDN fetches stalled the Playwright stability gate).

## Mood targets

OBJEXOOM should feel:

- **Heavy** — dark backgrounds, weighty stencil headers, blood-red
  damage flashes
- **Tactical** — clean condensed body type, monospaced-feeling
  numerics, no decorative micro-animation
- **Quiet menus, loud combat** — the landing is restrained
  (gradient backdrop, ambient glow), the combat HUD pulses (HP pip
  flicker, kill counter spring, low-HP warning strobe)

It should NOT feel:

- 16-bit arcade
- Pixelated retro
- Cute / colorful
- Brand-deck slick

## Archetype identity

Every run picks one of five archetypes deterministically from
`(seed >>> 0) % 5`. CONV3 (2026-05-15) denormalized `archetype`
onto `ObjexoomMap` itself — every consumer reads `map.archetype`
rather than recomputing the modulus. Each archetype is keyed across
~17 independent axes; the canonical registry of axes is at
`src/archetypeRegistry.ts` (A6, Phase 21). When adding a 6th
archetype, walk that registry top-to-bottom: TypeScript will catch
the misses (every axis is `Record<PropArchetype, T>`).

| Archetype | Mood | Color stack | Density | Mechanics |
|-----------|------|-------------|---------|-----------|
| **CORRIDOR** | tight, claustrophobic | violet-indigo-ink — canonical | mid props, mid enemies | baseline; no scatter overrides |
| **ARENA** | hot combat space | ember-blood — vivid red | sparse props, dense enemies (1.4×) | combat-focused |
| **COURTYARD** | dusk outdoors | indigo-amber — cool sky/warm sun | mid props, normal enemies | nature scatter (Mega_Nature aggregate) |
| **SEWER** | damp underground | parchment-ink — sickly desaturated | mid props, normal enemies | water-as-sewage tint; traps lean dense |
| **LIBRARY** | warm study halls | amber-parchment — sepia paper | dense props (3-5), sparse enemies (0.8×) | NPCs (ambient set-dressing), kitchen scatter |

Corridor is the canonical-byte-stable anchor: it preserves every
pre-step literal so refLevel 0's canonical screenshots stay byte-
identical regardless of how many axes downstream archetypes vary.
This means new identity axes can ship indefinitely without breaking
existing visual contracts.

## References

Game-design references live locally under `references/` (gitignored).
The canonical structural reference is the js13k2019 clone — read it
to settle any "is this in scope" question about gameplay shape.

Visual / mood references for color + lighting come from id's original
DOOM, DOOM Eternal's chrome-tactical menus, and Resident Evil 4
remake's stencil-display + condensed-body type pairing.

## Brand lineage commitment

OBJEXOOM keeps Objexiv's gradient signature visible (the wordmark
gradient uses the same indigo→violet→amber stops, pushed warmer at
the right end with an ember tip). This is a **deliberate** brand
relationship — touching it requires a brand decision, not a styling
tweak. The four `LINEAGE.*` anchors in
[`src/design-tokens/colors.ts`](../src/design-tokens/colors.ts) are
the load-bearing pieces.
