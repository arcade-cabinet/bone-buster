/**
 * COV3 step-2 — modular wall pool contract.
 */

import { describe, expect, it } from "vitest";
import { pickWallUrl, WALL_VARIANTS } from "../../structures";

describe("COV3 step-2 — wall variant pool", () => {
	it("ships at least 4 wall variants", () => {
		expect(WALL_VARIANTS.length).toBeGreaterThanOrEqual(4);
	});

	it("every URL resolves to /assets/models/structures/*.glb", () => {
		for (const url of WALL_VARIANTS) {
			expect(url).toMatch(/\/assets\/models\/structures\/[A-Za-z0-9_]+\.glb$/);
		}
	});

	it("variant URLs are unique", () => {
		expect(new Set(WALL_VARIANTS).size).toBe(WALL_VARIANTS.length);
	});
});

describe("COV3 step-2 — pickWallUrl", () => {
	it("is deterministic", () => {
		expect(pickWallUrl(42)).toBe(pickWallUrl(42));
		expect(pickWallUrl(7)).toBe(pickWallUrl(7));
	});

	it("returns a URL from WALL_VARIANTS for any hash", () => {
		for (let h = 0; h < 50; h += 1) {
			expect(WALL_VARIANTS).toContain(pickWallUrl(h));
		}
	});

	it("all variants are reachable across hashes 0..N", () => {
		const seen = new Set<string>();
		for (let h = 0; h < WALL_VARIANTS.length; h += 1) {
			seen.add(pickWallUrl(h));
		}
		expect(seen.size).toBe(WALL_VARIANTS.length);
	});

	it("handles negative hashes via unsigned right-shift", () => {
		expect(WALL_VARIANTS).toContain(pickWallUrl(-1));
		expect(WALL_VARIANTS).toContain(pickWallUrl(-12345));
	});
});
