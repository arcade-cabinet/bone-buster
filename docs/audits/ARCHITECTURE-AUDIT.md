---
title: Architecture Review
updated: 2026-05-15
status: current
domain: technical
---

# Architecture review — objexoom

Scope: full repo as of `main` (post-Phase 20 release). Reviewer
mandate: be specific, cite file:line, no rewrites, no patterns from
foreign domains.

Reading list cross-checked: `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md` D1-D14, `docs/SLOT-ARCHITECTURE.md`,
`docs/DESIGN.md` §"Archetype identity", `docs/PRD.md` §E13,
`docs/POL24-DECISION.md`, `.agent-state/directive.md` Phase 20.

---

## 1. Architectural strengths

Specifics, not flattery.

### 1.1 Sim purity is real and held

`docs/ARCHITECTURE.md` §"Sim purity" is not aspirational — it is
verified. `src/engine.ts`, `src/buildMap.ts`, `src/enemyAi.ts`,
`src/turtle.ts`, `src/refLevel.ts`, `src/runStats.ts`, `src/settings.ts`,
`src/weapons.ts` all grep clean against `Math.random|performance.now|Date.now`
AND against `import .* (three|@react-three|react)`. The only foreign
runtime in the sim layer is `yuka`, and the integration adapter at
`src/yukaIntegration.ts:1-30` documents this is a deliberate
"hand-rolled FSM stays; per-frame math routes through yuka helpers"
shim per Y1/Y3/Y8. `src/engine.ts:780` imports `yukaProjectileStep`
with an explicit comment that the import is the only yuka leak into
engine. This is the kind of self-aware doctrine line you only get
when the rule has been actively defended.

### 1.2 Archetype canonical-byte-stability invariant is load-bearing and respected

DESIGN.md §"Archetype identity" pins `corridor` as the canonical
anchor for `(seed >>> 0) % 5 = 0`. Every per-archetype table I
inspected preserves the pre-step literal in the corridor entry with
an explicit comment:

- `src/archetypeMapShape.ts:35` — "Pre-step-5 defaults — preserves canonical procedural seed-0 maps."
- `src/lighting/archetypePalette.ts:9-13` — "the 'corridor' entry uses the literal colors that ObjexoomScene had before this module shipped".
- `src/structures.ts:31-36` — "Corridor pool — frozen step-2 contract. Do not reorder."
- `src/enemyMix.ts:40` — `corridor: PASS_THROUGH` sentinel (not a literal mix table — the no-op preserves the pre-mix counts).

The pattern is consistent enough that the e2e screenshot suite at
seed 0 stays byte-stable across N archetype-axis additions. This is
the single most important architectural property in the repo and it
holds.

### 1.3 Typed event bus (ARCH1a + D13)

`src/events.ts:229-256` declares `ObjexoomEvent` as a tagged union;
`dispatch<E extends ObjexoomEvent>` and `addObjexoomListener<K
extends ObjexoomEventType>` make payload mistakes a compile error.
D13 (DECISIONS.md) is a textbook example of doing the right
architectural call: ARCH1 was originally framed as "convert window
events to ref callbacks"; use-case enumeration showed broadcast IS
the right shape because the producer/consumer topology is sibling /
aunt-nephew, not parent-child. Pattern kept, typing landed. Same win,
zero coupling churn.

### 1.4 Slot architecture is documented + adopted

`docs/SLOT-ARCHITECTURE.md` is the cleanest spec doc in the repo.
The four slot kinds (HUD overlay, postprocessing effect,
per-entity feedback, audio channel) are each named with a reference
implementation. New work conforms — `BossBanner.tsx`,
`SecretFoundFlash.tsx`, `PickupChip.tsx`, `EnemyHitFlash.tsx`,
`HitChromaticAberration.tsx`, `WeaponSwapDip.tsx` all match. The
PROP-vs-EVENT trigger guidance for slots whose subtree mounts after
the trigger (ARCHITECTURE.md §"Slot trigger choice") is a
non-obvious gotcha and the right place to document it.

### 1.5 AudioBus channel-per-synth (D-AUDIO1)

