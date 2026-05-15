/**
 * COV7 step-1 — door variant pool contract.
 *
 * Pins:
 *  - ≥3 door variants ship (PRD acceptance: "cycle through ≥3 variants").
 *  - Every URL resolves to /assets/models/props/doors/*.glb.
 *  - pickDoorUrl is deterministic per seed.
 *  - All variants are reachable across consecutive seeds 0..n.
 *  - Negative seeds handled safely.
 */

import { describe, expect, it } from "vitest";
import { DOOR_VARIANTS, pickDoorUrl } from "../../doors";

describe("COV7 — door variant pool", () => {
	it("ships ≥3 door variants (PRD acceptance criterion)", () => {
		expect(DOOR_VARIANTS.length).toBeGreaterThanOrEqual(3);
	});

	it("every variant URL resolves to /assets/models/props/doors/*.glb", () => {
		for (const url of DOOR_VARIANTS) {
			expect(url).toMatch(/\/assets\/models\/props\/doors\/[a-z0-9_]+\.glb$/);
		}
	});

	it("URLs are unique across the pool", () => {
		expect(new Set(DOOR_VARIANTS).size).toBe(DOOR_VARIANTS.length);
	});
});

describe("COV7 — pickDoorUrl", () => {
	it("is deterministic — same seed → same URL", () => {
		expect(pickDoorUrl(42)).toBe(pickDoorUrl(42));
	});

	it("returns a variant from DOOR_VARIANTS for any seed", () => {
		for (let seed = 0; seed < 50; seed += 1) {
			expect(DOOR_VARIANTS).toContain(pickDoorUrl(seed));
		}
	});

	it("all variants are reachable across seeds 0..DOOR_VARIANTS.length-1", () => {
		const seen = new Set<string>();
		for (let seed = 0; seed < DOOR_VARIANTS.length; seed += 1) {
			seen.add(pickDoorUrl(seed));
		}
		expect(seen.size).toBe(DOOR_VARIANTS.length);
	});

	it("handles negative seeds via unsigned right-shift", () => {
		const url = pickDoorUrl(-1);
		expect(DOOR_VARIANTS).toContain(url);
	});
});
