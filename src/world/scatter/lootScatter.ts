/**
 * COV12 step-2 — rare loot pickup spawn.
 *
 * Exactly one loot pickup per sector map, placed at the centroid of
 * the sector FARTHEST from `playerSpawn` (mirrors the COV10 RV-wreck
 * placement so the player discovers it during exploration, not at
 * spawn). The lootKind (bottles/books/treasure) is picked
 * deterministically per `map.seed` via `pickLootKind`.
 *
 * Grid maps return null — they have no sector geometry to centroid.
 *
 * The runtime Pickup is constructed by extending the map's
 * `pickupSpawns` list with one extra entry of kind "loot" at the
 * computed position. The existing `spawnPickups` machinery (engine.ts)
 * then turns it into a Pickup with the standard mutable `collected`
 * flag.
 */

import type { BoneBusterMap, PickupSpawn, Vec2 } from "@engine/mapTypes";
import { isSectorMap } from "@engine/mapTypes";
import { cyrb128 } from "@engine/rng";
import { type LootKind, pickLootKind } from "@world/loot";

export interface LootSpawn {
	readonly position: Vec2;
	readonly lootKind: LootKind;
}

/**
 * Compute the loot spawn for a map. Returns null for grid maps and
 * for sector maps with no sectors.
 */
export function pickLootSpawn(map: BoneBusterMap): LootSpawn | null {
	if (!isSectorMap(map)) return null;
	if (map.sectors.length === 0) return null;
	// map.sectors.length > 0 at this point — index 0 is provably in-bounds.
	const sector0 = map.sectors[0];
	if (sector0 === undefined)
		throw new RangeError("pickLootSpawn: impossible — sectors non-empty but index 0 missing");
	let best = sector0;
	let bestDistSq = Number.NEGATIVE_INFINITY;
	for (const sector of map.sectors) {
		if (sector.vertices.length < 3) continue;
		let cx = 0;
		let cy = 0;
		for (const v of sector.vertices) {
			cx += v.x;
			cy += v.y;
		}
		cx /= sector.vertices.length;
		cy /= sector.vertices.length;
		const dx = cx - map.playerSpawn.x;
		const dy = cy - map.playerSpawn.y;
		const d2 = dx * dx + dy * dy;
		if (d2 > bestDistSq) {
			bestDistSq = d2;
			best = sector;
		}
	}
	let cx = 0;
	let cy = 0;
	for (const v of best.vertices) {
		cx += v.x;
		cy += v.y;
	}
	return {
		position: { x: cx / best.vertices.length, y: cy / best.vertices.length },
		lootKind: pickLootKind(cyrb128(map.seedPhrase)[2] >>> 0),
	};
}

/**
 * Convenience: return a `PickupSpawn` of kind "loot" at the computed
 * position, or null if there's no eligible spot. Callers append this to
 * the map's pickupSpawns before passing to `spawnPickups`.
 */
export function lootPickupSpawn(map: BoneBusterMap): PickupSpawn | null {
	const ls = pickLootSpawn(map);
	if (ls === null) return null;
	return { kind: "loot", position: ls.position };
}
