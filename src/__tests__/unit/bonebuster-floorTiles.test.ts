/**
 * COV3 step-1 — modular asphalt floor tile contract.
 *
 * Pins the gating + scatter algorithm:
 *  - refLevel 0 (useModularFloor: true) gets tiles; refLevels 1+2 don't.
 *  - Same seed → byte-identical layout (determinism).
 *  - Every tile center is inside its sector polygon.
 *  - Tile variants + rotations span the available range.
 *  - Grid maps return [].
 */

import type { BoneBusterGridMap, BoneBusterMap } from "@engine/mapTypes";
import { polygonContains } from "@engine/sectors";
import { loadRefLevel } from "@world/refLevel";
import { FLOOR_TILE_VARIANTS, floorTileUrlFor, spawnFloorTiles } from "@world/scatter/floorTiles";
import { describe, expect, it } from "vitest";

function makeGridMap(): BoneBusterGridMap {
	return {
		kind: "grid",
		seed: 1,
		width: 1,
		height: 1,
		cells: [["empty"]],
		doorCell: { gx: 0, gy: 0 },
		rooms: [],
		playerSpawn: { x: 0, y: 0 },
		playerYaw: 0,
		enemySpawns: [],
		pickupSpawns: [],
		keyPosition: { x: 0, y: 0 },
		exitPosition: { x: 0, y: 0 },
	} as unknown as BoneBusterGridMap;
}

describe("COV3 — floor tile variant pool", () => {
	it("ships 4 asphalt variants", () => {
		expect(FLOOR_TILE_VARIANTS).toHaveLength(4);
	});

	it("every variant URL resolves to /assets/models/structures/asphalt_*", () => {
		for (const url of FLOOR_TILE_VARIANTS) {
			expect(url).toMatch(/\/assets\/models\/structures\/asphalt_hr_[1-3](_large)?\.glb$/);
		}
	});

	it("floorTileUrlFor returns the variant indexed by variantIndex", () => {
		const tile = {
			id: 0,
			position: { x: 0, y: 0 },
			floorHeight: 0,
			variantIndex: 2,
			rotationQuarters: 1 as const,
		};
		expect(floorTileUrlFor(tile)).toBe(FLOOR_TILE_VARIANTS[2]);
	});
});

describe("COV3 step-1 — modular floor gating", () => {
	it("refLevel 0 (useModularFloor: true) scatters tiles", () => {
		const map = loadRefLevel(0);
		const tiles = spawnFloorTiles(map);
		expect(tiles.length).toBeGreaterThan(0);
	});

	it("refLevels 1 + 2 return [] (procedural floor stays)", () => {
		expect(spawnFloorTiles(loadRefLevel(1))).toEqual([]);
		expect(spawnFloorTiles(loadRefLevel(2))).toEqual([]);
	});

	it("grid maps return []", () => {
		const grid: BoneBusterMap = makeGridMap();
		expect(spawnFloorTiles(grid)).toEqual([]);
	});
});

describe("COV3 step-1 — floor tile scatter", () => {
	it("is deterministic — same map produces identical scatter", () => {
		const map = loadRefLevel(0);
		const a = spawnFloorTiles(map);
		const b = spawnFloorTiles(map);
		expect(a).toHaveLength(b.length);
		for (let i = 0; i < a.length; i += 1) {
			const ai = a[i];
			const bi = b[i];
			if (!ai || !bi) throw new Error(`scatter missing element at index ${i}`);
			expect(ai.id).toBe(bi.id);
			expect(ai.position.x).toBe(bi.position.x);
			expect(ai.position.y).toBe(bi.position.y);
			expect(ai.variantIndex).toBe(bi.variantIndex);
			expect(ai.rotationQuarters).toBe(bi.rotationQuarters);
		}
	});

	it("every tile center lies inside some sector's polygon", () => {
		const map = loadRefLevel(0);
		if (map.kind !== "sectors") throw new Error("expected sector map");
		const tiles = spawnFloorTiles(map);
		for (const tile of tiles) {
			let inside = false;
			for (const sector of map.sectors) {
				if (polygonContains(tile.position, sector.vertices)) {
					inside = true;
					break;
				}
			}
			expect(inside, `tile ${tile.id} not inside any sector`).toBe(true);
		}
	});

	it("variantIndex always in [0, 4)", () => {
		const tiles = spawnFloorTiles(loadRefLevel(0));
		for (const tile of tiles) {
			expect(tile.variantIndex).toBeGreaterThanOrEqual(0);
			expect(tile.variantIndex).toBeLessThan(4);
		}
	});

	it("rotationQuarters always one of 0|1|2|3", () => {
		const tiles = spawnFloorTiles(loadRefLevel(0));
		for (const tile of tiles) {
			expect([0, 1, 2, 3]).toContain(tile.rotationQuarters);
		}
	});

	it("uses ≥2 distinct variants across the whole scatter (not stuck on one tile)", () => {
		const tiles = spawnFloorTiles(loadRefLevel(0));
		const variants = new Set(tiles.map((t) => t.variantIndex));
		expect(variants.size).toBeGreaterThanOrEqual(2);
	});

	it("ids are unique across the scatter", () => {
		const tiles = spawnFloorTiles(loadRefLevel(0));
		const ids = new Set(tiles.map((t) => t.id));
		expect(ids.size).toBe(tiles.length);
	});

	it("ships ≥10 tiles total — refLevel 0's spawn sector floor is meaningfully tiled", () => {
		const tiles = spawnFloorTiles(loadRefLevel(0));
		expect(tiles.length).toBeGreaterThanOrEqual(10);
	});

	it("floorHeight matches the containing sector's floorHeight", () => {
		const map = loadRefLevel(0);
		if (map.kind !== "sectors") throw new Error("expected sector map");
		const tiles = spawnFloorTiles(map);
		for (const tile of tiles) {
			for (const sector of map.sectors) {
				if (polygonContains(tile.position, sector.vertices)) {
					expect(tile.floorHeight).toBe(sector.floorHeight);
					break;
				}
			}
		}
	});
});
