/**
 * COV13 step-1 — kitchen prop pool contract.
 */

import { describe, expect, it } from "vitest";
import { KITCHEN_PROPS, pickKitchenProp } from "../../kitchen";

describe("COV13 — kitchen prop pool", () => {
	it("ships ≥6 kitchen props (enough for a sector-scatter pool)", () => {
		expect(KITCHEN_PROPS.length).toBeGreaterThanOrEqual(6);
	});

	it("every URL resolves to /assets/models/props/kitchen/*.glb", () => {
		for (const url of KITCHEN_PROPS) {
			expect(url).toMatch(/\/assets\/models\/props\/kitchen\/[A-Za-z0-9_]+\.glb$/);
		}
	});

	it("URLs are unique", () => {
		expect(new Set(KITCHEN_PROPS).size).toBe(KITCHEN_PROPS.length);
	});
});

describe("COV13 — pickKitchenProp", () => {
	it("is deterministic", () => {
		expect(pickKitchenProp(42)).toBe(pickKitchenProp(42));
	});

	it("returns a URL from KITCHEN_PROPS for any hash", () => {
		for (let h = 0; h < 50; h += 1) {
			expect(KITCHEN_PROPS).toContain(pickKitchenProp(h));
		}
	});

	it("all variants reachable across hashes 0..N-1", () => {
		const seen = new Set<string>();
		for (let h = 0; h < KITCHEN_PROPS.length; h += 1) {
			seen.add(pickKitchenProp(h));
		}
		expect(seen.size).toBe(KITCHEN_PROPS.length);
	});

	it("handles negative hashes via unsigned right-shift", () => {
		expect(KITCHEN_PROPS).toContain(pickKitchenProp(-1));
	});
});
