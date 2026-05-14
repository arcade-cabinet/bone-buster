/**
 * COV2 step-1 — large-prop variant pool contract.
 */

import { describe, expect, it } from "vitest";
import { LARGE_PROPS, pickLargePropDef } from "../../largeProps";

describe("COV2 — large-prop pool", () => {
	it("ships ≥6 large-prop variants (PRD acceptance)", () => {
		expect(LARGE_PROPS.length).toBeGreaterThanOrEqual(6);
	});

	it("every URL resolves to /assets/models/props/large/*.glb", () => {
		for (const prop of LARGE_PROPS) {
			expect(prop.url).toMatch(/\/assets\/models\/props\/large\/[a-z0-9_]+\.glb$/);
		}
	});

	it("ids are unique across the pool", () => {
		const ids = new Set(LARGE_PROPS.map((p) => p.id));
		expect(ids.size).toBe(LARGE_PROPS.length);
	});

	it("has both blocking and non-blocking entries (PRD: 'some collision-blocking, some pass-through')", () => {
		expect(LARGE_PROPS.some((p) => p.blocking)).toBe(true);
		expect(LARGE_PROPS.some((p) => !p.blocking)).toBe(true);
	});
});

describe("COV2 — pickLargePropDef", () => {
	it("is deterministic — same hash → same def", () => {
		expect(pickLargePropDef(42)).toBe(pickLargePropDef(42));
	});

	it("returns an entry from LARGE_PROPS for any hash", () => {
		for (let h = 0; h < 100; h += 1) {
			expect(LARGE_PROPS).toContain(pickLargePropDef(h));
		}
	});

	it("all entries reachable across hashes 0..N-1", () => {
		const seen = new Set<string>();
		for (let h = 0; h < LARGE_PROPS.length; h += 1) {
			seen.add(pickLargePropDef(h).id);
		}
		expect(seen.size).toBe(LARGE_PROPS.length);
	});

	it("handles negative hash via unsigned-right-shift", () => {
		expect(LARGE_PROPS).toContain(pickLargePropDef(-1));
	});
});
