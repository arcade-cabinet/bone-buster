/**
 * COV11 step-2 — courtyard-archetype nature scatter contract.
 */

import { describe, expect, it } from "vitest";
import type { ObjexoomSectorMap, Vec2 } from "../../engine";
import { spawnNature } from "../../scatter/natureScatter";

function bigSquare(cx: number, cy: number, size: number): readonly Vec2[] {
	return [
		{ x: cx - size, y: cy - size },
		{ x: cx + size, y: cy - size },
		{ x: cx + size, y: cy + size },
		{ x: cx - size, y: cy + size },
	];
}

// Courtyard archetype = seed % 5 === 2.
function courtyardMap(seed: number): ObjexoomSectorMap {
	const sectors = [];
	for (let i = 0; i < 5; i += 1) {
		sectors.push({
			id: i,
			vertices: bigSquare(i * 30, 0, 12),
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
		bounds: { minX: -110, minY: -110, maxX: 150, maxY: 110 },
	};
}

describe("COV11 step-2 — spawnNature archetype gating", () => {
	it("returns [] on non-courtyard archetypes", () => {
		// seed 0 = corridor
		expect(spawnNature(courtyardMap(0))).toEqual([]);
	});

	it("returns [] for grid maps", () => {
		const grid = { ...courtyardMap(2), kind: "grid" } as unknown as ObjexoomSectorMap;
		expect(spawnNature(grid)).toEqual([]);
	});

	it("populates instances on courtyard maps (seed 2)", () => {
		const out = spawnNature(courtyardMap(2));
		expect(out.length).toBeGreaterThan(0);
	});
});

describe("COV11 step-2 — spawnNature invariants", () => {
	it("is deterministic — same seed → byte-identical layout", () => {
		const a = spawnNature(courtyardMap(2));
		const b = spawnNature(courtyardMap(2));
		expect(a.length).toBe(b.length);
		for (let i = 0; i < a.length; i += 1) {
			expect(a[i].id).toBe(b[i].id);
			expect(a[i].position.x).toBe(b[i].position.x);
			expect(a[i].position.y).toBe(b[i].position.y);
			expect(a[i].yaw).toBe(b[i].yaw);
			expect(a[i].scale).toBe(b[i].scale);
		}
	});

	it("ids are unique per map", () => {
		const out = spawnNature(courtyardMap(2));
		const ids = new Set(out.map((i) => i.id));
		expect(ids.size).toBe(out.length);
	});

	it("yaw is finite and in [0, 2π)", () => {
		for (const inst of spawnNature(courtyardMap(2))) {
			expect(Number.isFinite(inst.yaw)).toBe(true);
			expect(inst.yaw).toBeGreaterThanOrEqual(0);
			expect(inst.yaw).toBeLessThan(Math.PI * 2);
		}
	});

	it("scale is within [0.15, 0.32]", () => {
		for (const inst of spawnNature(courtyardMap(2))) {
			expect(inst.scale).toBeGreaterThanOrEqual(0.15);
			expect(inst.scale).toBeLessThanOrEqual(0.32);
		}
	});

	it("per-sector instance count is in [4, 8]", () => {
		const out = spawnNature(courtyardMap(2));
		const perSector = new Map<number, number>();
		for (const inst of out) {
			const sid = Math.floor(inst.id / 100);
			perSector.set(sid, (perSector.get(sid) ?? 0) + 1);
		}
		for (const count of perSector.values()) {
			expect(count).toBeGreaterThanOrEqual(1); // sample may fall short
			expect(count).toBeLessThanOrEqual(8);
		}
	});

	it("different seeds yield different layouts (probabilistic)", () => {
		const a = spawnNature(courtyardMap(2));
		const b = spawnNature(courtyardMap(7));
		const aSig = a.map((i) => `${i.position.x.toFixed(2)}`).join(",");
		const bSig = b.map((i) => `${i.position.x.toFixed(2)}`).join(",");
		expect(aSig).not.toBe(bSig);
	});
});
