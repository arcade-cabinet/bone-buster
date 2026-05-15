/**
 * COV13 step-2 — kitchen scatter contract.
 */

import { describe, expect, it } from "vitest";
import type { ObjexoomSectorMap, Vec2 } from "../../engine";
import { KITCHEN_PROPS } from "../../kitchen";
import { spawnKitchen } from "../../scatter/kitchenScatter";

function bigSquare(cx: number, cy: number, size: number): readonly Vec2[] {
	return [
		{ x: cx - size, y: cy - size },
		{ x: cx + size, y: cy - size },
		{ x: cx + size, y: cy + size },
		{ x: cx - size, y: cy + size },
	];
}

// Many sectors so the 20% sector probability has room to fire.
function libraryMap(seed: number): ObjexoomSectorMap {
	const sectors = [];
	// Library archetype = seed % 5 === 4 — use seed = 4, 9, 14, …
	for (let i = 0; i < 20; i += 1) {
		sectors.push({
			id: i,
			vertices: bigSquare(i * 30, 0, 10),
			floorHeight: 0,
			ceilingHeight: 10,
		});
	}
	return {
		kind: "sectors",
		seed,
		sectors,
		playerSpawn: { x: -100, y: -100 },
		playerYaw: 0,
		enemySpawns: [],
		pickupSpawns: [],
		keyPosition: { x: 1000, y: 1000 },
		exitPosition: { x: 1001, y: 1001 },
		bounds: { minX: -110, minY: -110, maxX: 600, maxY: 110 },
	};
}

function nonLibrarySeed(): number {
	// 0 = corridor. spawnKitchen should return [].
	return 0;
}

describe("COV13 step-2 — spawnKitchen archetype gating", () => {
	it("returns [] on non-library archetypes", () => {
		expect(spawnKitchen(libraryMap(nonLibrarySeed()))).toEqual([]);
	});

	it("returns [] for grid maps", () => {
		const grid = { ...libraryMap(4), kind: "grid" } as unknown as ObjexoomSectorMap;
		expect(spawnKitchen(grid)).toEqual([]);
	});

	it("places at least one kitchen prop on library-archetype maps (across many sectors)", () => {
		const out = spawnKitchen(libraryMap(4));
		expect(out.length).toBeGreaterThan(0);
	});
});

describe("COV13 step-2 — spawnKitchen invariants", () => {
	it("is deterministic — same seed → byte-identical layout", () => {
		const a = spawnKitchen(libraryMap(4));
		const b = spawnKitchen(libraryMap(4));
		expect(a.length).toBe(b.length);
		for (let i = 0; i < a.length; i += 1) {
			expect(a[i].id).toBe(b[i].id);
			expect(a[i].position.x).toBe(b[i].position.x);
			expect(a[i].position.y).toBe(b[i].position.y);
			expect(a[i].url).toBe(b[i].url);
			expect(a[i].yaw).toBe(b[i].yaw);
		}
	});

	it("every url is in KITCHEN_PROPS", () => {
		for (const inst of spawnKitchen(libraryMap(4))) {
			expect(KITCHEN_PROPS).toContain(inst.url);
		}
	});

	it("ids are unique per map", () => {
		const out = spawnKitchen(libraryMap(4));
		const ids = new Set(out.map((i) => i.id));
		expect(ids.size).toBe(out.length);
	});

	it("yaw is finite and in [0, 2π)", () => {
		for (const inst of spawnKitchen(libraryMap(4))) {
			expect(Number.isFinite(inst.yaw)).toBe(true);
			expect(inst.yaw).toBeGreaterThanOrEqual(0);
			expect(inst.yaw).toBeLessThan(Math.PI * 2);
		}
	});

	it("per-sector prop count never exceeds 3", () => {
		const out = spawnKitchen(libraryMap(4));
		const perSector = new Map<number, number>();
		for (const inst of out) {
			const sid = Math.floor(inst.id / 100);
			perSector.set(sid, (perSector.get(sid) ?? 0) + 1);
		}
		for (const count of perSector.values()) {
			expect(count).toBeLessThanOrEqual(3);
			expect(count).toBeGreaterThanOrEqual(1);
		}
	});

	it("does not tag every sector — 20% probability holds approximately", () => {
		const out = spawnKitchen(libraryMap(4));
		const taggedSectors = new Set(out.map((inst) => Math.floor(inst.id / 100)));
		// 20 sectors × 20% ≈ 4 expected. Allow a wide band [1, 10] given
		// the small sample.
		expect(taggedSectors.size).toBeGreaterThanOrEqual(1);
		expect(taggedSectors.size).toBeLessThanOrEqual(10);
	});
});
