/**
 * E13 step-1 — procedural archetype deepening.
 *
 * Picks a `PropArchetype` per map deterministically. Step-1 only wires
 * the prop-pool axis (E3 consumes the choice); step-2+ will add
 * lighting palette, enemy mix, and SFX ambient bed per PRD §E13.
 *
 * The mapping is `ARCHETYPE_NAMES[map.seed % 5]` — five archetypes
 * cycle through every run. Same seed → same archetype across reloads.
 */

import type { BoneBusterMap } from "@engine/mapTypes";
import { cyrb128 } from "@engine/rng";
import type { PropArchetype } from "@world/scatter/propPool";

/** The archetype a given seed phrase hashes to (`cyrb128[0] % 5`). */
export function archetypeForPhrase(seedPhrase: string): PropArchetype {
	const a = ARCHETYPE_NAMES[cyrb128(seedPhrase)[0] % ARCHETYPE_NAMES.length];
	if (a === undefined) throw new RangeError("archetypeForPhrase: index out of bounds");
	return a;
}

/**
 * Canonical archetype order. The index of an archetype here IS its
 * `(seed % 5)` slot — reordering this array changes which seeds map
 * to which archetype. Order matches `docs/PRD.md §E13` for stability.
 */
export const ARCHETYPE_NAMES: readonly PropArchetype[] = [
	"corridor",
	"arena",
	"courtyard",
	"sewer",
	"library",
];

/**
 * Per-map archetype accessor. CONV3 (2026-05-15) denormalized
 * `archetype` onto the map type — this function is now a trivial
 * read kept for call-site readability. The single computation
 * lives in `buildMap`/`generateMap`/`loadRefLevel`; downstream
 * consumers MUST NOT recompute the modulus.
 */
export function pickArchetype(map: BoneBusterMap): PropArchetype {
	return map.archetype;
}

/**
 * INF3 / SEED2 — rewrite a seed PHRASE so it hashes to the named archetype.
 * Caller is the Shell URL-flag plumbing (`?bonebusterArchetype=`). Since the
 * archetype now derives from `cyrb128(phrase)[0] % 5` (not `seed % 5`), we
 * can't arithmetically rewrite the value — instead we append a numeric suffix
 * to the phrase and increment until the hash lands on the target archetype.
 * Deterministic (no RNG) and always terminates fast (each suffix is ~1/5 to
 * match). Pure function — lives here so unit tests pin it without any TSX.
 *
 * Contract: after override, `archetypeForPhrase(returned) === archetype`.
 * Unknown archetype names return the phrase unchanged.
 */
export function applyArchetypeOverride(seedPhrase: string, archetype: string | null): string {
	if (!archetype) return seedPhrase;
	const idx = ARCHETYPE_NAMES.indexOf(archetype as PropArchetype);
	if (idx < 0) return seedPhrase;
	if (cyrb128(seedPhrase)[0] % ARCHETYPE_NAMES.length === idx) return seedPhrase;
	for (let n = 1; n < 1000; n++) {
		const candidate = `${seedPhrase}-${n}`;
		if (cyrb128(candidate)[0] % ARCHETYPE_NAMES.length === idx) return candidate;
	}
	return seedPhrase; // unreachable in practice (each suffix ~1/5 chance)
}
