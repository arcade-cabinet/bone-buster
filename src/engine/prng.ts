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

export function mulberry32(seed: number): () => number {
	let s = seed >>> 0;
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
 * Tag values are ASCII codes packed big-endian (e.g. "LMPP" → 0x4c4d5050).
 * Changing any value here breaks canonical-byte-stability — DON'T.
 */
export const RNG_TAGS = {
	/** Lamp scatter — "LMPP" */
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
} as const;

export type RngTag = keyof typeof RNG_TAGS;

// ---------------------------------------------------------------------------
// D19 — cosmetic PRNG stream (seedrandom alea).
//
// The canonical stream above is FROZEN. Adding a tag here is allowed; adding
// outputs to a cosmetic pool is allowed; growing pools NEVER touches the
// canonical stream and therefore never breaks canonical screenshots.
//
// The cosmetic stream uses seedrandom's alea variant: a 30-year-old, widely
// used PRNG with longer period + better avalanche than mulberry32 — but the
// reason for the split is isolation, not statistical quality. World-shape and
// cosmetic must be decoupled so cosmetic pools can grow without forcing a
// screenshot re-bless.
// ---------------------------------------------------------------------------

import seedrandom from "seedrandom";

/**
 * Per-system COSMETIC tags. ASCII-packed like RNG_TAGS, in a disjoint numeric
 * space so a cosmetic seed can never accidentally collide with a canonical
 * seed even when XOR-mixed. The high byte 0xc0 marks cosmetic; canonical tags
 * top out below 0x55000000.
 *
 * Append-only. Changing a tag value re-rolls every pick for that system and
 * breaks the cosmetic byte-stability pins in `bonebuster-prng-cosmetic.test.ts`.
 */
export const COSMETIC_TAGS = {
	/** Melee skin picker — "c0|MELE" */
	MELEE: 0xc04d454c,
	/** Pistol skin picker — "c0|PIST" */
	PISTOL: 0xc0504953,
	/** Chaingun skin picker — "c0|CHGN" */
	CHAINGUN: 0xc043484e,
	/** Per-instance nature plant picker — "c0|PLNT" */
	PLANT: 0xc0504c4e,
	/** Spirit-box phoneme picker — "c0|PHON" */
	PHONEME: 0xc0504e4d,
	/** Engine misc cosmetic — "c0|MISC" (legacy engine.ts:828 site) */
	MISC: 0xc04d5343,
} as const;

export type CosmeticTag = keyof typeof COSMETIC_TAGS;

/**
 * Build a cosmetic-stream PRNG bound to (mapSeed, tag). The returned function
 * yields the next uniform float in [0, 1) per call — same shape as mulberry32.
 *
 * For per-instance picks (e.g. one plant per scatter slot), call once with
 * `cosmeticRng(mapSeed, COSMETIC_TAGS.PLANT)` and reuse — OR derive a
 * per-instance pick via `pickCosmetic(mapSeed, tag, instanceId, pool)` below.
 */
export function cosmeticRng(mapSeed: number, tag: number): () => number {
	const seedString = `bb:${(mapSeed >>> 0).toString(16)}:${(tag >>> 0).toString(16)}`;
	return seedrandom.alea(seedString);
}

/**
 * Deterministic per-instance cosmetic pick from a pool.
 *
 * Replaces the three pre-D19 ad-hoc XOR-hash sites:
 *   `(seed >>> 0) ^ ((instanceId >>> 0) * 0x9e3779b1)` then `% pool.length`.
 *
 * Contract:
 * - Same `(mapSeed, tag, instanceId)` triple always returns the same pool entry.
 * - Adjacent `instanceId`s yield well-spread picks (alea's avalanche).
 * - Growing the pool changes only outputs whose new modulo result differs.
 * - **`mapSeed === 0` short-circuits to `pool[0]`** so the seed=0 canonical
 *   screenshot battery stays byte-identical regardless of how cosmetic pools
 *   are grown. This is the canonical-baseline guarantee.
 *
 * NOTE: callers wanting "same skin for the whole run, picked once per session"
 * should call `pickCosmeticOnce` — `pickCosmetic` is for per-instance scatter.
 */
export function pickCosmetic<T>(
	mapSeed: number,
	tag: number,
	instanceId: number,
	pool: readonly T[],
): T {
	if (pool.length === 0) throw new Error("pickCosmetic: empty pool");
	if (mapSeed === 0) return pool[0];
	const seedString = `bb:${(mapSeed >>> 0).toString(16)}:${(tag >>> 0).toString(16)}:${(instanceId >>> 0).toString(16)}`;
	const rng = seedrandom.alea(seedString);
	const idx = Math.floor(rng() * pool.length);
	return pool[idx];
}

/**
 * Per-run cosmetic pick. One URL per run, not per-instance.
 *
 * Used by skin pickers (melee/pistol/chaingun). `mapSeed === 0` short-circuits
 * to `pool[0]` to preserve canonical-screenshot byte-stability — the seed=0
 * machete/USP/canonical-chaingun pins still hold.
 */
export function pickCosmeticOnce<T>(mapSeed: number, tag: number, pool: readonly T[]): T {
	if (pool.length === 0) throw new Error("pickCosmeticOnce: empty pool");
	if (mapSeed === 0) return pool[0];
	const rng = cosmeticRng(mapSeed, tag);
	const idx = Math.floor(rng() * pool.length);
	return pool[idx];
}
