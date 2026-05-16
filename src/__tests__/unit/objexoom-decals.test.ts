/**
 * COV6 step-1 — decal variant pool contract.
 *
 * Pins:
 *  - ≥12 decals total (4 graffiti + 8 posters from the pack).
 *  - URL pattern resolves to /assets/models/props/decals/*.glb.
 *  - pickDecalUrl deterministic + range-correct.
 *  - Graffiti + poster pools are disjoint and combine into ALL.
 */

import {
	DECAL_VARIANTS_ALL,
	DECAL_VARIANTS_GRAFFITI,
	DECAL_VARIANTS_POSTER,
	pickDecalUrl,
} from "@world/decals";
import { describe, expect, it } from "vitest";

describe("COV6 — decal pool", () => {
	it("ships ≥12 decals total (4 graffiti + 8 poster from the pack)", () => {
		expect(DECAL_VARIANTS_ALL.length).toBeGreaterThanOrEqual(12);
	});

	it("graffiti + poster pools are disjoint", () => {
		const graffiti = new Set(DECAL_VARIANTS_GRAFFITI);
		for (const url of DECAL_VARIANTS_POSTER) {
			expect(graffiti.has(url)).toBe(false);
		}
	});

	it("DECAL_VARIANTS_ALL is the union of graffiti + poster", () => {
		expect(DECAL_VARIANTS_ALL.length).toBe(
			DECAL_VARIANTS_GRAFFITI.length + DECAL_VARIANTS_POSTER.length,
		);
	});

	it("every URL resolves to /assets/models/props/decals/*.glb", () => {
		for (const url of DECAL_VARIANTS_ALL) {
			expect(url).toMatch(/\/assets\/models\/props\/decals\/[a-z0-9_]+\.glb$/);
		}
	});

	it("URLs are unique across the combined pool", () => {
		expect(new Set(DECAL_VARIANTS_ALL).size).toBe(DECAL_VARIANTS_ALL.length);
	});
});

describe("COV6 — pickDecalUrl", () => {
	it("is deterministic — same hash → same URL", () => {
		expect(pickDecalUrl(42)).toBe(pickDecalUrl(42));
	});

	it("returns a URL from DECAL_VARIANTS_ALL for any hash", () => {
		for (let h = 0; h < 100; h += 1) {
			expect(DECAL_VARIANTS_ALL).toContain(pickDecalUrl(h));
		}
	});

	it("all decals reachable across consecutive hashes 0..N-1", () => {
		const seen = new Set<string>();
		for (let h = 0; h < DECAL_VARIANTS_ALL.length; h += 1) {
			seen.add(pickDecalUrl(h));
		}
		expect(seen.size).toBe(DECAL_VARIANTS_ALL.length);
	});

	it("handles negative hash via unsigned-right-shift", () => {
		expect(DECAL_VARIANTS_ALL).toContain(pickDecalUrl(-1));
	});
});
