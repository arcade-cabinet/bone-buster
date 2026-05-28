/**
 * COV13 step-2 — kitchen scatter contract.
 */

import type { BoneBusterSectorMap, Vec2 } from "@engine/engine";
import { ARCHETYPE_NAMES, archetypeForPhrase } from "@world/archetype";
import { KITCHEN_PROPS } from "@world/kitchen";
import { spawnKitchen } from "@world/scatter/kitchenScatter";
import { describe, expect, it } from "vitest";

function bigSquare(cx: number, cy: number, size: number): readonly Vec2[] {
	return [
		{ x: cx - size, y: cy - size },
		{ x: cx + size, y: cy - size },
		{ x: cx + size, y: cy + size },
		{ x: cx - size, y: cy + size },
	];
}

// Many sectors so the 20% sector probability has room to fire.
function libraryMap(seedPhrase: string): BoneBusterSectorMap {
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
		seedPhrase,
		archetype: archetypeForPhrase(seedPhrase),
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

function nonLibrarySeed(): string {
	// 0 = corridor. spawnKitchen should return [].
	return "test-11"; // corridor — spawnKitchen returns []
}

describe("COV13 step-2 — spawnKitchen archetype gating", () => {
	it("returns [] on non-library archetypes", () => {
		expect(spawnKitchen(libraryMap(nonLibrarySeed()))).toEqual([]);
	});

	it("returns [] for grid maps", () => {
		const grid = { ...libraryMap("test-0"), kind: "grid" } as unknown as BoneBusterSectorMap;
		expect(spawnKitchen(grid)).toEqual([]);
	});

	it("places at least one kitchen prop on library-archetype maps (across many sectors)", () => {
		const out = spawnKitchen(libraryMap("test-0"));
		expect(out.length).toBeGreaterThan(0);
	});
});

describe("COV13 step-2 — spawnKitchen invariants", () => {
	it("is deterministic — same seed → byte-identical layout", () => {
		const a = spawnKitchen(libraryMap("test-0"));
		const b = spawnKitchen(libraryMap("test-0"));
		expect(a.length).toBe(b.length);
		for (let i = 0; i < a.length; i += 1) {
			const ai = a[i];
			const bi = b[i];
			if (!ai || !bi) throw new Error(`scatter missing element at index ${i}`);
			expect(ai.id).toBe(bi.id);
			expect(ai.position.x).toBe(bi.position.x);
			expect(ai.position.y).toBe(bi.position.y);
			expect(ai.url).toBe(bi.url);
			expect(ai.yaw).toBe(bi.yaw);
		}
	});

	it("every url is in KITCHEN_PROPS", () => {
		for (const inst of spawnKitchen(libraryMap("test-0"))) {
			expect(KITCHEN_PROPS).toContain(inst.url);
		}
	});

	it("ids are unique per map", () => {
		const out = spawnKitchen(libraryMap("test-0"));
		const ids = new Set(out.map((i) => i.id));
		expect(ids.size).toBe(out.length);
	});

	it("yaw is finite and in [0, 2π)", () => {
		for (const inst of spawnKitchen(libraryMap("test-0"))) {
			expect(Number.isFinite(inst.yaw)).toBe(true);
			expect(inst.yaw).toBeGreaterThanOrEqual(0);
			expect(inst.yaw).toBeLessThan(Math.PI * 2);
		}
	});

	it("per-sector prop count never exceeds 3", () => {
		const out = spawnKitchen(libraryMap("test-0"));
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
		const out = spawnKitchen(libraryMap("test-0"));
		const taggedSectors = new Set(out.map((inst) => Math.floor(inst.id / 100)));
		// 20 sectors × 20% ≈ 4 expected. Allow a wide band [1, 10] given
		// the small sample.
		expect(taggedSectors.size).toBeGreaterThanOrEqual(1);
		expect(taggedSectors.size).toBeLessThanOrEqual(10);
	});
});
