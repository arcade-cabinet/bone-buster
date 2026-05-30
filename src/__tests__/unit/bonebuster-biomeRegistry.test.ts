/**
 * STRUCT2 — biome registry contract. One generator per biome on the shared
 * MazeGenerator core; the registry is the "add a biome = one entry" extension
 * point + the single map-composition boundary.
 */

import { ARCHETYPE_NAMES } from "@world/archetype";
import { BIOMES, generateBiomeMap } from "@world/biomes/registry";
import { describe, expect, it } from "vitest";

describe("STRUCT2 — biome registry", () => {
	it("has exactly one generator per biome (covers every archetype, no extras)", () => {
		expect(Object.keys(BIOMES).sort()).toEqual([...ARCHETYPE_NAMES].sort());
		for (const b of ARCHETYPE_NAMES) {
			expect(BIOMES[b].biome).toBe(b);
			expect(typeof BIOMES[b].generate).toBe("function");
		}
	});

	it("each biome generates a grid map stamped with its own archetype", () => {
		for (const b of ARCHETYPE_NAMES) {
			const map = generateBiomeMap(b, "registry-test-phrase", 0);
			expect(map.kind).toBe("grid");
			expect(map.archetype).toBe(b);
		}
	});

	it("is deterministic per (biome, phrase, depth)", () => {
		const a = generateBiomeMap("sewer", "det-phrase", 2);
		const b = generateBiomeMap("sewer", "det-phrase", 2);
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});

	it("biomes differ in structure for the same phrase (distinct shapes)", () => {
		// corridor (tight rooms) vs arena (big sparse rooms) → different room sets.
		const corridor = generateBiomeMap("corridor", "shape-phrase", 0);
		const arena = generateBiomeMap("arena", "shape-phrase", 0);
		expect(JSON.stringify(corridor.cells)).not.toBe(JSON.stringify(arena.cells));
	});

	it("depth changes the geometry (descent sequence)", () => {
		const d0 = generateBiomeMap("library", "depth-phrase", 0);
		const d1 = generateBiomeMap("library", "depth-phrase", 1);
		expect(JSON.stringify(d0.cells)).not.toBe(JSON.stringify(d1.cells));
	});
});
