import { isGridMap, isSectorMap } from "@engine/engine";
import type { LevelChoice } from "@store/settings";
import { buildMap } from "@world/buildMap";
import { describe, expect, it } from "vitest";

describe("bonebuster buildMap (A6)", () => {
	it("level='procedural' returns a deterministic grid map", () => {
		const a = buildMap(12345, "procedural");
		const b = buildMap(12345, "procedural");
		expect(isGridMap(a)).toBe(true);
		expect(a.kind).toBe("grid");
		expect(a.playerSpawn).toEqual(b.playerSpawn);
	});

	it("seed changes produce different procedural maps", () => {
		const a = buildMap(12345, "procedural");
		const b = buildMap(67890, "procedural");
		expect(a.playerSpawn).not.toEqual(b.playerSpawn);
	});

	for (const level of [1, 2, 3, 4, 5] as const) {
		it(`level=${level} returns a sector map (E1M${level})`, () => {
			const map = buildMap(0, level satisfies LevelChoice);
			expect(isSectorMap(map)).toBe(true);
			if (!isSectorMap(map)) throw new Error("unreachable");
			expect(map.sectors.length).toBeGreaterThan(0);
		});

		it(`level=${level} ignores the seed argument`, () => {
			const a = buildMap(1, level satisfies LevelChoice);
			const b = buildMap(999_999, level satisfies LevelChoice);
			if (!isSectorMap(a) || !isSectorMap(b)) throw new Error("unreachable");
			expect(a.sectors).toEqual(b.sectors);
		});
	}

	it("each ref level has ≥1 enemy and a player spawn", () => {
		for (const level of [1, 2, 3, 4, 5] as const) {
			const map = buildMap(0, level);
			expect(map.enemySpawns.length).toBeGreaterThanOrEqual(1);
			expect(Number.isFinite(map.playerSpawn.x)).toBe(true);
			expect(Number.isFinite(map.playerSpawn.y)).toBe(true);
		}
	});
});