`src/audioBus.ts:30-65` solved a real recurring bug class: Tone.js's
per-synth "Start time must be strictly greater than previous" check
was tripping when two cues shared a synth (pickupSynth +
secretFoundSynth, boomSynth across three death cues). The decision
to key channels by SYNTH INSTANCE not by CUE is the kind of fix that
only happens after you've debugged the symptom — and the
inline-documented synth-to-cue map (audioBus.ts:43-65) is the
audit trail that prevents regression.

### 1.6 Scatter directory is uniformly pure data

`src/scatter/*.ts` (11 files, 1655 LOC) all grep clean against
`three|@react-three|react` imports. Each module exports a
`spawnFoo(map, ...) → FooInstance[]` shape, consumed by a paired
`<FooField>` r3f component under `src/scene/entities/`. The contract
("scatter produces data; entity renders it") is consistently applied
across 11 instances. This is rare.

---

## 2. Architectural debt — top 5

Ranked by current pain × growth rate.

### 2.1 `ObjexoomShell.tsx` (1129 LOC) and `ObjexoomScene.tsx` (1046 LOC) own too many distinct responsibilities

`docs/ARCHITECTURE.md` line 71 already flags this:
*"`ObjexoomScene.tsx` ... flagged for decomposition; see DECISIONS"* —
but DECISIONS.md has no D-entry for it, so the call has slipped.

`ObjexoomShell.tsx` is currently:
- App-level state machine (status: landing/playing/paused/dead/transitioning/won) — `src/ObjexoomShell.tsx:67-72`
- Level transition orchestration (going_back / level-complete / advance) — embedded in `onWin` + `onReachSpawn` callbacks at lines 448, 479
- Run history persistence boundary — calls `openRunHistory`, `saveSettings`
- Audio lifecycle (music start/stop/mood) — imports 16 functions from sfx.ts (head shows 16 distinct imports at lines 35-49)
- Debug-hook attachment for `window.__objexoom`
- All four `GameRef` callbacks (onHit/onKill/onPickupKey/onWin/onReachSpawn/onSpendAmmo/onCollectPickup at 119-127)
- Touch + landing UI conditional rendering

`ObjexoomScene.tsx` is similarly braided: r3f Canvas content, plus
all the spawn-time scatter wiring (lines 33-65 are scatter imports),
plus the fire-handler effect (783-812), plus the pickup overlap
loop (561-583), plus debug-listener wiring (639-712). The ARCH2a/2b
extractions to `src/scene/hooks/{enemyTickLoop,fireResolution}.ts`
are good — they show the pattern works — but only 2 of ~6 extractable
behaviors have moved.

**Drift from spec:** ARCHITECTURE.md line 71 admits the violation
exists. No DECISION supersedes it. This is the largest active piece
of unowned debt in the codebase.

**Surgical first commit:** extract `useGameRef(state, dispatch, runHistoryRef)`
hook from ObjexoomShell.tsx lines 378-525 to
`src/scene/hooks/useGameRef.ts`. That's the `GameRef` builder with all
7 callbacks. Result: Shell still owns the state, but the
callback construction (which references `playPickup`, `setMusicMood`,
`runStatsReducer`, etc.) moves to a hook that can be unit-tested
without rendering the Shell. ~150 LOC moves. No behavior change.

### 2.2 The `(seed >>> 0) % 5` archetype dispatch is inlined in too many places

DESIGN.md §"Archetype identity" pins this as load-bearing. Today
it's recomputed at every consumer:

- `src/engine.ts:378` — `const archetypeIdx = (seed >>> 0) % 5;`
- `src/buildMap.ts:26` — `ARCHETYPE_NAMES[(seed >>> 0) % ARCHETYPE_NAMES.length]`
- `src/archetype.ts:39` — `pickArchetype(map)` is the official helper
- Per-scatter modules each call `pickArchetype(map)` independently —
  `src/scatter/debrisScatter.ts:65`, `floorTiles.ts:69`,
  `kitchenScatter.ts`, etc. all recompute it.

The risk surface here is small (the function is one line) but the
shape is wrong: the archetype is a per-map property that's computed
once and then queried N times. Today it's recomputed N times.

**Forward risk:** when a 6th archetype lands (see §6), every inline
`% 5` must be found and updated. Today that's `git grep '% 5'` — but
the modulus is also where archetype-override (`?objexoomArchetype`)
should weight (it currently goes through `applyArchetypeOverride` at
the seed level — a separate path that wraps the canonical dispatch).

