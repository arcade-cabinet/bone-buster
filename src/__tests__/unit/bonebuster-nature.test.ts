/**
 * COV11 step-1 / PT2 — nature pack contract.
 */

import { NATURE_MEGA_PACK_URL, NATURE_PLANT_URLS, pickNaturePlant } from "@world/nature";
import { describe, expect, it } from "vitest";

describe("COV11 — nature mega pack", () => {
	it("URL resolves to /assets/models/props/nature/Mega_Nature.glb", () => {
		expect(NATURE_MEGA_PACK_URL).toMatch(/\/assets\/models\/props\/nature\/Mega_Nature\.glb$/);
	});

	it("URL is a non-empty string", () => {
		expect(typeof NATURE_MEGA_PACK_URL).toBe("string");
		expect(NATURE_MEGA_PACK_URL.length).toBeGreaterThan(0);
	});
});

describe("PT2 — NATURE_PLANT_URLS roster", () => {
	it("ships 31 per-plant GLBs (one per Mega_Nature top-level mesh)", () => {
		// scripts/blender/mega-nature-split.py extracts 31 top-level
		// MESH objects from Mega_Nature.glb. Pin the count so future
		// re-splits with different filters surface as a test break.
		expect(NATURE_PLANT_URLS.length).toBe(31);
	});

	it("every URL routes through /assets/models/props/nature/<plant>.glb", () => {
		for (const url of NATURE_PLANT_URLS) {
			expect(url).toMatch(/\/assets\/models\/props\/nature\/[a-z][a-z0-9_]*\.glb$/);
			// Defense: the aggregate must not slip into the per-plant pool.
			expect(url).not.toMatch(/Mega_Nature\.glb$/);
		}
	});

	it("URLs are unique", () => {
		expect(new Set(NATURE_PLANT_URLS).size).toBe(NATURE_PLANT_URLS.length);
	});
});

describe("PT2 — pickNaturePlant", () => {
	it("is deterministic — same (id, seed) → same URL", () => {
		expect(pickNaturePlant(42, 7)).toBe(pickNaturePlant(42, 7));
	});

	it("returns a URL from NATURE_PLANT_URLS for any (id, seed)", () => {
		for (let id = 0; id < 50; id += 1) {
			expect(NATURE_PLANT_URLS).toContain(pickNaturePlant(id, 0));
			expect(NATURE_PLANT_URLS).toContain(pickNaturePlant(id, 12345));
		}
	});

	it("adjacent ids on the same seed don't always pick the same plant", () => {
		// Hash-mix invariant: a naive id % pool size would cluster runs
		// of identical plants. The XOR-mixed hash should yield variety
		// across consecutive ids.
		const seed = 99;
		const picks = new Set<string>();
		for (let id = 0; id < 16; id += 1) picks.add(pickNaturePlant(id, seed));
		// 16 adjacent ids should land on > 1 distinct plant. Empirically
		// the XOR-mix gives ~10-15 distinct picks for any seed.
		expect(picks.size).toBeGreaterThan(1);
	});

	it("handles negative ids + seeds via unsigned-right-shift", () => {
		expect(NATURE_PLANT_URLS).toContain(pickNaturePlant(-1, -1));
	});
});
