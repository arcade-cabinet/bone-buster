/**
 * COV5 step-1 — debris variant pool contract.
 */

import { describe, expect, it } from "vitest";
import { DEBRIS_VARIANTS, pickDebrisUrl } from "../../debris";

describe("COV5 — debris pool", () => {
	it("ships ≥5 debris variants (PRD acceptance)", () => {
		expect(DEBRIS_VARIANTS.length).toBeGreaterThanOrEqual(5);
	});

	it("every URL resolves to /assets/models/props/debris/*.glb", () => {
		for (const url of DEBRIS_VARIANTS) {
			expect(url).toMatch(/\/assets\/models\/props\/debris\/[a-z0-9_]+\.glb$/);
		}
	});

	it("URLs are unique across the pool", () => {
		expect(new Set(DEBRIS_VARIANTS).size).toBe(DEBRIS_VARIANTS.length);
	});
});

describe("COV5 — pickDebrisUrl", () => {
	it("is deterministic — same hash → same URL", () => {
		expect(pickDebrisUrl(42)).toBe(pickDebrisUrl(42));
	});

	it("returns a URL from DEBRIS_VARIANTS for any hash", () => {
		for (let h = 0; h < 100; h += 1) {
			expect(DEBRIS_VARIANTS).toContain(pickDebrisUrl(h));
		}
	});

	it("all variants reachable across hashes 0..N-1", () => {
		const seen = new Set<string>();
		for (let h = 0; h < DEBRIS_VARIANTS.length; h += 1) {
			seen.add(pickDebrisUrl(h));
		}
		expect(seen.size).toBe(DEBRIS_VARIANTS.length);
	});

	it("handles negative hash via unsigned-right-shift", () => {
		expect(DEBRIS_VARIANTS).toContain(pickDebrisUrl(-1));
	});
});