**Surgical first commit:** add `archetype: PropArchetype` to the
`ObjexoomMap` type at `src/engine.ts:53` (next to `seed: number`).
`buildMap.ts` populates it once via `pickArchetype`. Every downstream
consumer reads `map.archetype` and `pickArchetype(map)` becomes a
trivial accessor. `% 5` is referenced once, in `buildMap`. ~30 LOC
delta; the byte-stability proof stays intact (corridor still maps to
seed 0).

### 2.3 `mulberry32` is reimplemented in 12 modules

Files with their own copy: `engine.ts:152`, `lampScatter.ts:59`,
`enemyMix.ts:101`, `barrels.ts:189`, `scatter/npcScatter.ts:44`,
`scatter/floorTiles.ts:47`, `scatter/largePropScatter.ts:54`,
`scatter/natureScatter.ts:42`, `scatter/kitchenScatter.ts:38`,
`scatter/trapScatter.ts:57`, `scatter/propScatter.ts:66`,
`scatter/debrisScatter.ts:51`.

CLAUDE.md profile mandates a `createRng(seed)` facade (arcade-game
profile, `ban_patterns` Math.random rule). The PRNG itself is fine
(canonical-byte-stability depends on it staying bit-for-bit
identical), but having 12 copies is a future foot-gun: any one of
them could acquire a subtle bug under a refactor and break canonical
screenshots for the modules using THAT copy while others stay
green. Worse, the per-system XOR tags (LMP/PROP/FLRT/DEBR/etc) are
hardcoded inline next to each copy with no central registry.

**Surgical first commit:** add `src/prng.ts` exporting
`mulberry32(seed: number)` and an XOR_TAGS readonly registry
(`LMP: 0x4C4D5050`, `PROP: 0x50524F50`, ...) keyed by `RngTag`
union. Each consumer imports `mulberry32` + the named tag. Delete
the 11 duplicated function bodies. Tests pin byte-stability — same
output for same seed × tag. ~50 LOC delete, ~30 LOC add. Zero
behavior change by construction.

### 2.4 Per-archetype tables are 10+ scattered `Record<PropArchetype, …>` literals

The five-archetype dispatch table is duplicated as a `Record<…>`
structure at minimum 10 sites:

- `src/scatter/debrisScatter.ts:37-41` (density tuple)
- `src/scatter/decalScatter.ts:32-36` (multiplier)
- `src/scatter/largePropScatter.ts:39-43` (density tuple)
- `src/scatter/propPool.ts:182-244` (prop pools)
- `src/scatter/propScatter.ts:50-54` (density tuple)
- `src/scatter/trapScatter.ts:47-51` (density tuple)
- `src/lighting/archetypePalette.ts:114-208` (palette config)
- `src/floorTextures.ts:39-58` (texture sets)
- `src/decals.ts:61-65` (variant pools)
- `src/structures.ts:69-73` (wall pools)
- `src/enemyMix.ts:40-44` (mix table)
- `src/sfx.ts:516-520` (ambient pitch/volume)
- `src/archetypeMapShape.ts:35-44` (gen shape)

Each one passes the type-check independently. None of them know
about each other. The ARCH-design question — "what is the full
archetype-axis surface and where do we add a new archetype?" — has
no single answer; you discover it via grep.

This is not a bug today (every consumer is keyed by `PropArchetype`,
so TypeScript catches missing keys when adding `library`). It IS a
forward-looking risk (§6) — adding a 6th archetype means N
separate edits to N independently-typed records, every one of
which must be discovered by hand.

