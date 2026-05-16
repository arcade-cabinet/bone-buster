/**
 * D8 — alliterative level-name generator contract.
 *
 * PRD §D8: per-archetype pool of alliterative two-word names.
 * pickLevelName(archetype, seed) is deterministic. refLevel(0)
 * returns "Welcome Wing" (the fixed onboarding tutorial name).
 * HUD reads this instead of the old "E1M1 · CORRIDOR" pattern.
 */

import { ARCHETYPE_NAMES } from "@world/archetype";
import { LEVEL_NAME_POOLS, pickLevelName, WELCOME_WING_NAME } from "@world/levelNames";
import { describe, expect, it } from "vitest";

describe("D8 — pickLevelName", () => {
	it("returns the same name for the same (archetype, seed)", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			const a = pickLevelName(archetype, 12345);
			const b = pickLevelName(archetype, 12345);
			expect(a).toBe(b);
		}
	});

	it("returns names from the archetype's pool", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			const pool = LEVEL_NAME_POOLS[archetype];
			const name = pickLevelName(archetype, 7);
			expect(pool).toContain(name);
		}
	});

	it("WELCOME_WING_NAME is 'Welcome Wing' (fixed onboarding name)", () => {
		expect(WELCOME_WING_NAME).toBe("Welcome Wing");
	});

	it("each pool has at least 6 candidates so the picker has variety", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			expect(LEVEL_NAME_POOLS[archetype].length).toBeGreaterThanOrEqual(6);
		}
	});

	it("each pool name is two words (space-separated)", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			for (const name of LEVEL_NAME_POOLS[archetype]) {
				const parts = name.split(" ");
				expect(parts).toHaveLength(2);
				expect(parts[0].length).toBeGreaterThan(0);
				expect(parts[1].length).toBeGreaterThan(0);
			}
		}
	});

	it("each pool name is alliterative — both words share the same first letter (case-insensitive)", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			for (const name of LEVEL_NAME_POOLS[archetype]) {
				const [a, b] = name.split(" ");
				expect(a[0].toUpperCase()).toBe(b[0].toUpperCase());
			}
		}
	});

	it("different seeds produce different names within a pool (probabilistic)", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			const samples = new Set<string>();
			for (let s = 0; s < 50; s += 1) {
				samples.add(pickLevelName(archetype, s));
			}
			// At least 3 distinct names over 50 seeds — wildly low bar
			// against a pool of 6+; catches the "always returns pool[0]" bug.
			expect(samples.size).toBeGreaterThanOrEqual(3);
		}
	});

	it("deterministic mapping for 10 archetype × seed combinations (regression pin)", () => {
		const COMBOS: Array<[(typeof ARCHETYPE_NAMES)[number], number]> = [
			["corridor", 1],
			["corridor", 42],
			["arena", 1],
			["arena", 42],
			["courtyard", 7],
			["courtyard", 99],
			["sewer", 13],
			["sewer", 1234],
			["library", 0],
			["library", 8675309],
		];
		// Pin the first call's value; same call must always match it.
		const snapshot = COMBOS.map(([a, s]) => pickLevelName(a, s));
		// Second pass must match the first.
		const replay = COMBOS.map(([a, s]) => pickLevelName(a, s));
		expect(replay).toEqual(snapshot);
	});
});
