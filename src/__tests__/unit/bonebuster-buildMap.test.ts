import { isGridMap } from "@engine/mapTypes";
import { CANONICAL_SEED_PHRASE } from "@engine/seedPhrase";
import { buildMap } from "@world/buildMap";
import { describe, expect, it } from "vitest";

describe("bonebuster buildMap (STRUCT1 — fully procedural depth+phrase)", () => {
	it("returns a deterministic grid map for (phrase, depth, biome)", () => {
		const a = buildMap("gen-12345", 0, "corridor");
		const b = buildMap("gen-12345", 0, "corridor");
		expect(isGridMap(a)).toBe(true);
		expect(a.kind).toBe("grid");
		expect(a.playerSpawn).toEqual(b.playerSpawn);
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});

	it("seed changes produce different procedural maps", () => {
		const a = buildMap("gen-12345", 0, "corridor");
		const b = buildMap("gen-67890", 0, "corridor");
		expect(a.playerSpawn).not.toEqual(b.playerSpawn);
	});

	it("the biome param drives the map archetype skin", () => {
		for (const biome of ["corridor", "arena", "courtyard", "sewer", "library"] as const) {
			const map = buildMap("gen-12345", 0, biome);
			expect(map.archetype).toBe(biome);
		}
	});

	it("depth forks the geometry — same phrase, different depth → different maze", () => {
		const d0 = buildMap("gen-12345", 0, "corridor");
		const d1 = buildMap("gen-12345", 1, "corridor");
		if (!isGridMap(d0) || !isGridMap(d1)) throw new Error("expected grid maps");
		expect(JSON.stringify(d0.cells)).not.toBe(JSON.stringify(d1.cells));
	});

	it("depth-0 + canonical phrase + corridor preserves the canonical baseline", () => {
		const map = buildMap(CANONICAL_SEED_PHRASE, 0, "corridor");
		expect(map.archetype).toBe("corridor");
		expect(isGridMap(map)).toBe(true);
	});

	it("every built map has ≥1 enemy and a finite player spawn", () => {
		const map = buildMap("gen-0", 0, "arena");
		expect(map.enemySpawns.length).toBeGreaterThanOrEqual(1);
		expect(Number.isFinite(map.playerSpawn.x)).toBe(true);
		expect(Number.isFinite(map.playerSpawn.y)).toBe(true);
	});
});
