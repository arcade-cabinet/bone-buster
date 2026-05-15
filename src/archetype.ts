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

import type { ObjexoomMap } from "./engine";
import type { PropArchetype } from "./scatter/propPool";

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
export function pickArchetype(map: ObjexoomMap): PropArchetype {
	return map.archetype;
}
