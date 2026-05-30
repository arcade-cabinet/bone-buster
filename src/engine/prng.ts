/**
 * CONV1 — single source of truth for the mulberry32 PRNG.
 *
 * Before this module existed, `mulberry32` was copy-pasted into 12
 * modules (engine, barrels, lampScatter, enemyMix, and the 9
 * scatter modules). `src/barrels.ts` carried a slight variant (`|0`
 * masking instead of `>>> 0`) that happened to produce identical
 * output for every non-negative seed the game actually uses, but was
 * a silent determinism risk under any future refactor.
 *
 * Canonical-byte-stability of the seed-0 corridor screenshots depends
 * on this exact bit-for-bit implementation staying constant. The
 * snapshot test in `bonebuster-prng.test.ts` pins the first 10 outputs
 * for each (seed, tag) pair used in production.
 */

/**
 * CR-TS4 — branded seed type. A `Seed` is a 32-bit value that has been
 * deliberately constructed as a PRNG seed (a raw map seed, or a map seed
 * XOR'd with a registered per-system tag). The brand makes it a COMPILE
 * ERROR to feed an arbitrary `number` — an entity id, a frame counter, a
 * raw-hex literal — straight into `mulberry32`: every seed must flow
 * through `seedFrom` (a raw map seed) or `taggedSeed` (map seed ⊕ tag),
 * which documents intent + keeps the determinism contract type-enforced.
 * Pairs with the raw-hex-XOR commit-gate ban.
 */
export type Seed = number & { readonly __seed: unique symbol };

/** Construct a Seed from a raw map seed (masked to unsigned 32-bit). */
export function seedFrom(mapSeed: number): Seed {
	return (mapSeed >>> 0) as number as Seed;
}

/** Construct a per-system Seed: `mapSeed ⊕ tag`, the only sanctioned mix. */
export function taggedSeed(mapSeed: number, tag: number): Seed {
	return (((mapSeed >>> 0) ^ tag) >>> 0) as number as Seed;
}

export function mulberry32(seed: Seed): () => number {
	let s = (seed as number) >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Per-system XOR tags. Mix into a map seed with `seed ^ RNG_TAGS.PROP`
 * before passing to mulberry32 so independent systems' streams diverge
 * even when they share a map seed.
 *
 * Tag values are ASCII codes packed big-endian (e.g. "PROP" → 0x50524f50).
 * Most are 4 bytes; LMP is 3 ("LMP", 0x4c4d50). Changing any value here
 * breaks canonical-byte-stability — DON'T. Always reference these named
 * constants at call sites; a raw-hex XOR is banned by the commit-gate so
 * the determinism contract keeps a single source of truth.
 */
export const RNG_TAGS = {
	/** Lamp scatter — "LMP" (3 bytes; value frozen for byte-stability) */
	LMP: 0x4c4d50,
	/** Prop scatter — "PROP" */
	PROP: 0x50524f50,
	/** Floor tiles — "FLRT" */
	FLRT: 0x464c5254,
	/** Debris scatter — "DERB" (note: legacy ordering, not "DEBR") */
	DEBR: 0x44455242,
	/** Large prop scatter — "LARP" */
	LARP: 0x4c415250,
	/** Trap scatter — "TRAP" */
	TRAP: 0x54524150,
	/** Kitchen scatter — "KTCH" */
	KTCH: 0x4b544348,
	/** Nature scatter — "NATU" */
	NATU: 0x4e415455,
	/** NPC scatter — "NPCS" */
	NPCS: 0x4e504353,
	/** Enemy mix — "ENMX" */
	ENMX: 0x454e4d58,
	/** Level names — "NAME" */
	NAME: 0x4e414d45,
} as const satisfies Record<string, number>;

export type RngTag = keyof typeof RNG_TAGS;

// D19 — cosmetic PRNG (seedrandom alea). Disjoint from the canonical stream
// above so cosmetic pools can grow without re-blessing canonical screenshots.
// See docs/DECISIONS.md §D19.

import seedrandom from "seedrandom";

// 0xc0-prefixed tag space; disjoint from canonical RNG_TAGS (top < 0x55000000).
// Append-only — changing a value breaks the cosmetic byte-stability pins.
export const COSMETIC_TAGS = {
	MELEE: 0xc04d454c,
	PISTOL: 0xc0504953,
	CHAINGUN: 0xc043484e,
	PLANT: 0xc0504c4e,
	PHONEME: 0xc0504e4d,
	// GH-TAPE — EVP cue picks. Distinct from PHONEME (spirit box) so the two
	// tools' cosmetic streams are DE-correlated: at the same capture/trigger
	// index they no longer draw the same pool offset.
	EVP: 0xc0455650,
	MISC: 0xc04d5343,
} as const;

export type CosmeticTag = keyof typeof COSMETIC_TAGS;

export function cosmeticRng(mapSeed: number, tag: number): () => number {
	return seedrandom.alea(`bb:${(mapSeed >>> 0).toString(16)}:${(tag >>> 0).toString(16)}`);
}

/**
 * Index a non-empty pool at a position the caller has proven in-bounds.
 * Centralizes the `noUncheckedIndexedAccess` guard for the two cosmetic
 * pickers below: both have already thrown on an empty pool and only index
 * with `Math.floor(rng()*len)` (rng ∈ [0,1) ⇒ index ∈ [0,len)) or `0`, so
 * the element is always present — this asserts that invariant once.
 */
function atProven<T>(pool: readonly T[], i: number): T {
	const v = pool[i];
	if (v === undefined) throw new Error(`atProven: index ${i} out of bounds (len ${pool.length})`);
	return v;
}

/** Per-instance cosmetic pick. `mapSeed === 0` → `pool[0]` (canonical baseline). */
export function pickCosmetic<T>(
	mapSeed: number,
	tag: number,
	instanceId: number,
	pool: readonly T[],
): T {
	if (pool.length === 0) throw new Error("pickCosmetic: empty pool");
	if (mapSeed === 0) return atProven(pool, 0);
	const rng = seedrandom.alea(
		`bb:${(mapSeed >>> 0).toString(16)}:${(tag >>> 0).toString(16)}:${(instanceId >>> 0).toString(16)}`,
	);
	return atProven(pool, Math.floor(rng() * pool.length));
}

/** Per-run cosmetic pick. `mapSeed === 0` → `pool[0]` (canonical baseline). */
export function pickCosmeticOnce<T>(mapSeed: number, tag: number, pool: readonly T[]): T {
	if (pool.length === 0) throw new Error("pickCosmeticOnce: empty pool");
	if (mapSeed === 0) return atProven(pool, 0);
	const rng = cosmeticRng(mapSeed, tag);
	return atProven(pool, Math.floor(rng() * pool.length));
}
