---
title: STRUCT — OVERHAUL2 procedural/biome/upgrade architecture
updated: 2026-05-30
status: current
domain: technical
---

# STRUCT — the OVERHAUL2 structural rework (SHIPPED, feat/overhaul2)

Binding direction: [`docs/DECISIONS.md`](../DECISIONS.md) D23 + D25 + the
user-directed OVERHAUL2 vision. STRUCT1–STRUCT5 are SHIPPED on feat/overhaul2 —
this is the as-built architecture. It began as the "plan first" spec; the
"Pre-STRUCT architecture" block immediately below is the OLD state, kept for
contrast, followed by the shipped design.

## Pre-STRUCT architecture (historical — replaced by STRUCT1-5)

```
Shell.tsx (useMemo)
  → buildMap(seedPhrase, settings.level: LevelChoice, difficulty)
       level === "procedural"  → generateMap(seedPhrase, getArchetypeMapShape(archetype))
       level === 1..5          → loadRefLevel(idx, difficulty)   ← decoded js13k ref clone
  level-to-level: advanceLevel(current: LevelChoice, clearedCount)  [runStats.ts]
       "procedural" → stays "procedural" (re-roll seed externally)
       1..5 → current+1, null after RUN_LENGTH(5)
```

Key facts the rework must respect:
- `LevelChoice = "procedural" | 1 | 2 | 3 | 4 | 5` (settings.ts) is the level
  picker + the campaign-vs-sandbox switch. The PRD/D23 says: **drop it.**
- `archetype` is `cyrb128(seedPhrase)[0] % 5` (one place: `buildMap` + re-derived
  in `generateMap`). The 5 archetypes already vary structure via
  `getArchetypeMapShape` + the per-archetype scatter/enemy-mix tables. They are
  ALREADY most of "a biome" — STRUCT2 promotes them from a shape-override into a
  full generator.
- `generateMap` (gridGen.ts) is the single grid generator (rooms + corridors +
  BFS reachability + lava + per-archetype enemy/pickup tables). RefLevels are a
  SEPARATE path (`loadRefLevel`, sector maps decoded from the clone).
- determinism: everything forks off `seedPhrase` (D21). The biome maze MUST stay
  `same phrase → same maze`. The event PRNG (device-persistent) drives variance +
  the STRUCT5 pressure roll.

## Target architecture

```
MazeGenerator (base, lowest layer — src/engine/maze/MazeGenerator.ts)
   REPRESENTATION-AGNOSTIC topology contract: (seedPhrase, depth, params, repr)
     → { regions/rooms, connectivity graph, reachability, playerSpawn, exit }
   knows NOTHING about biomes/assets/enemies. `repr` selects grid | sector | …
   (both grid `generateMap` + sector paths are first-class; collisionAny already
    routes either). New representations layer in here without touching biomes.
        ▲
        │ each biome generator composes the core with ITS representation + params
        │ so each biome FEELS unique → infinite variety
        │
BiomeGenerator (one per biome — src/world/biomes/{corridor,arena,courtyard,sewer,library}.ts)
   (seedPhrase, depth) → BoneBusterMap
   owns: representation choice + structure params, scatter, hazards, enemy mix,
         biome-specific triggers/traps/code, fog/light palette hook.
   MODELED ON its refLevel prototype (the decoded ref geometry/character is the
   design seed; refLevels are no longer a runtime level path).
        ▲
        │
buildMap(seedPhrase, depth) → pick biome via STRUCT5 → biomeGen(seedPhrase, depth)
   NO LevelChoice. depth = biomes cleared so far (drives STRUCT3 log scaling +
   the prestige milestone). Endless; death ends the run.
```

### STRUCT1 — base MazeGenerator + drop the picker
1. Extract the topology core out of `generateMap` into
   `src/engine/maze/MazeGenerator.ts`: `generateMaze(seedPhrase, { sizeTier,
   roomCount, … }) → { cells, rooms, graph, playerSpawn, exitPosition }`. Pure,
   no archetype/asset knowledge. `generateMap`'s room/corridor/BFS code moves
   here verbatim (refactor, not rewrite — every caller moves same commit).
2. Remove `LevelChoice`. `settings.level` + `LEVEL_LABEL` + the Landing level
   picker delete. `buildMap(seedPhrase, depth)`. `advanceLevel` →
   `advanceBiome` (STRUCT5). refLevels become **review STYLE references** only
   (kept in `references/`, NOT a runtime path) — `loadRefLevel` + the numeric
   branch delete.
   - **Blast radius (high):** `settings.ts`, `buildMap.ts`, `runStats.ts`
     (RUN_LENGTH/advanceLevel), `useLevelTransition.ts`, `Landing.tsx` (picker
     UI), `gameReducer`/`GameReducerCtx.settings.level`, every test referencing
     `LevelChoice`/`loadRefLevel`/`level: 1`. ~30–40 files. This is the riskiest
     step — do it as its own commit with the full test sweep.

### STRUCT2 — one generator per biome on the core

> **As-built note:** the plan below sketched a per-biome FILE
> (`src/world/biomes/<biome>.ts`). The shipped design instead uses a single
> `src/world/biomes/registry.ts` that builds every biome's default `gridBiome`
> generator from `archetypeRecord(gridBiome)` — exhaustiveness is compiler-forced
> (no missing-key cast) and adding a biome to `PropArchetype` fails to compile
> until its tables + registry entry exist. A biome that needs a BESPOKE
> representation/triggers overrides its single registry entry (the contract is the
> same). The per-file split was unnecessary while all five share the grid core.

