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

import { generateMap } from "@engine/engine";
import { ARCHETYPE_NAMES, pickArchetype } from "@world/archetype";
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

	// F4 — the procedural "NEW GAME" path is generateMap(seed), not
	// loadRefLevel. The seed%5 → archetype invariant (canonical
	// byte-stability: seed 0 = corridor) must be pinned on the prod
	// construction path, not only on the ref-level loader.
	it("generateMap derives archetype = ARCHETYPE_NAMES[seed % 5]", () => {
		for (const seed of [0, 1, 2, 3, 4, 5, 9, 10, 12345, 99999]) {
			expect(generateMap(seed).archetype).toBe(ARCHETYPE_NAMES[seed % 5]);
		}
	});

	it("generateMap(0).archetype is the frozen corridor anchor", () => {
		expect(generateMap(0).archetype).toBe("corridor");
	});

	it("pickArchetype(map) returns the stored map.archetype field", () => {
		// Build maps with different stored archetypes; pickArchetype should
		// echo them regardless of seed (CONV3 — denormalized).
		for (const name of ARCHETYPE_NAMES) {
			const base = loadRefLevel(0);
			const map = { ...base, seed: 42, archetype: name };
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
