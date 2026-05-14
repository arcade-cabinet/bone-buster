/**
 * COV10 step-1 — vehicle wreck pool contract.
 */

import { describe, expect, it } from "vitest";
import { pickVehicleUrl, VEHICLE_VARIANTS } from "../../vehicles";

describe("COV10 — vehicle wreck pool", () => {
	it("ships ≥1 vehicle variant (PRD: 'at least one wrecked-vehicle prop')", () => {
		expect(VEHICLE_VARIANTS.length).toBeGreaterThanOrEqual(1);
	});

	it("ships all 3 from the PS1-RVS pack", () => {
		expect(VEHICLE_VARIANTS).toHaveLength(3);
	});

	it("every URL resolves to /assets/models/props/vehicles/RV*.glb", () => {
		for (const url of VEHICLE_VARIANTS) {
			expect(url).toMatch(/\/assets\/models\/props\/vehicles\/RV[1-3]\.glb$/);
		}
	});

	it("URLs are unique", () => {
		expect(new Set(VEHICLE_VARIANTS).size).toBe(VEHICLE_VARIANTS.length);
	});
});

describe("COV10 — pickVehicleUrl", () => {
	it("is deterministic", () => {
		expect(pickVehicleUrl(42)).toBe(pickVehicleUrl(42));
	});

	it("returns a URL from VEHICLE_VARIANTS for any seed", () => {
		for (let s = 0; s < 30; s += 1) {
			expect(VEHICLE_VARIANTS).toContain(pickVehicleUrl(s));
		}
	});

	it("all variants reachable across seeds 0..N-1", () => {
		const seen = new Set<string>();
		for (let s = 0; s < VEHICLE_VARIANTS.length; s += 1) {
			seen.add(pickVehicleUrl(s));
		}
		expect(seen.size).toBe(VEHICLE_VARIANTS.length);
	});

	it("handles negative seeds via unsigned right-shift", () => {
		expect(VEHICLE_VARIANTS).toContain(pickVehicleUrl(-1));
	});
});