- Each biome's `generate(seedPhrase, depth): BoneBusterGridMap` calls
  `generateGridMaze` for topology then layers the biome's `getArchetypeMapShape`
  params + scatter (`debrisScatter`, `kitchen`, `nature`, …) + enemy mix +
  hazards. The per-archetype tables become each biome generator's config.
- The `BIOMES` registry maps biome name → generator. Adding a biome = wire its
  per-archetype tables + add a registry entry (the "add a generator → hours of
  play" headline).
- Custom triggers/traps/code per biome live in its generator (e.g. sewer water
  hazard, library NPC set-dressing — already archetype-gated, now biome-owned).

### STRUCT3 — logarithmic difficulty by depth
- `generateMaze` takes a `depth`; size/roomCount and the biome enemy
  count/tier/density scale `~log2(depth+2)`-shaped (not linear — endless play
  shouldn't explode). One pure `difficultyForDepth(depth)` helper + unit test
  pinning the curve (monotonic, sub-linear, bounded growth).

### STRUCT4 — log-scaled weapon UPGRADE tiers
- A weapon has a base + upgrade tiers (fire rate / multi-shot / spread / damage).
  Seeded drops scale with depth; the upgrade applies to the OWNED weapon. New
  `GameAction` variant (`upgradeWeapon`) — the PREP-BP2 assertNever now forces
  the reducer to handle it. HUD shows the upgrade tier. Weapon-skin GLBs already
  exist (`weapons/*-skins/*`) to visually distinguish tiers.

### STRUCT5 — weighted biome-pressure selection
- Persist per-biome `pressure` (levels-since-last-played) in the save (event-PRNG
  domain, alongside `eventPrngSeed`). On each exit: rank biomes by pressure,
  weighted pick 50/30/15/5 over the rank via the event PRNG. Never rote 1→5,
  stale biomes favored, next never predictable. Replaces `advanceLevel`'s
  `current+1`.

## Build order + risk

1. **STRUCT1 first** (extract core + drop picker) — biggest blast radius; lands
   as one commit with the full `LevelChoice` removal + test sweep. Everything
   else builds on the depth-keyed `buildMap`.
2. STRUCT2 (biome generators) — mechanical once the core exists; per-biome.
3. STRUCT3 (depth scaling) — small, pure, well-tested.
4. STRUCT5 (pressure selection) — depends on the depth-keyed flow + event PRNG.
5. STRUCT4 (weapon upgrades) — most independent; can land any time after the
   reducer variant + HUD tier display.

## Seed identity model (user, 2026-05-29) — DEPTH+PHRASE per level

Reconciles D21 ("same phrase → same map") with STRUCT5 (pressure-picked biome):

- **Phrase owns GEOMETRY.** Each level's maze geometry = `forkStream(phrase,
  "MAZE-<depth>")` → same phrase → same geometry SEQUENCE down the descent
  (depth 0, 1, 2, … each a deterministic maze). This is the D21 "shareable map
  identity," now per-depth.
- **Pressure owns the BIOME SKIN.** Which biome "wears" the depth-d geometry is a
  weighted pressure pick off the EVENT PRNG (device-persistent, per-run), NOT the
  phrase. So the same phrase yields the same geometry sequence but a different
  biome skin per playthrough — replayable geometry, unpredictable biome order.
- `buildMap(seedPhrase, depth, biome)`: geometry from the phrase+depth fork; the
  biome param (pressure-picked separately) drives the biome generator's repr +
  scatter/enemy/hazard character over that geometry.
- Run state carries `depth` + a per-biome `pressure` map; persisted in the event
  domain (alongside `eventPrngSeed`). `pickBiome(pressure, eventRng)` is pure +
  unit-tested; it replaces `advanceLevel`.

## Resolved decisions (user, 2026-05-29)

- **Map core = flexible, NOT grid-only.** "Grid plus sector is the minimum" —
  the MazeGenerator core must abstract TOPOLOGY behind a flexible engine/physics
  layer so each biome can pick grid OR sector OR a future representation. The
  point is biome UNIQUENESS so the procgen builds INFINITE VARIETY — a single
  rigid grid core would make every biome feel the same. So:
  - `MazeGenerator` core defines a representation-agnostic topology contract
    (rooms/regions + a connectivity graph + reachability + spawn/exit), and the
    existing grid (`generateMap`) and sector (`SectorMapGeometry`) paths are BOTH
    first-class implementations a biome generator can request. Collision routes
    through the existing `collisionAny` dispatcher (already grid/sector-agnostic).
  - A biome generator chooses its representation (+ params) to match its FEEL:
    e.g. corridor = tight grid, sewer/cathedral = sector polygons for organic
    space. New representations layer in later without touching biomes.
- **Run length = ENDLESS + PRESTIGE.** No campaign end; log-scaled difficulty
  climbs forever. A milestone (every N biomes cleared) marks a PRESTIGE tier with
  a visible marker + reward/difficulty bump. `RUN_LENGTH`/`advanceLevel` retire;
  death ends the run; a prestige counter persists in the run/save.
- **refLevels = the biome PROTOTYPES, layered on the core.** Not a runtime level
  path and not discarded — each refLevel is the STYLE PROTOTYPE a biome generator
  is modeled on (the design source layered on top of the MazeGenerator core).
  `loadRefLevel` stops being a player-selectable level; the decoded ref geometry
  + its scatter/enemy character become the seed of the matching biome generator's
  config. (This is the earlier-established "refLevels are MODELS for archetypes.")
