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
