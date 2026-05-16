/**
 * E13 step-5 — per-archetype map-shape overrides for `generateMap`.
 *
 * PRD §E13 calls for each archetype to vary sector-density / size
 * range. The procedural grid generator (`generateMap`) has 3 knobs:
 *   - `minRoom` / `maxRoom` — room size range (default 3-6 tiles).
 *   - `roomTries` — how many room-placement attempts before giving
 *     up (default 90). Higher → denser map; lower → sparser.
 *
 * Corridor's entry preserves the pre-step-5 defaults (3 / 6 / 90)
 * so refLevel-0 → seed-0 → corridor-archetype maps stay byte-stable.
 * The 4 other archetypes shift these to read as structurally different
 * places:
 *
 *  - arena: 5-8 / fewer tries — sparse big rooms; open combat space.
 *  - courtyard: 3-7 / mid tries — mixed open + tight, asymmetric.
 *  - sewer: 2-5 / high tries — winding narrow with many dead-ends.
 *  - library: 3-5 / max tries — grid-like stack of smaller rooms.
 *
 * The overrides only affect procedurally-generated grid maps. RefLevel
 * sector maps (E1M1/E1M2/E1M3) go through `loadRefLevel`, not
 * `generateMap`, so their shape is untouched.
 */

import type { PropArchetype } from "@world/scatter/propPool";

export interface ArchetypeMapShape {
	readonly minRoom: number;
	readonly maxRoom: number;
	readonly roomTries: number;
}

export const ARCHETYPE_MAP_SHAPES: Readonly<Record<PropArchetype, ArchetypeMapShape>> = {
	// Pre-step-5 defaults — preserves canonical procedural seed-0 maps.
	corridor: { minRoom: 3, maxRoom: 6, roomTries: 90 },
	// Sparse big rooms for combat. Fewer tries → fewer rooms place,
	// leaving more wide-open areas.
	arena: { minRoom: 5, maxRoom: 8, roomTries: 50 },
	// Mixed range. Some big sociable rooms, some tight nooks.
	courtyard: { minRoom: 3, maxRoom: 7, roomTries: 75 },
	// Narrow tight rooms with many tries → maximum density of small
	// rooms + the corridor-carving phase produces winding passages.
	sewer: { minRoom: 2, maxRoom: 5, roomTries: 120 },
	// Grid-like — uniform smaller rooms, max tries to pack them in.
	library: { minRoom: 3, maxRoom: 5, roomTries: 130 },
};

export function getArchetypeMapShape(archetype: PropArchetype): ArchetypeMapShape {
	return ARCHETYPE_MAP_SHAPES[archetype];
}
