---
title: Two-PRNG Model & the New Game Seedphrase
updated: 2026-05-28
status: current
domain: technical
---

# 96 — Two-PRNG Model & the New Game Seedphrase

Adopts the `~/src/arcade-cabinet` family PRNG architecture (reference:
`Aethelgard-Chronicles-of-Strata/src/core/{rng,seed-phrase}.ts` +
its spec 96). bone-buster previously used a single numeric `map.seed`
read from a URL flag, fed to a bespoke `mulberry32` core. This replaces
that with the family's **two-PRNG, string-phrase** model so the whole
arcade-cabinet collection shares ONE seed architecture and bone-buster
stops being a snowflake.

> **Decision (user-directed, 2026-05-28):** full rewrite to seedrandom
> streams keyed by the seed phrase — NOT a numeric bridge. This re-blesses
> the canonical screenshots and rewrites the determinism tests; that churn
> is accepted to match the family exactly.

## Use cases (step-1 enumeration)

The seed system has these distinct users / triggers:

1. **New Game (default).** Player clicks NEW GAME → modal → a suggested
   `adjective-adjective-noun` phrase is shown (drawn from the event PRNG),
   editable, with a randomize button. "Begin" starts a run on that phrase.
2. **New Game (custom phrase).** Player types/edits the phrase to reproduce
   or share a specific map. Same phrase → same map, always.
3. **Continue.** Restores the most recent save, including the phrase it was
   started with AND the event seed buried with it, so combat replays exactly.
4. **e2e / playtest harness.** `?bonebusterSeed=<phrase>` pins the map phrase
   for screenshots; the canonical anchor phrase replaces the old `seed 0`.
5. **Cosmetic / per-instance picks.** Already on `seedrandom.alea` (D19) —
   folds into the map PRNG stream cleanly.

## The two PRNGs

### Map PRNG — `createMapPrng(seedPhrase)`
- `cyrb128(seedPhrase)` → `seedrandom("<a>.<b>")` stream.
- Drives EVERYTHING procedural: archetype selection, grid carve, scatter
  (props/traps/nature/npc/kitchen/loot/debris/lamp/floor), enemy mix, level
  names, barrels. Replaces every `mulberry32(...)` call.
- Contract: **same phrase → same map**. The phrase IS the map identity.
- Per-system divergence keeps the named-tag idea: `mapPrng` is forked per
  system via a string-tagged sub-stream `forkStream(phrase, "PROP")` =
  `seedrandom(cyrb128(phrase + ":PROP"))`, so systems sharing a phrase still
  diverge (replaces the `seed ^ RNG_TAGS.X` numeric XOR).

### Event PRNG — buried in Capacitor Preferences (`eventPrngSeed`)
- `seedrandom` stream; seed string persisted in Preferences.
- First launch: minted from `crypto.getRandomValues` (the one allowed
  non-determinism — it seeds a PRNG, it isn't sim logic). Each New Game
  *advances* the buried seed (next = drawn from the current stream, written
  back), so combat/loot variance differs per session but every session is
  deterministic + replayable from its save.
- Drives: combat damage/crit rolls, loot variance, and **the seed-phrase
  randomizer** (`randomSeedPhrase(eventRng)` — picking a phrase is "just
  another event draw", so no `Math.random()` anywhere in the sim core).

### Why the split
"Same map, different fight" and "replay this exact fight on a new map" become
orthogonal axes. The phrase randomizer stops being a determinism exception.
Event seed is *device state* (Preferences), not *game state* (the phrase).

## Word lists
`adjective-adjective-noun`, lower-cased, hyphen-joined (e.g.
`crimson-sunken-spire`). Bone-buster-flavored lists (grisly/arcade-horror
tone) rather than Aethelgard's fantasy lists — see `src/engine/seedPhrase.ts`.

## The canonical anchor
The old "seed 0 = corridor" byte-stability anchor is replaced by a fixed
canonical phrase (`CANONICAL_SEED_PHRASE`) used by the screenshot suite +
the determinism tests. All golden-byte pins re-blessed against it.

## Landing / New Game modal
The existing Landing pane flow (main → difficulty → level → start) gains a
**seed** step: the New Game modal mints a fresh event seed on open, shows the
suggested phrase (editable + randomize), and passes `{ seedPhrase, eventSeed,
difficulty, ... }` up on Begin. `?bonebusterSeed=<phrase>` still overrides for
the harness. Legacy numeric `?bonebusterSeed=123` is accepted as a phrase
string (hashed the same way) so old links don't break.

## Migration / determinism
- `mulberry32` + numeric `RNG_TAGS` XOR + `seedFrom`/`taggedSeed` (CR-TS4)
  are removed; `map.seed: number` becomes `map.seedPhrase: string`.
- All 217 determinism tests rewrite to assert against the new phrase-seeded
  streams; canonical screenshots re-blessed.
- D19's dual-PRNG decision is superseded by a new DECISIONS entry pointing here.
