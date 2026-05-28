/**
 * COV13 step-2 — kitchen scatter (library-archetype set dressing).
 *
 * Fires only on library-archetype maps. ~20% of library sectors are
 * tagged as "kitchen" — break-room / study-hall flavor where the
 * researchers eat. Each tagged sector gets 1-3 kitchen props sampled
 * from the COV13 pool via deterministic rejection sampling.
 *
 * Why library-only: library is the cerebral archetype; a real-world
 * library has break-room / study-hall pockets, which the kitchen
 * pool reads as. The other archetypes don't fit (corridor, sewer,
 * arena, courtyard are all "outside / underground / dangerous").
 *
 * PRNG seed: `map.seed XOR 0x4B544348` ("KTCH" tag) — diverges from
 * every other scatter sequence.
 */

import type { BoneBusterMap, Vec2 } from "@engine/engine";
import { polygonContains } from "@engine/engine";
import { forkStream } from "@engine/rng";
import { pickArchetype } from "@world/archetype";
import { KITCHEN_PROPS } from "@world/kitchen";
import { bboxOf, nearAny, scatterId } from "@world/scatter/sampling";

const KITCHEN_SECTOR_PROBABILITY = 0.2;
const PROPS_PER_SECTOR_MIN = 1;
const PROPS_PER_SECTOR_MAX = 3;
const SKIP_RADIUS = 3;
const MIN_PROP_SPACING = 1.2;
const MAX_SAMPLE_ATTEMPTS = 12;

export interface KitchenInstance {
	readonly id: number;
	readonly position: Vec2;
	readonly yaw: number;
	readonly url: string;
}

/**
 * Deterministic per-map kitchen scatter. Returns [] on non-library
 * archetypes and on grid maps. Same `map.seed` → byte-identical layout.
 */
export function spawnKitchen(map: BoneBusterMap): KitchenInstance[] {
	if (map.kind !== "sectors") return [];
	if (pickArchetype(map) !== "library") return [];
	const out: KitchenInstance[] = [];
	const rng = forkStream(map.seedPhrase, "KTCH");
	const skipPoints: Vec2[] = [map.playerSpawn, map.exitPosition, map.keyPosition];

	for (const sector of map.sectors) {
		if (sector.vertices.length < 3) continue;
		// 20% sector opt-in roll. The roll burns one RNG draw per sector
		// regardless of outcome so the rest of the per-sector sequence
		// stays in lockstep with sector iteration.
		if (rng() > KITCHEN_SECTOR_PROBABILITY) continue;

		const { minX, maxX, minY, maxY } = bboxOf(sector.vertices);
		const target =
			PROPS_PER_SECTOR_MIN + Math.floor(rng() * (PROPS_PER_SECTOR_MAX - PROPS_PER_SECTOR_MIN + 1));

		const placed: Vec2[] = [];
		for (let i = 0; i < target; i += 1) {
			let accepted: Vec2 | null = null;
			for (let attempt = 0; attempt < MAX_SAMPLE_ATTEMPTS; attempt += 1) {
				const candidate: Vec2 = {
					x: minX + rng() * (maxX - minX),
					y: minY + rng() * (maxY - minY),
				};
				if (!polygonContains(candidate, sector.vertices)) continue;
				if (nearAny(candidate, skipPoints, SKIP_RADIUS)) continue;
				if (nearAny(candidate, placed, MIN_PROP_SPACING)) continue;
				accepted = candidate;
				break;
			}
			if (accepted === null) continue;
			placed.push(accepted);
			// Math.floor(rng()*KITCHEN_PROPS.length) with rng ∈ [0,1) is provably
			// in [0, KITCHEN_PROPS.length). KITCHEN_PROPS is non-empty (it's a
			// non-empty static array) — assert to satisfy noUncheckedIndexedAccess.
			const kitchenUrl = KITCHEN_PROPS[Math.floor(rng() * KITCHEN_PROPS.length)];
			if (kitchenUrl === undefined)
				throw new RangeError("spawnKitchen: KITCHEN_PROPS index out of bounds");
			out.push({
				id: scatterId(sector.id, placed.length - 1),
				position: accepted,
				yaw: rng() * Math.PI * 2,
				url: kitchenUrl,
			});
		}
	}
	return out;
}
