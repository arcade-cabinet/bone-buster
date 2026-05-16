/**
 * INF3 — `?objexoomArchetype` URL override invariants.
 * Pins the seed-rewrite so pickArchetype lands on the requested name
 * regardless of the input seed.
 */

import type { BoneBusterMap } from "@engine/engine";
import { applyArchetypeOverride } from "@views/Shell";
import { ARCHETYPE_NAMES, pickArchetype } from "@world/archetype";
import { describe, expect, it } from "vitest";

function fakeMap(seed: number): BoneBusterMap {
	// CONV3 — archetype is now denormalized onto the map type. The fake
	// here mirrors what `generateMap`/`loadRefLevel` would have set so
	// `pickArchetype(map)` round-trips correctly.
	return {
		kind: "grid",
		seed,
		archetype: ARCHETYPE_NAMES[(seed >>> 0) % ARCHETYPE_NAMES.length],
		width: 1,
		height: 1,
		cells: [[]],
		playerSpawn: { x: 0, y: 0 },
		playerYaw: 0,
		exitPosition: { x: 0, y: 0 },
		keyPosition: { x: 0, y: 0 },
		doorPosition: { x: 0, y: 0 },
		doorOrientation: "horizontal",
		barrelSpawns: [],
		enemySpawns: [],
		pickupSpawns: [],
		secretCells: [],
	} as unknown as BoneBusterMap;
}

describe("INF3 — applyArchetypeOverride", () => {
	it("returns the seed unchanged when archetype is null", () => {
		for (const seed of [0, 1, 12345, 0xdeadbeef]) {
			expect(applyArchetypeOverride(seed, null)).toBe(seed >>> 0);
		}
	});

	it("returns the seed unchanged when archetype is unknown", () => {
		expect(applyArchetypeOverride(42, "nope")).toBe(42);
	});

	it("forces pickArchetype to the requested name for every input seed", () => {
		for (const name of ARCHETYPE_NAMES) {
			for (const seed of [0, 1, 2, 3, 4, 5, 99, 12345, 0xdeadbeef >>> 0]) {
				const rewritten = applyArchetypeOverride(seed, name);
				expect(pickArchetype(fakeMap(rewritten))).toBe(name);
			}
		}
	});

	it("is idempotent — applying twice yields the same seed", () => {
		for (const name of ARCHETYPE_NAMES) {
			const once = applyArchetypeOverride(98765, name);
			const twice = applyArchetypeOverride(once, name);
			expect(twice).toBe(once);
		}
	});
});
