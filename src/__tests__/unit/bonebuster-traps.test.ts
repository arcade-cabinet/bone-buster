/**
 * COV8 step-1 — trap pool contract.
 */

import { pickTrapDef, TRAPS, type TrapKind, trapsByKind } from "@world/traps";
import { describe, expect, it } from "vitest";

describe("COV8 — trap pool", () => {
	it("ships ≥6 traps (PRD acceptance: spike + blade + lever coverage)", () => {
		expect(TRAPS.length).toBeGreaterThanOrEqual(6);
	});

	it("covers all 4 trap kinds (spike, blade, rolling, trigger)", () => {
		const kinds = new Set(TRAPS.map((t) => t.kind));
		expect(kinds).toEqual(new Set(["spike", "blade", "rolling", "trigger"]));
	});

	it("every URL resolves to /assets/models/props/traps/*.glb", () => {
		for (const t of TRAPS) {
			expect(t.url).toMatch(/\/assets\/models\/props\/traps\/[A-Za-z0-9_]+\.glb$/);
		}
	});

	it("ids are unique", () => {
		expect(new Set(TRAPS.map((t) => t.id)).size).toBe(TRAPS.length);
	});
});

describe("COV8 — trapsByKind", () => {
	it("returns only entries of the requested kind", () => {
		for (const kind of ["spike", "blade", "rolling", "trigger"] satisfies TrapKind[]) {
			const filtered = trapsByKind(kind);
			expect(filtered.length).toBeGreaterThanOrEqual(1);
			for (const t of filtered) {
				expect(t.kind).toBe(kind);
			}
		}
	});
});

describe("COV8 — pickTrapDef", () => {
	it("is deterministic", () => {
		expect(pickTrapDef(42)).toBe(pickTrapDef(42));
	});

	it("returns a def from TRAPS for any hash", () => {
		for (let h = 0; h < 50; h += 1) {
			expect(TRAPS).toContain(pickTrapDef(h));
		}
	});

	it("handles negative hashes via unsigned right-shift", () => {
		expect(TRAPS).toContain(pickTrapDef(-1));
	});
});
