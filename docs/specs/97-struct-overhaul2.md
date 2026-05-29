---
title: STRUCT — OVERHAUL2 procedural/biome/upgrade architecture plan
updated: 2026-05-29
status: draft
domain: technical
---

# STRUCT — the OVERHAUL2 structural rework (PLAN, pre-build)

Binding direction: [`docs/DECISIONS.md`](../DECISIONS.md) D23 + the user-directed
OVERHAUL2 vision. This is the architecture plan for STRUCT1–STRUCT5 — written
BEFORE code per the "plan first" directive. Nothing here is committed to code
yet; it is for review.

## Current architecture (as built)

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
   pure: (seedPhrase, depth, params) → a maze skeleton (rooms/cells/graph + reachability)
   knows NOTHING about biomes, assets, enemies. Just topology + difficulty-scaled size.
        ▲
        │ each biome generator composes the core, then adds its own layer
        │
BiomeGenerator (one per biome — src/world/biomes/{corridor,arena,courtyard,sewer,library}.ts)
   (seedPhrase, depth) → BoneBusterMap
   owns: structure params fed to the core, scatter, hazards, enemy mix,
         biome-specific triggers/traps/code, fog/light palette hook.
        ▲
        │
buildMap(seedPhrase, depth) → pick biome via STRUCT5 → biomeGen(seedPhrase, depth)
   NO LevelChoice. depth = levels cleared so far (drives STRUCT3 log scaling).
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
- `src/world/biomes/<biome>.ts` each export `generate(seedPhrase, depth):
  BoneBusterMap`, calling `generateMaze` for topology then layering the biome's
  existing `getArchetypeMapShape` params + scatter (`debrisScatter`, `kitchen`,
  `nature`, …) + enemy mix + hazards. The per-archetype tables (already in
  `archetypeRegistry.ts`) become each biome generator's config.
- A `BIOMES` registry maps biome name → generator. Adding a biome = add a file +
  register it (the "add a generator → hours of play" headline).
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

## Open questions for review
- **Grid vs sector maps:** the core today is grid (`generateMap`); refLevels
  were sector. Should every biome maze be grid-based (simpler, one collision
  path), or do some biomes want sector polygons? (Recommend: grid core for all
  biomes initially — collapses two collision/render paths into one; revisit if a
  biome needs non-rectilinear space.)
- **RUN_LENGTH:** endless (no cap) per "play for hours," or a soft cap with a
  "deeper = harder" prestige? (D23 says endless; confirm no campaign-end.)
- **refLevels:** confirm they retire entirely from runtime (become docs-only
  style refs), vs keeping one as a tutorial "welcome wing".
