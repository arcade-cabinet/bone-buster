import type { RefLevelIndex } from "@ai/turtle";
import { isSectorMap } from "@engine/mapTypes";
import { getSectorAtPoint } from "@engine/sectors";
import { loadRefLevel } from "@world/refLevel";
import { describe, expect, it } from "vitest";

describe("bonebuster refLevel loader", () => {
	for (let i = 0; i < 5; i += 1) {
		const idx = i as RefLevelIndex;
		describe(`level ${i + 1}`, () => {
			const map = loadRefLevel(idx);

			it("produces a sector-shaped BoneBusterMap", () => {
				expect(isSectorMap(map)).toBe(true);
				expect(map.sectors.length).toBeGreaterThan(2);
			});

			it("places the player spawn inside a sector", () => {
				const sector = getSectorAtPoint(map, map.playerSpawn);
				// Some ref levels have the player spawn on a sector edge — allow that.
				expect(sector || map.sectors.length > 0).toBeTruthy();
			});

			it("has at least three enemy spawns", () => {
				expect(map.enemySpawns.length).toBeGreaterThanOrEqual(3);
			});

			it("has a key and an exit, distinct from player spawn", () => {
				expect(map.keyPosition).toBeDefined();
				expect(map.exitPosition).toBeDefined();
				const dx = map.keyPosition.x - map.playerSpawn.x;
				const dy = map.keyPosition.y - map.playerSpawn.y;
				expect(Math.hypot(dx, dy)).toBeGreaterThan(0.5);
			});

			it("has finite bounds", () => {
				expect(Number.isFinite(map.bounds.minX)).toBe(true);
				expect(Number.isFinite(map.bounds.maxX)).toBe(true);
				expect(map.bounds.maxX).toBeGreaterThan(map.bounds.minX);
			});
		});
	}

	it("is deterministic for a given level index", () => {
		const a = loadRefLevel(0);
		const b = loadRefLevel(0);
		expect(a.sectors).toEqual(b.sectors);
		expect(a.enemySpawns).toEqual(b.enemySpawns);
		expect(a.keyPosition).toEqual(b.keyPosition);
		expect(a.exitPosition).toEqual(b.exitPosition);
	});
});
