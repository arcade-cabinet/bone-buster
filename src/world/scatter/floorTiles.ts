/**
 * COV3 step-1 — modular asphalt floor tile scatter.
 *
 * Renders the floor surface of `useModularFloor: true` sector maps
 * with composed asphalt tile GLBs instead of the procedural shape.
 * Step-1 ships 4 PSX Mega Pack II Modular Structures asphalt variants;
 * step-2 will add walls; step-3 will add doorway cutouts.
 *
 * Strategy: tile a grid over each sector's bbox at `TILE_SIZE` spacing,
 * accept tiles whose center lies inside the sector polygon. Each tile
 * picks a variant + 90° rotation deterministically from the per-map
 * RNG seeded with `map.seed XOR 0x464C5254` ("FLRT" tag).
 *
 * Why a grid instead of rejection sampling: floors need full coverage
 * (no gaps), so a regular grid with polygon-acceptance is the right
 * shape. Props (E3) are sparse so they use rejection sampling.
 *
 * Why `TILE_SIZE = 2` tiles per world unit: matches the visible
 * texture scale of the asphalt_hr GLBs at default 1.0 scale — empirical,
 * adjust if the rendered scale looks off.
 */

import { A } from "@assets/assetUrl";
import type { BoneBusterMap, Vec2 } from "@engine/mapTypes";
import { forkStream } from "@engine/rng";
import { polygonContains } from "@engine/sectors";

export const FLOOR_TILE_VARIANTS: readonly string[] = [
	A("/assets/models/structures/asphalt_hr_1.glb"),
	A("/assets/models/structures/asphalt_hr_1_large.glb"),
	A("/assets/models/structures/asphalt_hr_2.glb"),
	A("/assets/models/structures/asphalt_hr_3.glb"),
];

const TILE_SIZE = 2.0;

export interface FloorTileInstance {
	/** Stable per-map id — `sectorId * 1000000 + gx * 1000 + gy`. */
	readonly id: number;
	readonly position: Vec2;
	readonly floorHeight: number;
	/** Index into FLOOR_TILE_VARIANTS (0..3). */
	readonly variantIndex: number;
	/** Quarter-turn rotation: 0|1|2|3 → 0/90/180/270 degrees yaw. */
	readonly rotationQuarters: 0 | 1 | 2 | 3;
}

/**
 * Deterministic per-map floor-tile scatter. Returns [] unless the map
 * is a sector-map with `useModularFloor: true`. Sector floors are
 * fully tiled (no gaps) by walking a grid over the bbox at TILE_SIZE
 * spacing and accepting tiles whose center is inside the polygon.
 */
export function spawnFloorTiles(map: BoneBusterMap): FloorTileInstance[] {
	if (map.kind !== "sectors") return [];
	if (!map.useModularFloor) return [];

	const out: FloorTileInstance[] = [];
	const rng = forkStream(map.seedPhrase, "FLRT");

	for (const sector of map.sectors) {
		if (sector.vertices.length < 3) continue;
		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;
		for (const v of sector.vertices) {
			if (v.x < minX) minX = v.x;
			if (v.x > maxX) maxX = v.x;
			if (v.y < minY) minY = v.y;
			if (v.y > maxY) maxY = v.y;
		}
		// Snap bbox to TILE_SIZE grid so tiles align across sectors that share edges.
		const startX = Math.floor(minX / TILE_SIZE) * TILE_SIZE;
		const startY = Math.floor(minY / TILE_SIZE) * TILE_SIZE;
		const cols = Math.ceil((maxX - startX) / TILE_SIZE);
		const rows = Math.ceil((maxY - startY) / TILE_SIZE);
		for (let gx = 0; gx < cols; gx += 1) {
			for (let gy = 0; gy < rows; gy += 1) {
				const cx = startX + (gx + 0.5) * TILE_SIZE;
				const cy = startY + (gy + 0.5) * TILE_SIZE;
				if (!polygonContains({ x: cx, y: cy }, sector.vertices)) continue;
				const variantIndex = Math.floor(rng() * FLOOR_TILE_VARIANTS.length);
				const rotationQuarters = Math.floor(rng() * 4) as 0 | 1 | 2 | 3;
				out.push({
					id: sector.id * 1_000_000 + gx * 1000 + gy,
					position: { x: cx, y: cy },
					floorHeight: sector.floorHeight,
					variantIndex,
					rotationQuarters,
				});
			}
		}
	}

	return out;
}

export function floorTileUrlFor(instance: FloorTileInstance): string {
	// variantIndex is set by spawnFloorTiles to Math.floor(rng()*FLOOR_TILE_VARIANTS.length)
	// which is provably in [0, length). Assert to satisfy noUncheckedIndexedAccess.
	const url = FLOOR_TILE_VARIANTS[instance.variantIndex];
	if (url === undefined)
		throw new RangeError(`floorTileUrlFor: variantIndex ${instance.variantIndex} out of bounds`);
	return url;
}
