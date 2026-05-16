/**
 * E7 step-1 — water sector contract.
 *
 * Pins:
 *  - Every refLevel has exactly one water sector.
 *  - The water sector is NOT sector 0 (player-spawn anchor).
 *  - `isInWaterAt(map, point)` returns true inside the water sector's polygon
 *    and false outside.
 *  - Grid maps return false from isInWaterAt.
 *  - WATER_SPEED_MULTIPLIER is in a sensible range.
 */

import type { BoneBusterMap, ObjexoomGridMap } from "@engine/engine";
import { isInWaterAt, polygonContains, WATER_SPEED_MULTIPLIER } from "@engine/engine";
import { loadRefLevel } from "@world/refLevel";
import { describe, expect, it } from "vitest";

function makeGridMap(): ObjexoomGridMap {
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
	} as unknown as ObjexoomGridMap;
}

function centroid(verts: readonly { x: number; y: number }[]): { x: number; y: number } {
	let cx = 0;
	let cy = 0;
	for (const v of verts) {
		cx += v.x;
		cy += v.y;
	}
	return { x: cx / verts.length, y: cy / verts.length };
}

describe("E7 — water sector flagging", () => {
	it("every refLevel has exactly one water sector", () => {
		for (const idx of [0, 1, 2] as const) {
			const map = loadRefLevel(idx);
			const waterCount = map.sectors.filter((s) => s.isWater === true).length;
			expect(waterCount).toBe(1);
		}
	});

	it("the water sector is not sector 0 (player-spawn anchor)", () => {
		for (const idx of [0, 1, 2] as const) {
			const map = loadRefLevel(idx);
			const water = map.sectors.find((s) => s.isWater === true);
			expect(water?.id).not.toBe(0);
		}
	});
});

describe("E7 — isInWaterAt", () => {
	it("returns true at the centroid of the water sector", () => {
		const map = loadRefLevel(0);
		const water = map.sectors.find((s) => s.isWater === true);
		if (!water) throw new Error("expected a water sector");
		const c = centroid(water.vertices);
		expect(isInWaterAt(map, c)).toBe(true);
	});

	it("returns false at the centroid of a non-water sector", () => {
		const map = loadRefLevel(0);
		const dryland = map.sectors.find((s) => !s.isWater);
		if (!dryland) throw new Error("expected a dryland sector");
		const c = centroid(dryland.vertices);
		// Only counts as false if the centroid actually lies in the polygon
		// (some sectors are concave); skip if not.
		if (polygonContains(c, dryland.vertices)) {
			expect(isInWaterAt(map, c)).toBe(false);
		}
	});

	it("returns false at points far outside any sector", () => {
		const map = loadRefLevel(0);
		expect(isInWaterAt(map, { x: 99999, y: 99999 })).toBe(false);
	});

	it("returns false on grid maps", () => {
		const grid: BoneBusterMap = makeGridMap();
		expect(isInWaterAt(grid, { x: 0, y: 0 })).toBe(false);
	});
});

describe("E7 — water speed multiplier", () => {
	it("WATER_SPEED_MULTIPLIER is in (0, 1) — water slows but doesn't stop", () => {
		expect(WATER_SPEED_MULTIPLIER).toBeGreaterThan(0);
		expect(WATER_SPEED_MULTIPLIER).toBeLessThan(1);
	});

	it("WATER_SPEED_MULTIPLIER matches PRD §E7 (0.6)", () => {
		expect(WATER_SPEED_MULTIPLIER).toBe(0.6);
	});
});
