/**
 * INF3 / SEED2 — `?bonebusterArchetype` URL override invariants.
 * Pins the seed-PHRASE rewrite so the resulting phrase hashes to the
 * requested archetype regardless of the input phrase.
 */

import type { BoneBusterMap } from "@engine/mapTypes";
import {
	ARCHETYPE_NAMES,
	applyArchetypeOverride,
	archetypeForPhrase,
	pickArchetype,
} from "@world/archetype";
import { describe, expect, it } from "vitest";

function fakeMap(seedPhrase: string): BoneBusterMap {
	// CONV3 — archetype is denormalized onto the map type. The fake here
	// mirrors what generateMap/loadRefLevel would have set (archetype derived
	// from the phrase hash) so pickArchetype(map) round-trips correctly.
	return {
		kind: "grid",
		seedPhrase,
		archetype: archetypeForPhrase(seedPhrase),
		width: 1,
		height: 1,
		cells: [[]],
		playerSpawn: { x: 0, y: 0 },
		playerYaw: 0,
		exitPosition: { x: 0, y: 0 },
		keyPosition: { x: 0, y: 0 },
		doorCell: { gx: 0, gy: 0 },
		rooms: [],
		enemySpawns: [],
		pickupSpawns: [],
	} as unknown as BoneBusterMap;
}

const PHRASES = ["test-0", "test-1", "test-3", "test-11", "test-33", "gen-99", "gen-12345"];

describe("INF3 — applyArchetypeOverride (phrase)", () => {
	it("returns the phrase unchanged when archetype is null", () => {
		for (const p of PHRASES) {
			expect(applyArchetypeOverride(p, null)).toBe(p);
		}
	});

	it("returns the phrase unchanged when archetype is unknown", () => {
		expect(applyArchetypeOverride("test-0", "nope")).toBe("test-0");
	});

	it("rewrites the phrase so it hashes to the requested archetype, for every input", () => {
		for (const name of ARCHETYPE_NAMES) {
			for (const p of PHRASES) {
				const rewritten = applyArchetypeOverride(p, name);
				expect(archetypeForPhrase(rewritten)).toBe(name);
				expect(pickArchetype(fakeMap(rewritten))).toBe(name);
			}
		}
	});

	it("is idempotent — applying twice yields the same phrase", () => {
		for (const name of ARCHETYPE_NAMES) {
			const once = applyArchetypeOverride("gen-98765", name);
			const twice = applyArchetypeOverride(once, name);
			expect(twice).toBe(once);
		}
	});
});
