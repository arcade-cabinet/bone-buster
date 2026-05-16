/**
 * COV12 step-2 — loot scatter contract.
 */

import type { ObjexoomSectorMap, Vec2 } from "@engine/engine";
import { describe, expect, it } from "vitest";
import { lootPickupSpawn, pickLootSpawn } from "../../scatter/lootScatter";

function bigSquare(cx: number, cy: number, size: number): readonly Vec2[] {
	return [
		{ x: cx - size, y: cy - size },
		{ x: cx + size, y: cy - size },
		{ x: cx + size, y: cy + size },
		{ x: cx - size, y: cy + size },
	];
}

const SECTOR_FIXTURE: ObjexoomSectorMap = {
	kind: "sectors",
	seed: 0,
	archetype: "corridor",
	sectors: [
		{ id: 0, vertices: bigSquare(0, 0, 10), floorHeight: 0, ceilingHeight: 10 },
		{ id: 1, vertices: bigSquare(30, 0, 10), floorHeight: 0, ceilingHeight: 10 },
		{ id: 2, vertices: bigSquare(60, 60, 10), floorHeight: 0, ceilingHeight: 10 },
	],
	playerSpawn: { x: 0, y: 0 },
	playerYaw: 0,
	enemySpawns: [],
	pickupSpawns: [],
	keyPosition: { x: 30, y: 0 },
	exitPosition: { x: 60, y: 60 },
	bounds: { minX: -10, minY: -10, maxX: 70, maxY: 70 },
};

function reseed(seed: number): ObjexoomSectorMap {
	return { ...SECTOR_FIXTURE, seed };
}

describe("COV12 step-2 — pickLootSpawn", () => {
	it("returns null for grid maps", () => {
		const grid = { ...SECTOR_FIXTURE, kind: "grid" } as unknown as ObjexoomSectorMap;
		expect(pickLootSpawn(grid)).toBeNull();
	});

	it("returns a spawn at the centroid of the sector farthest from playerSpawn", () => {
		const ls = pickLootSpawn(SECTOR_FIXTURE);
		expect(ls).not.toBeNull();
		// Sector 2's centroid is (60, 60) — farthest from (0, 0).
		expect(ls?.position.x).toBe(60);
		expect(ls?.position.y).toBe(60);
	});

	it("lootKind picks deterministically per seed", () => {
		// pickLootKind cycles through ["bottles", "books", "treasure"].
		expect(pickLootSpawn(reseed(0))?.lootKind).toBe("bottles");
		expect(pickLootSpawn(reseed(1))?.lootKind).toBe("books");
		expect(pickLootSpawn(reseed(2))?.lootKind).toBe("treasure");
		expect(pickLootSpawn(reseed(3))?.lootKind).toBe("bottles");
	});

	it("is deterministic — same seed → same spawn", () => {
		const a = pickLootSpawn(reseed(42));
		const b = pickLootSpawn(reseed(42));
		expect(a).toEqual(b);
	});

	it("returns null for sector maps with no sectors", () => {
		const empty = { ...SECTOR_FIXTURE, sectors: [] };
		expect(pickLootSpawn(empty)).toBeNull();
	});
});

describe("COV12 step-2 — lootPickupSpawn", () => {
	it("wraps pickLootSpawn into a PickupSpawn with kind 'loot'", () => {
		const ps = lootPickupSpawn(SECTOR_FIXTURE);
		expect(ps).not.toBeNull();
		expect(ps?.kind).toBe("loot");
		expect(ps?.position.x).toBe(60);
		expect(ps?.position.y).toBe(60);
	});

	it("returns null for grid maps", () => {
		const grid = { ...SECTOR_FIXTURE, kind: "grid" } as unknown as ObjexoomSectorMap;
		expect(lootPickupSpawn(grid)).toBeNull();
	});
});
