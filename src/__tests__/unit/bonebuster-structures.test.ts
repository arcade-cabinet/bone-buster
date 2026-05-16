/**
 * COV3 step-2 + step-4 — modular wall pool contract.
 */

import { ARCHETYPE_NAMES } from "@world/archetype";
import { ALL_WALL_URLS, pickWallUrl, WALL_VARIANTS, WALLS_BY_ARCHETYPE } from "@world/structures";
import { describe, expect, it } from "vitest";

describe("COV3 step-2 — wall variant pool (corridor / legacy export)", () => {
	it("ships at least 4 wall variants", () => {
		expect(WALL_VARIANTS.length).toBeGreaterThanOrEqual(4);
	});

	it("every URL resolves to /assets/models/structures/*.glb", () => {
		for (const url of WALL_VARIANTS) {
			expect(url).toMatch(/\/assets\/models\/structures\/[A-Za-z0-9_]+\.glb$/);
		}
	});

	it("variant URLs are unique within the corridor pool", () => {
		expect(new Set(WALL_VARIANTS).size).toBe(WALL_VARIANTS.length);
	});

	it("WALL_VARIANTS is the corridor pool (step-2 byte-stability contract)", () => {
		expect(WALL_VARIANTS).toEqual(WALLS_BY_ARCHETYPE.corridor);
	});
});

describe("COV3 step-4 — per-archetype wall pools", () => {
	it("ships a pool for every archetype", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			expect(WALLS_BY_ARCHETYPE[archetype]).toBeDefined();
			expect(WALLS_BY_ARCHETYPE[archetype].length).toBeGreaterThanOrEqual(4);
		}
	});

	it("every pool URL resolves to /assets/models/structures/*.glb", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			for (const url of WALLS_BY_ARCHETYPE[archetype]) {
				expect(url).toMatch(/\/assets\/models\/structures\/[A-Za-z0-9_]+\.glb$/);
			}
		}
	});

	it("URLs within a pool are unique", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			const pool = WALLS_BY_ARCHETYPE[archetype];
			expect(new Set(pool).size).toBe(pool.length);
		}
	});

	it("at least 3 archetype pools have a distinct GLB the corridor pool lacks", () => {
		const corridor = new Set(WALLS_BY_ARCHETYPE.corridor);
		let distinct = 0;
		for (const archetype of ARCHETYPE_NAMES) {
			if (archetype === "corridor") continue;
			const hasDistinct = WALLS_BY_ARCHETYPE[archetype].some((url) => !corridor.has(url));
			if (hasDistinct) distinct += 1;
		}
		expect(distinct).toBeGreaterThanOrEqual(3);
	});

	it("ALL_WALL_URLS is the union of every pool, deduped", () => {
		const expected = new Set<string>();
		for (const archetype of ARCHETYPE_NAMES) {
			for (const url of WALLS_BY_ARCHETYPE[archetype]) expected.add(url);
		}
		expect(new Set(ALL_WALL_URLS)).toEqual(expected);
		expect(ALL_WALL_URLS.length).toBe(expected.size);
	});
});

describe("COV3 — pickWallUrl", () => {
	it("is deterministic per (archetype, hash) pair", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			expect(pickWallUrl(archetype, 42)).toBe(pickWallUrl(archetype, 42));
			expect(pickWallUrl(archetype, 7)).toBe(pickWallUrl(archetype, 7));
		}
	});

	it("returns a URL from the matching archetype pool for any hash", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			for (let h = 0; h < 50; h += 1) {
				expect(WALLS_BY_ARCHETYPE[archetype]).toContain(pickWallUrl(archetype, h));
			}
		}
	});

	it("all variants in a pool are reachable across hashes 0..N", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			const pool = WALLS_BY_ARCHETYPE[archetype];
			const seen = new Set<string>();
			for (let h = 0; h < pool.length; h += 1) {
				seen.add(pickWallUrl(archetype, h));
			}
			expect(seen.size).toBe(pool.length);
		}
	});

	it("handles negative hashes via unsigned right-shift", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			expect(WALLS_BY_ARCHETYPE[archetype]).toContain(pickWallUrl(archetype, -1));
			expect(WALLS_BY_ARCHETYPE[archetype]).toContain(pickWallUrl(archetype, -12345));
		}
	});

	it("at least one (archetype, hash=0) pair differs from corridor's", () => {
		const corridorPick = pickWallUrl("corridor", 0);
		let differs = false;
		for (const archetype of ARCHETYPE_NAMES) {
			if (archetype === "corridor") continue;
			if (pickWallUrl(archetype, 0) !== corridorPick) {
				differs = true;
				break;
			}
		}
		expect(differs).toBe(true);
	});
});
