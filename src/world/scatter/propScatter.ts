/**
 * E3 — Decorative sector prop scatter.
 *
 * Consumer of the COV4 `propPool` asset-enabler. For each sector in
 * a sector-map, picks 2-5 prop placements via deterministic seeded
 * rejection sampling. PRD §E3 contract:
 *  - Deterministic per `(sectorId, map.seed)` — same seed → same
 *    layout across reloads.
 *  - Default-flat (player walks through them); `blocking: true` props
 *    opt into the collision system (E3 step-2 wires those into the
 *    sector collision list — out of scope for step-1's pure-data
 *    contract here).
 *  - No visible repeats within one FOV: rejection sampling enforces a
 *    minimum inter-prop distance (1.4 tiles).
 *  - Skips spawn / exit / key anchor points (4-tile clearance) so the
 *    scatter doesn't clutter critical navigation poses.
 *  - 2-5 props per sector at default density. Sectors smaller than the
 *    minimum sample area receive proportionally fewer.
 *
 * Step-1 slice (this commit): single archetype default per call site.
 * E13 will eventually pick archetypes per map; until then, callers
 * pass `"corridor"` as the all-sector default. Grid maps don't
 * scatter props in this slice — they have no sector geometry to
 * sample.
 */

import type { BoneBusterMap, Vec2 } from "@engine/engine";
import { polygonContains } from "@engine/engine";
import { forkStream } from "@engine/rng";
import type { PropArchetype, PropDef } from "@world/scatter/propPool";
import { POOLS } from "@world/scatter/propPool";
import { bboxOf, nearAny, scatterId } from "@world/scatter/sampling";

const SKIP_RADIUS = 4;
const MIN_PROP_SPACING = 1.4;
/** Hard upper bound for ID-stride invariant. Per-archetype max stays ≤ this. */
export const PROPS_PER_SECTOR_MAX = 5;
const MAX_SAMPLE_ATTEMPTS_PER_PROP = 12;

/**
 * E13 step-6 — per-archetype prop density. Closes the remaining
 * §E13 axis: each archetype reads differently because the prop
 * count per sector differs. Corridor preserves the pre-step-6
 * literal `[2, 5]` for canonical byte-stability (refLevel 0 is
 * corridor by canonical seed%5 invariant).
 *
 * Library is densest (study-hall-feel), arena sparsest (combat-
 * space-feel), sewer sparse (oppressive empty), courtyard mid,
 * corridor unchanged.
 */
const DENSITY_BY_ARCHETYPE: Readonly<Record<PropArchetype, readonly [number, number]>> = {
	corridor: [2, 5],
	arena: [1, 3],
	courtyard: [2, 4],
	sewer: [1, 3],
	library: [3, 5],
};

export interface PropInstance {
	/** Stable per-map id — `sectorId * 1000 + indexInSector`. */
	readonly id: number;
	readonly position: Vec2;
	/** Yaw rotation in radians; deterministic per-instance for variety. */
	readonly yaw: number;
	readonly prop: PropDef;
}

/**
 * Deterministic per-map prop scatter. Same seed → byte-identical
 * layout. Grid maps return [] (no sector geometry).
 *
 * The PRNG is seeded with `map.seed XOR 0x50524F50` ("PROP" tag) so
 * it diverges from lampScatter's `map.seed XOR 0x4C4D50` ("LMP") and
 * the two systems can't accidentally produce identical sequences.
 */
export function spawnProps(map: BoneBusterMap, archetype: PropArchetype): PropInstance[] {
	if (map.kind !== "sectors") return [];
	const pool = POOLS[archetype];
	if (pool.length === 0) return [];

	const out: PropInstance[] = [];
	const rng = forkStream(map.seedPhrase, "PROP");
	const skipPoints: Vec2[] = [map.playerSpawn, map.exitPosition, map.keyPosition];
	const [minPerSector, maxPerSector] = DENSITY_BY_ARCHETYPE[archetype];

	for (const sector of map.sectors) {
		if (sector.vertices.length < 3) continue;
		const { minX, maxX, minY, maxY } = bboxOf(sector.vertices);
		// Target prop count for this sector — uniform in archetype's [min, max].
		const target = minPerSector + Math.floor(rng() * (maxPerSector - minPerSector + 1));

		const placed: Vec2[] = [];
		for (let i = 0; i < target; i += 1) {
			const accepted = sampleAcceptablePoint(
				rng,
				sector.vertices,
				minX,
				maxX,
				minY,
				maxY,
				skipPoints,
				placed,
			);
			if (accepted === null) continue; // sector too crowded or too small — move on.

			placed.push(accepted);
			// Math.floor(rng()*pool.length) with rng ∈ [0,1) is provably in [0, pool.length).
			// pool.length > 0 is checked above before the sector loop.
			const prop = pool[Math.floor(rng() * pool.length)];
			if (prop === undefined) throw new RangeError("spawnProps: prop pool index out of bounds");
			const yaw = rng() * Math.PI * 2;
			out.push({
				id: scatterId(sector.id, placed.length - 1),
				position: accepted,
				yaw,
				prop,
			});
		}
	}

	return out;
}

/**
 * Sample a point inside the sector polygon that's clear of skip-anchors
 * and already-placed siblings. Returns null when all attempts fail
 * (sector too crowded or too small). Predicate extraction was a fold-
 * forward from the COV4 simplifier review.
 */
function sampleAcceptablePoint(
	rng: () => number,
	vertices: readonly Vec2[],
	minX: number,
	maxX: number,
	minY: number,
	maxY: number,
	skipPoints: readonly Vec2[],
	placed: readonly Vec2[],
): Vec2 | null {
	for (let attempt = 0; attempt < MAX_SAMPLE_ATTEMPTS_PER_PROP; attempt += 1) {
		const candidate: Vec2 = {
			x: minX + rng() * (maxX - minX),
			y: minY + rng() * (maxY - minY),
		};
		if (!polygonContains(candidate, vertices)) continue;
		if (nearAny(candidate, skipPoints, SKIP_RADIUS)) continue;
		if (nearAny(candidate, placed, MIN_PROP_SPACING)) continue;
		return candidate;
	}
	return null;
}

/** Max props per sector for id-collision safety. `PROPS_PER_SECTOR_MAX <= SCATTER_ID_STRIDE`. */