**Spec drift signal:** DESIGN.md §"Archetype identity" describes
archetypes as "keyed across 16+ axes" but lists no central
registry of axes. The 16+ axes ARE the records above (plus a few
I haven't enumerated). The doc treats the axis count as a value to
celebrate; the code treats each axis as an isolated decision.

**Surgical first commit:** create `src/archetype/registry.ts` that
imports every archetype-keyed table and re-exports an aggregate
`ArchetypeAxis` interface listing each axis name + module owner.
Doesn't move the data — just enumerates the surface. Then update
DESIGN.md to link to the registry. When a 6th archetype lands, this
file is the checklist. ~40 LOC. (Bigger refactor — collapsing the
records into one `ARCHETYPES[name]` mega-table — is feasible but
would need to preserve the canonical-byte-stability proofs at each
of the 10 sites, which is a much larger commit. Start with the
registry; do the collapse later if cross-axis coupling actually
develops.)

### 2.5 Sim/render boundary is mostly clean BUT the GameRef callback surface is bloated

`GameRef` at `src/ObjexoomShell.tsx:119-127` has 7 callbacks:

```
onHit(damage)
onKill()
onPickupKey()
onWin()
onReachSpawn()
onSpendAmmo(weapon, amount)
onCollectPickup(kind)
```

This is a god-interface — every gameplay event the Scene needs to
report up goes through one ref. The shape is "Scene wants to mutate
Shell state; Shell exposes a callback per mutation." Two problems:

1. Many of these callbacks are already paired with an event
   dispatch — `onPickupKey` AND `dispatch({type: "keyPickedUp"})`
   AND `dispatch({type: "burst", kind: "pickup"})` all fire from
   `src/ObjexoomScene.tsx:818-823`. The bus is the authoritative
   feed; the callback exists because Shell holds state the bus
   can't directly mutate.
2. The growth pattern: every new gameplay event adds a callback.
   POL32 (run-duration) likely added another. Adding boss-type
   variation (see §6c) will add `onBossDefeated`, `onBossPhaseChange`.

**Drift from spec:** ARCHITECTURE.md does not describe `GameRef`'s
shape or growth rule. It mentions the callback in passing
("`gameRef.current.onHit(damage)` → sets `hp` in state"). There's no
guidance for when to add a callback vs add an event vs both.

**Surgical first commit:** add D-RPC1 to DECISIONS.md naming the
rule:
- Event = renderer/UI broadcasts (multi-consumer, fire-and-forget).
- GameRef callback = sim asks Shell to mutate canonical state
  (single-consumer, exists because Shell holds the reducer).
- The two ARE allowed to coexist for one event (pickup is the
  cleanest example: dispatch the visual burst event, plus call
  Shell to update HP/ammo).

Then audit the 7 callbacks: any that DON'T mutate Shell state
(onSpendAmmo maybe?) should fold into events.

---

## 3. Boundary violations — sim/render/UI leaks

The hard ones to find. Sim files are clean. Where I did find drift:

### 3.1 `src/engine.ts:780` — yuka import inside the sim module

```ts
import { yukaProjectileStep } from "./yukaIntegration";
```

`yukaIntegration.ts` imports `* as Yuka from "yuka"` at line 26. So
`engine.ts` transitively pulls in the yuka runtime. The comment at
780-781 acknowledges this and frames it as deliberate ("Imported as
a value (only used by stepEnemyBullet) so engine.ts itself stays
free of yuka imports") — but the import IS in engine.ts. The
mitigation is weak: engine has the import, the runtime is paid for,
the type leak is contained.

Verdict: not a blocker; the projectile step is genuinely a domain
borrow from yuka.Projectile.update math. But the doc-string lies
slightly. Either rewrite the comment to admit "engine depends on
yuka at runtime through this one helper" or move
`stepEnemyBullet` out of engine.ts into yukaIntegration.ts.

### 3.2 `src/scene/viewmodel/WeaponViewmodel.tsx:1-12` — viewmodel imports from sim siblings

```ts
import { MELEE_SKIN_URLS, pickMeleeSkin } from "../../meleeSkins";
import { WEAPON_MODELS } from "../../models";
import { WEAPONS, type WeaponId } from "../../weapons";
```

These are root-level modules. The viewmodel is correctly importing
asset registries (models.ts) and the weapon registry (weapons.ts);
that's not a boundary leak. BUT `meleeSkins.ts` (1551 LOC) imports
nothing dangerous itself, so it's pure data.

`models.ts` (12305 chars) is a renderer-side registry that lives at
the root rather than under `src/scene/`. ARCHITECTURE.md classifies
it under "Rendering layer" (line 73) but its path doesn't match.
Cosmetic only — should move to `src/scene/models.ts` to match its
layer in the doc.

### 3.3 No actual sim→render leaks found

`grep -nE 'Vector3|Quaternion|Object3D|Mesh|Material|THREE\.' src/engine.ts src/enemyAi.ts src/buildMap.ts src/turtle.ts` returns
zero hits. This is genuinely held.

### 3.4 UI components reaching into sim is bidirectional and intentional

`src/ObjexoomHUD.tsx`, `src/hud/overlays/*.tsx` all import from
`./events` (listen for dispatched events) and from `./settings` (type
imports only) — that's the documented seam. No issues found.

---

## 4. Missing abstractions (pattern reimplemented 3+ times)

### 4.1 `mulberry32` — 12 copies (covered in §2.3)

### 4.2 `Record<PropArchetype, T>` density tuple — 5+ copies

Same shape across `debrisScatter`, `largePropScatter`, `propScatter`,
`trapScatter`, etc.: `Record<PropArchetype, [min: number, max: number]>`
with a `pickInt(rng, [min, max])` inline somewhere in the spawn
function. Lift to `src/scatter/util.ts` exporting
`pickArchetypeRange<T>(table: Record<PropArchetype, [number, number]>,
archetype, rng): number`. ~5 LOC each call site shrinks.

### 4.3 Scatter spawn function signature — 11 copies

Every `src/scatter/*.ts` exports `spawnFoo(map: ObjexoomMap): FooInstance[]`
with the same boilerplate: seed RNG with XOR tag, iterate sectors,
per-sector pick count via archetype range, push instances. A
`buildSectorScatter<T>({tag, archetypeRange, place})` generic would
cover 7-8 of them. The other 3-4 have enough custom logic
(traps need disarm-state, NPCs have library-only check) to stay
bespoke.

Not urgent — each module is small (76-252 LOC) and reads cleanly.
File the abstraction when adding the 12th scatter system. Until
then, the duplication IS readable.

### 4.4 Slot trigger boilerplate

Every HUD overlay slot follows the same `useState(activeKey) +
useEffect(addObjexoomListener) + AnimatePresence` pattern. Already
documented in SLOT-ARCHITECTURE.md §1. A `useSlotTrigger<K extends
ObjexoomEventType>(kind)` hook returning `{activeKey, payload}`
would collapse the boilerplate from ~10 LOC to ~3. But the boilerplate
also reads as documentation when grepping. Leave it.

---

## 5. Over-abstractions (indirection without payoff)

### 5.1 `pickArchetype(map)` wraps `(seed >>> 0) % 5`

Documented (§2.2). The function is correct but the consumers ignore
it. If `map.archetype` is denormalized onto the map type, the
function disappears entirely. The indirection currently buys zero
because consumers compute the modulus inline anyway OR call the
helper redundantly.

### 5.2 Design tokens `LINEAGE → SCALE → ROLE` 3-layer indirection

D7 in DECISIONS.md justifies this. The justification holds for code
that touches token-driven colors. But the `LINEAGE` layer (4
anchors) is consulted by zero application files — it's only consumed
by `SCALE` itself in `design-tokens/colors.ts`. So the chain is
effectively `SCALE → ROLE → component` with a `LINEAGE` constant pinned
upstream as a brand contract. That's correct and minimal; my flag is
just to make sure the `LINEAGE` layer doesn't grow consumers it
doesn't need.

### 5.3 Nothing else egregious

Most of the abstractions in the repo earn their keep. Audio bus
(§1.5), slot pattern (§1.4), and the scatter/render split (§1.6) all
shipped at the right granularity.

---

## 6. Forward-looking risks

### 6.1 Adding a 6th archetype

**Bottleneck:** the 10+ `Record<PropArchetype, …>` literals enumerated
in §2.4.

**Failure mode:** TypeScript will yell at every site, which is good.
But there's no central checklist of axes (DESIGN.md says "16+";
nobody knows the exact list). Adding the 6th archetype today means
following compile errors round-trip until they stop, with no
guarantee the LAST file (likely `src/sfx.ts:516` ambient pitch table,
which falls back to `corridor` if you forget) is touched correctly.

**Pre-emptive fix:** §2.4's archetype registry.

### 6.2 Multiplayer

**Bottleneck:** the entire `GameRef` orchestration (`src/ObjexoomShell.tsx:119-127`)
is single-player by construction. `GameState` is one HP, one ammo
record, one weapon. Everything keyed off "the player" assumes one
player. `?objexoomDebug` exposes `teleport(x, y)` with no player
identity.

**Failure mode:** multiplayer is not a refactor — it's a different
architecture. The sim layer is mostly portable (engine.ts works on
abstract positions), but the seam between sim and Shell would need
to flip from "Shell owns state, Scene tells Shell via callbacks" to
"server owns state, Scene + Shell are both views."

**D-MULTIPLAYER1 question to settle now (before it matters):** is
multiplayer a goal? DESIGN.md §"What it is NOT" line 32 explicitly
says no. If that stays no, the GameRef shape is fine. If it flips
yes, plan to rebuild the Shell-Scene seam from the bus event surface
+ a state stream, NOT from the callback surface.

### 6.3 A 2nd boss type

**Bottleneck:** `BOSS_HP_MULTIPLIER`, `BOSS_VISUAL_SCALE`, `tier === "boss"`
are constants + a literal-string discriminant in `src/engine.ts:600-655`.
The boss-vs-mob distinction is binary. Adding a 2nd boss type (e.g.
`miniboss` between mob and boss; or `bossPhase2` for multi-phase
fights) means:

- New `tier` variant (engine.ts:655 is a single conditional spread).
- New HP multiplier table (constants need to become a record).
- New audio cue (audioBus channels at `bossDeath` are currently 1
  channel feeding `bossDeath` — adding `miniBossDeath` is fine).
- New visual scale entry.
- New event types `bossSpotted`/`bossDefeated` are tied to "the boss"
  (singular).

Files touched: `src/engine.ts`, `src/events.ts`, `src/audioBus.ts`,
`src/sfx.ts`, `src/scene/entities/EnemyMesh.tsx`,
`src/scene/entities/EnemyHitFlash.tsx`,
`src/scene/hooks/{enemyTickLoop,fireResolution}.ts`,
`src/hud/overlays/BossBanner.tsx`. ~8 files.

The boss system is small enough today that a second type IS the
right time to extract a `BOSS_TABLE: Record<BossKind, BossConfig>`
in engine.ts. Don't do it now (YAGNI); do it the day boss type 2
is committed.

### 6.4 A non-procedural curated level

**Bottleneck:** `src/buildMap.ts:14-30` is binary — either
`level === "procedural"` (call `generateMap`) or numeric 1-5 (call
`loadRefLevel`). `loadRefLevel` decodes the js13k reference's
turtle-graphics format. There is no slot for a hand-authored map.

A curated level would need:
- A new `LevelChoice` variant (`settings.ts` enum).
- A new loader in `buildMap.ts` for the curated format (Tiled JSON?
  Custom?).
- The curated format needs to produce an `ObjexoomMap` (grid or
  sector); the type union supports both.
- Critically: every `pickArchetype(map)` call assumes the map's
  archetype is `seed % 5`. A curated level has no meaningful seed —
  the archetype must come from the curated metadata. Today no
  consumer would know to read it from anywhere else.

**Pre-emptive fix:** §2.2's `map.archetype` denormalization. With
that in place, `buildMap` is responsible for assigning archetype
(from seed for procedural; from authoring metadata for curated; from
RefLevel default for ref) and every consumer reads `map.archetype`
without caring how it was decided.

---

## 7. Spec-vs-code drift

### 7.1 ARCHITECTURE.md line 71 says ObjexoomScene is "flagged for decomposition; see DECISIONS"

There is no DECISIONS entry for this. Either add D-SCENE-DECOMP
recording the call (and reference §2.1 of this audit), or strike the
parenthetical and acknowledge the file is the right size for its
job (it isn't).

### 7.2 ARCHITECTURE.md "Pure-TS simulation" table at line 55 doesn't list every sim file

The table lists `engine.ts`, `buildMap.ts`, `turtle.ts`, `enemyAi.ts`,
`yukaIntegration.ts`, `runStats.ts`, `settings.ts`, `weapons.ts`,
`refLevel.ts`. Missing: `barrels.ts` (which barrels-imports-pure
confirms is pure-sim; the doc comment self-identifies as such),
`doors.ts`, `traps.ts`, `secrets.ts`, `decals.ts`, `lampScatter.ts`
(scatter is pure data), `kitchen.ts`, `nature.ts`, `npcs.ts`,
`vehicles.ts`, `largeProps.ts`, `loot.ts`, `meleeSkins.ts`,
`floorTextures.ts`, `structures.ts`, `archetype.ts`,
`archetypeMapShape.ts`, `enemyMix.ts`. Plus the 11 `src/scatter/*.ts`
files.

That's ~30 pure-sim modules that don't appear in the architecture
table. The doc is correct about purity but undercounts the surface
~3×. New devs reading it will believe sim is a tighter zone than it
is.

**Fix:** ARCHITECTURE.md should describe the sim layer as a
folder-structure-defined zone ("everything not under `src/scene/`,
`src/hud/`, `src/persistence/`, and not ending in `.tsx`") rather
than as a hand-curated module list that drifts.

### 7.3 ARCHITECTURE.md doesn't mention `src/scene/hooks/`

ARCH2a/2b extracted `enemyTickLoop.ts` and `fireResolution.ts` to
`src/scene/hooks/`. ARCHITECTURE.md's "Rendering layer" table at
lines 67-75 doesn't acknowledge them. Add an entry.

### 7.4 SLOT-ARCHITECTURE.md §"Migration order" item 4 is stale

> "AudioBus refactor — last, biggest. Refactor sfx.ts from 25 free
> functions + 15 global timers into one bus with named channels."

Audio bus is shipped (`src/audioBus.ts` exists). sfx.ts:2 imports
`fire` from audioBus. The migration described in item 4 ran. Strike
the §"Migration order" or mark it complete.

### 7.5 DECISIONS.md has no entry for AudioBus / ARCH2 / ARCH3

`src/audioBus.ts:4` references "AUDIO1 (see docs/SLOT-ARCHITECTURE.md
§4)". SLOT-ARCHITECTURE.md §4 describes the pattern but is not a
binding decision. DECISIONS.md D1-D14 covers tooling/branching/PWA
but skips the most important runtime architecture decisions:
- AUDIO1 — channel-per-synth.
- ARCH2 — scene-hook extraction (`enemyTickLoop`, `fireResolution`).
- ARCH3 — sql.js removal (Phase 20).
- The persistence stack (`@capacitor-community/sqlite` + jeep-sqlite
  + `@capacitor/preferences`) is documented in ARCHITECTURE.md §"Persistence
  layer" but with no DECISIONS entry recording why.

DECISIONS.md is the audit trail; without entries for these, the
"why" disappears when SLOT-ARCHITECTURE.md gets refactored or
ARCHITECTURE.md's persistence section gets edited.

**Fix:** add D15 (AUDIO1), D16 (ARCH2), D17 (ARCH3), D18 (persistence
stack). Backfill, one paragraph each, citing PRs.

### 7.6 DESIGN.md §"Archetype identity" doesn't name `corridor: PASS_THROUGH`

The literal-preservation pattern is documented for `archetypeMapShape`,
`archetypePalette`, `structures` (all with explicit corridor-anchor
comments). `enemyMix.ts:40` uses a `PASS_THROUGH` sentinel — a
different shape of the same invariant. DESIGN.md describes corridor
as "the canonical-byte-stable anchor" but doesn't tell the next
contributor what to type when they add the 16th-axis table. Document
the two patterns explicitly:

- **Literal-preservation:** corridor entry IS the pre-axis literal.
- **Sentinel:** corridor entry is `PASS_THROUGH` and the consumer
  branches on it.

Either is fine; consistency is the win.

---

## 8. What I'd ship first

In order, top three commits if I had this week:

1. **§2.3** — collapse the 12 `mulberry32` copies into `src/prng.ts`. ~80 LOC delta. Pure mechanical refactor. Tests pin byte-stability.
2. **§2.2** — denormalize `archetype: PropArchetype` onto `ObjexoomMap`. ~30 LOC. Unblocks §6.1 (6th archetype) and §6.4 (curated level).
3. **§7.5** — add D15/D16/D17/D18 to DECISIONS.md. Doc-only commit. Restores the audit trail.

After those, §2.1 (Shell/Scene decomposition) is the biggest piece
of pending architectural work. Start with `useGameRef` extraction.

---

## Cross-references

- `docs/ARCHITECTURE.md` §"Critical contracts" — sim purity, refs over state, slot pattern
- `docs/DECISIONS.md` D1–D14 — all binding decisions
- `docs/SLOT-ARCHITECTURE.md` — slot inventory + migration order
- `docs/DESIGN.md` §"Archetype identity" — 5-archetype invariant
- `docs/PRD.md` §E13 — archetype deepening source spec
- `.agent-state/directive.md` Phase 20 — recent shipped work (ARCH3, CHAR1, perf gate)
