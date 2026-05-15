/**
 * E13 step-1 — archetype pick contract.
 *
 * Pins:
 *  - `pickArchetype(map)` returns ARCHETYPE_NAMES[map.seed % 5].
 *  - All 5 archetypes are reachable across seeds 0..4.
 *  - Deterministic per seed (same input → same output).
 */

import { describe, expect, it } from "vitest";
import { ARCHETYPE_NAMES, pickArchetype } from "../../archetype";
import { loadRefLevel } from "../../refLevel";

describe("E13 — archetype pick", () => {
	it("ships exactly 5 archetypes in canonical order", () => {
		expect(ARCHETYPE_NAMES).toEqual(["corridor", "arena", "courtyard", "sewer", "library"]);
	});

	it("pickArchetype(map) returns ARCHETYPE_NAMES[map.seed % 5]", () => {
		for (let seed = 0; seed < 20; seed += 1) {
			const map = { ...loadRefLevel(0), seed };
			expect(pickArchetype(map)).toBe(ARCHETYPE_NAMES[seed % 5]);
		}
	});

	it("all 5 archetypes are reachable across seeds 0..4", () => {
		const seen = new Set<string>();
		for (let seed = 0; seed < 5; seed += 1) {
			const map = { ...loadRefLevel(0), seed };
			seen.add(pickArchetype(map));
		}
		expect(seen.size).toBe(5);
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

	it("handles negative seeds via unsigned-right-shift", () => {
		const map = { ...loadRefLevel(0), seed: -1 };
		const arch = pickArchetype(map);
		expect(ARCHETYPE_NAMES).toContain(arch);
	});
});
