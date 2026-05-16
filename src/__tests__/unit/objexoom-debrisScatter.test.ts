/**
 * COV5 step-2 — debris scatter contract.
 */

import { polygonContains } from "@engine/engine";
import { describe, expect, it } from "vitest";
import { loadRefLevel } from "../../refLevel";
import { DEBRIS_VARIANTS, spawnDebris } from "../../scatter/debrisScatter";

describe("COV5 step-2 — sector-body debris scatter", () => {
	it("scatters debris on a multi-sector ref level", () => {
		const map = loadRefLevel(0);
		const debris = spawnDebris(map);
		expect(debris.length).toBeGreaterThan(0);
	});

	it("is deterministic — same map produces identical scatter", () => {
		const map = loadRefLevel(0);
		const a = spawnDebris(map);
		const b = spawnDebris(map);
		expect(a).toHaveLength(b.length);
		for (let i = 0; i < a.length; i += 1) {
			expect(a[i].id).toBe(b[i].id);
			expect(a[i].position.x).toBe(b[i].position.x);
			expect(a[i].position.y).toBe(b[i].position.y);
			expect(a[i].yaw).toBe(b[i].yaw);
			expect(a[i].url).toBe(b[i].url);
		}
	});

	it("every debris position is inside some sector polygon", () => {
		const map = loadRefLevel(0);
		if (map.kind !== "sectors") throw new Error("expected sector map");
		const debris = spawnDebris(map);
		for (const d of debris) {
			let inside = false;
			for (const sector of map.sectors) {
				if (polygonContains(d.position, sector.vertices)) {
					inside = true;
					break;
				}
			}
			expect(inside).toBe(true);
		}
	});

	it("respects 4-tile skip-radius from spawn/exit/key", () => {
		const map = loadRefLevel(0);
		const debris = spawnDebris(map);
		const anchors = [map.playerSpawn, map.exitPosition, map.keyPosition];
		for (const d of debris) {
			for (const a of anchors) {
				const dist = Math.hypot(a.x - d.position.x, a.y - d.position.y);
				expect(dist).toBeGreaterThanOrEqual(4);
			}
		}
	});

	it("ids are unique across the scatter", () => {
		const map = loadRefLevel(0);
		const debris = spawnDebris(map);
		expect(new Set(debris.map((d) => d.id)).size).toBe(debris.length);
	});

	it("every URL is in DEBRIS_VARIANTS", () => {
		const map = loadRefLevel(0);
		const debris = spawnDebris(map);
		const valid = new Set(DEBRIS_VARIANTS);
		for (const d of debris) {
			expect(valid.has(d.url)).toBe(true);
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
		expect(spawnDebris(grid as any)).toEqual([]);
	});
});
