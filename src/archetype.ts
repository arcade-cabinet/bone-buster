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
 * Deterministic per-map archetype pick. Uses `map.seed % 5` so the
 * same seed always yields the same archetype, and the 5 archetypes
 * appear in equal proportion across all possible seeds.
 */
export function pickArchetype(map: ObjexoomMap): PropArchetype {
	const idx = (map.seed >>> 0) % ARCHETYPE_NAMES.length;
	return ARCHETYPE_NAMES[idx];
}
