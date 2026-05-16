/**
 * COV6 step-2 — wall-face decal scatter contract.
 */

import { DECAL_VARIANTS_ALL } from "@world/decals";
import { loadRefLevel } from "@world/refLevel";
import { spawnDecals } from "@world/scatter/decalScatter";
import { describe, expect, it } from "vitest";

describe("COV6 step-2 — wall-face decal scatter", () => {
	it("scatters decals on a multi-sector ref level", () => {
		const map = loadRefLevel(0);
		const decals = spawnDecals(map);
		expect(decals.length).toBeGreaterThan(0);
	});

	it("is deterministic — same map produces identical scatter", () => {
		const map = loadRefLevel(0);
		const a = spawnDecals(map);
		const b = spawnDecals(map);
		expect(a).toHaveLength(b.length);
		for (let i = 0; i < a.length; i += 1) {
			expect(a[i].id).toBe(b[i].id);
			expect(a[i].position.x).toBe(b[i].position.x);
			expect(a[i].position.y).toBe(b[i].position.y);
			expect(a[i].y).toBe(b[i].y);
			expect(a[i].yaw).toBe(b[i].yaw);
			expect(a[i].url).toBe(b[i].url);
		}
	});

	it("every URL is in DECAL_VARIANTS_ALL", () => {
		const map = loadRefLevel(0);
		const decals = spawnDecals(map);
		const valid = new Set(DECAL_VARIANTS_ALL);
		for (const d of decals) {
			expect(valid.has(d.url)).toBe(true);
		}
	});

	it("ids are unique across the scatter", () => {
		const map = loadRefLevel(0);
		const decals = spawnDecals(map);
		expect(new Set(decals.map((d) => d.id)).size).toBe(decals.length);
	});

	it("every Y coordinate falls between sector floor and ceiling", () => {
		const map = loadRefLevel(0);
		if (map.kind !== "sectors") throw new Error("expected sector map");
		const decals = spawnDecals(map);
		const sectorById = new Map(map.sectors.map((s) => [s.id, s]));
		for (const d of decals) {
			const sectorId = Math.floor(d.id / 1_000_000);
			const sector = sectorById.get(sectorId);
			if (!sector) continue;
			expect(d.y).toBeGreaterThanOrEqual(sector.floorHeight);
			expect(d.y).toBeLessThanOrEqual(sector.ceilingHeight);
		}
	});

	it("grid maps return empty", () => {
		const grid = {
			kind: "grid" as const,
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
		};
		// biome-ignore lint/suspicious/noExplicitAny: synthesized grid map type for test
		expect(spawnDecals(grid as any)).toEqual([]);
	});

	it("yaw is finite for every decal", () => {
		const map = loadRefLevel(0);
		const decals = spawnDecals(map);
		for (const d of decals) {
			expect(Number.isFinite(d.yaw)).toBe(true);
		}
	});
});
