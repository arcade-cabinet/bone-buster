/**
 * STRUCT5 — weighted biome-pressure selection contract.
 */

import { ARCHETYPE_NAMES } from "@world/archetype";
import { type BiomePressure, initialBiomePressure, pickBiome } from "@world/biomePressure";
import { describe, expect, it } from "vitest";

/** Deterministic RNG returning a fixed value (for weighted-roll boundary tests). */
const fixed = (v: number) => () => v;
/** Cycling RNG over a list (for distribution tests). */
function seq(values: number[]) {
	let i = 0;
	return () => values[i++ % values.length] ?? 0;
}

describe("STRUCT5 — pickBiome", () => {
	it("initialBiomePressure is all-zero for every biome", () => {
		const p = initialBiomePressure();
		for (const b of ARCHETYPE_NAMES) expect(p[b]).toBe(0);
	});

	it("picked biome → pressure 0; every other biome → +1", () => {
		const p = initialBiomePressure();
		const { biome, pressure } = pickBiome(p, fixed(0)); // roll 0 → top rank
		expect(pressure[biome]).toBe(0);
		for (const b of ARCHETYPE_NAMES) {
			if (b !== biome) expect(pressure[b]).toBe(1);
		}
	});

	it("favors the stalest biome at low rolls (roll≈0 → highest pressure)", () => {
		const p = initialBiomePressure();
		// Make "sewer" the stalest.
		p.sewer = 10;
		const { biome } = pickBiome(p, fixed(0)); // smallest roll → rank 0 = stalest
		expect(biome).toBe("sewer");
	});

	it("is deterministic given the same pressure + rng draw", () => {
		const p = initialBiomePressure();
		p.library = 3;
		const a = pickBiome(p, fixed(0.42));
		const b = pickBiome(p, fixed(0.42));
		expect(a.biome).toBe(b.biome);
		expect(JSON.stringify(a.pressure)).toBe(JSON.stringify(b.pressure));
	});

	it("every biome is reachable over many rolls (no starvation)", () => {
		let p: BiomePressure = initialBiomePressure();
		const seen = new Set<string>();
		const rng = seq([0.05, 0.4, 0.7, 0.97, 0.25, 0.55, 0.85, 0.15]);
		for (let i = 0; i < 200; i += 1) {
			const r = pickBiome(p, rng);
			seen.add(r.biome);
			p = r.pressure;
		}
		expect(seen.size).toBe(ARCHETYPE_NAMES.length); // all 5 biomes appeared
	});

	it("high rolls reach lower-ranked (fresher) biomes", () => {
		const p = initialBiomePressure();
		p.corridor = 10; // stalest → rank 0
		// roll ≈ 1 (just under total) lands in the tail ranks, NOT corridor.
		const { biome } = pickBiome(p, fixed(0.999));
		expect(biome).not.toBe("corridor");
	});
});
