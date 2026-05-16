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

import type { BoneBusterMap } from "@engine/engine";
import type { PropArchetype } from "@world/scatter/propPool";

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
 * INF3 — rewrite a seed so its `seed % 5` index lands on the named
 * archetype. Caller is the Shell URL-flag plumbing (`?bonebusterArchetype=`).
 * Pure function — lives here (not in the view layer) so unit tests
 * can pin the invariant without importing any TSX.
 *
 * Contract: after override, `(returnedSeed % 5) === ARCHETYPE_NAMES.indexOf(archetype)`
 * for every input seed. Unknown archetype names return the seed
 * unchanged.
 */
export function applyArchetypeOverride(seed: number, archetype: string | null): number {
	if (!archetype) return seed;
	const idx = ARCHETYPE_NAMES.indexOf(archetype as PropArchetype);
	if (idx < 0) return seed;
	const s = seed >>> 0;
	return ((s - (s % ARCHETYPE_NAMES.length) + idx) >>> 0) & 0xffffffff;
}
