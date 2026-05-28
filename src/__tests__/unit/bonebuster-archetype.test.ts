/**
 * E13 step-1 — archetype pick contract.
 *
 * CONV3 (2026-05-15) denormalized `archetype` onto the map type, so
 * `pickArchetype(map)` is now a trivial accessor. The "derive from
 * seed" invariant lives at the construction site (generateMap /
 * loadRefLevel), and this suite now pins both:
 *  - constructors emit `archetype = ARCHETYPE_NAMES[seed % 5]`
 *  - `pickArchetype(map)` returns `map.archetype`
 */

import { generateMap } from "@engine/gridGen";
import { CANONICAL_SEED_PHRASE } from "@engine/seedPhrase";
import { ARCHETYPE_NAMES, archetypeForPhrase, pickArchetype } from "@world/archetype";
import { loadRefLevel } from "@world/refLevel";
import { describe, expect, it } from "vitest";

describe("E13 — archetype pick", () => {
	it("ships exactly 5 archetypes in canonical order", () => {
		expect(ARCHETYPE_NAMES).toEqual(["corridor", "arena", "courtyard", "sewer", "library"]);
	});

	it("loadRefLevel sets map.archetype = ARCHETYPE_NAMES[index % 5]", () => {
		for (const idx of [0, 1, 2] as const) {
			const map = loadRefLevel(idx);
			expect(map.archetype).toBe(ARCHETYPE_NAMES[idx % 5]);
			expect(pickArchetype(map)).toBe(map.archetype);
		}
	});

	// F4 / SEED2 — the procedural "NEW GAME" path is generateMap(seedPhrase).
	// The archetype now derives from cyrb128(phrase)[0] % 5 (was seed % 5);
	// pin that generateMap's archetype matches archetypeForPhrase on the prod
	// construction path, not only on the ref-level loader.
	it("generateMap derives archetype = archetypeForPhrase(seedPhrase)", () => {
		for (const phrase of [
			"test-11",
			"test-1",
			"test-3",
			"test-33",
			"test-0",
			"gen-42",
			"gen-99999",
		]) {
			expect(generateMap(phrase).archetype).toBe(archetypeForPhrase(phrase));
		}
	});

	it("CANONICAL_SEED_PHRASE is the frozen corridor anchor", () => {
		expect(generateMap(CANONICAL_SEED_PHRASE).archetype).toBe("corridor");
	});

	it("pickArchetype(map) returns the stored map.archetype field", () => {
		// Build maps with different stored archetypes; pickArchetype should
		// echo them regardless of seed (CONV3 — denormalized).
		for (const name of ARCHETYPE_NAMES) {
			const base = loadRefLevel(0);
			const map = { ...base, seedPhrase: "fixture-42", archetype: name };
			expect(pickArchetype(map)).toBe(name);
		}
	});

	it("deterministic — same map produces same archetype", () => {
		const map = loadRefLevel(0);
		expect(pickArchetype(map)).toBe(pickArchetype(map));
	});

	it("ref levels 0/1/2 each yield a valid archetype", () => {
		for (const idx of [0, 1, 2] as const) {
			const map = loadRefLevel(idx);
			const arch = pickArchetype(map);
			expect(ARCHETYPE_NAMES).toContain(arch);
		}
	});
});
