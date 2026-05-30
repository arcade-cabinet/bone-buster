/**
 * STRUCT1b — descent-transition seed-advance invariant (regression guard).
 *
 * The endless descent picks the next biome on every level clear via the buried
 * EVENT seed: `pickBiome(pressure, createEventPrng(seed))`, then ADVANCES +
 * persists the seed so the NEXT pick draws a fresh stream position. This file
 * pins the contract the Shell `advanceBiome` wiring must uphold — it guards the
 * bug that ALREADY SHIPPED ONCE: rebuilding `createEventPrng` from an UNCHANGED
 * seed every transition returned the identical roll, so biome order collapsed to
 * a pure function of pressure (the "never predictable" promise was broken).
 *
 * We simulate the transition loop with the same primitives Shell.advanceBiome
 * uses (createEventPrng + pickBiome + advanceEventSeed). The Shell closure itself
 * is integration-tested via the screenshot/e2e flow; this is the deterministic
 * unit guard for the seam.
 */

import { advanceEventSeed, createEventPrng } from "@engine/rng";
import { initialBiomePressure, pickBiome } from "@world/biomePressure";
import { describe, expect, it } from "vitest";

/** One transition: pick the next biome, then advance the event seed (the seam). */
function transition(seed: string, pressure: ReturnType<typeof initialBiomePressure>) {
	const rng = createEventPrng(seed);
	const { biome, pressure: nextPressure } = pickBiome(pressure, rng);
	const nextSeed = advanceEventSeed(createEventPrng(seed));
	return { biome, nextPressure, nextSeed };
}

describe("STRUCT1b — descent transition", () => {
	it("advances the event seed on every transition (no frozen stream)", () => {
		let seed = "descent-anchor";
		const seeds = new Set<string>([seed]);
		let pressure = initialBiomePressure();
		for (let i = 0; i < 8; i += 1) {
			const t = transition(seed, pressure);
			// The seed MUST change each transition — a repeated seed is the bug.
			expect(t.nextSeed).not.toBe(seed);
			expect(seeds.has(t.nextSeed)).toBe(false);
			seeds.add(t.nextSeed);
			seed = t.nextSeed;
			pressure = t.nextPressure;
		}
		// 8 transitions → 9 distinct seeds (start + 8 advances).
		expect(seeds.size).toBe(9);
	});

	it("does NOT produce a frozen biome repeat across the descent", () => {
		let seed = "variety-anchor";
		let pressure = initialBiomePressure();
		const biomes: string[] = [];
		for (let i = 0; i < 10; i += 1) {
			const t = transition(seed, pressure);
			biomes.push(t.biome);
			seed = t.nextSeed;
			pressure = t.nextPressure;
		}
		// The exact regression symptom was the SAME biome (or a rigid rote cycle)
		// every level. Require more than one distinct biome over 10 levels.
		expect(new Set(biomes).size).toBeGreaterThan(1);
	});

	it("is fully deterministic given the same starting seed", () => {
		function run(start: string): string[] {
			let seed = start;
			let pressure = initialBiomePressure();
			const out: string[] = [];
			for (let i = 0; i < 6; i += 1) {
				const t = transition(seed, pressure);
				out.push(t.biome);
				seed = t.nextSeed;
				pressure = t.nextPressure;
			}
			return out;
		}
		expect(run("repro-seed")).toEqual(run("repro-seed"));
	});
});
