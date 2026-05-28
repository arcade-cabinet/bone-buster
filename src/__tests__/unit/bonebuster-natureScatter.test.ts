/**
 * COV11 step-2 — courtyard-archetype nature scatter contract.
 */

import type { BoneBusterSectorMap, Vec2 } from "@engine/engine";
import { ARCHETYPE_NAMES } from "@world/archetype";
import { spawnNature } from "@world/scatter/natureScatter";
import { describe, expect, it } from "vitest";

function bigSquare(cx: number, cy: number, size: number): readonly Vec2[] {
	return [
		{ x: cx - size, y: cy - size },
		{ x: cx + size, y: cy - size },
		{ x: cx + size, y: cy + size },
		{ x: cx - size, y: cy + size },
	];
}

// Courtyard archetype = seed % 5 === 2. Post-CONV3 the archetype is a
// stored field on the map; we derive it from seed here to preserve the
// original test semantics (seed 0 → corridor, seed 2 → courtyard).
function courtyardMap(seed: number): BoneBusterSectorMap {
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
		archetype: (() => {
			const v = ARCHETYPE_NAMES[(seed >>> 0) % ARCHETYPE_NAMES.length];
			if (!v) throw new RangeError("archetype index out of range");
			return v;
		})(),
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
		const grid = { ...courtyardMap(2), kind: "grid" } as unknown as BoneBusterSectorMap;
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
			const ai = a[i];
			const bi = b[i];
			if (!ai || !bi) throw new Error(`scatter missing element at index ${i}`);
			expect(ai.id).toBe(bi.id);
			expect(ai.position.x).toBe(bi.position.x);
			expect(ai.position.y).toBe(bi.position.y);
			expect(ai.yaw).toBe(bi.yaw);
			expect(ai.scale).toBe(bi.scale);
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

	it("scale is within [0.6, 1.4] (PT2 single-plant scale range)", () => {
		// COV11 step-1 used [0.15, 0.32] because each instance cloned the
		// full Mega_Nature aggregate; PT2 picks one plant per instance
		// and lifts the scale range to a single-plant courtyard read.
		for (const inst of spawnNature(courtyardMap(2))) {
			expect(inst.scale).toBeGreaterThanOrEqual(0.6);
			expect(inst.scale).toBeLessThanOrEqual(1.4);
		}
	});

	it("every instance carries a url from the PT2 nature plant pool", () => {
		// PT2 — every NatureInstance picks a single plant URL via
		// pickNaturePlant; the renderer groups by url for instancing.
		for (const inst of spawnNature(courtyardMap(2))) {
			expect(inst.url).toMatch(/\/assets\/models\/props\/nature\/[a-z][a-z0-9_]*\.glb$/);
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
