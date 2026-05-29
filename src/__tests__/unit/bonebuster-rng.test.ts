/**
 * SEED1 — family PRNG core + seed phrase. Pins the determinism contract:
 * same phrase → same stream; forked sub-streams diverge; phrase generation
 * is deterministic from a seeded event RNG (no Math.random in the sim core).
 */

import { advanceEventSeed, createEventPrng, createMapPrng, cyrb128, forkStream } from "@engine/rng";
import { CANONICAL_SEED_PHRASE, isSeedPhrase, randomSeedPhrase } from "@engine/seedPhrase";
import { describe, expect, it } from "vitest";

const draws = (rng: () => number, n = 8) => Array.from({ length: n }, () => rng());

describe("SEED1 — cyrb128", () => {
	it("is deterministic for a given string", () => {
		expect(cyrb128("rotten-cursed-ossuary")).toEqual(cyrb128("rotten-cursed-ossuary"));
	});
	it("returns four unsigned 32-bit ints", () => {
		const h = cyrb128("anything");
		expect(h).toHaveLength(4);
		for (const x of h) {
			expect(Number.isInteger(x)).toBe(true);
			expect(x).toBeGreaterThanOrEqual(0);
			expect(x).toBeLessThanOrEqual(0xffffffff);
		}
	});
	it("differs for different strings", () => {
		expect(cyrb128("a")).not.toEqual(cyrb128("b"));
	});
});

describe("SEED1 — createMapPrng", () => {
	it("same phrase → identical stream", () => {
		expect(draws(createMapPrng("rotten-cursed-ossuary"))).toEqual(
			draws(createMapPrng("rotten-cursed-ossuary")),
		);
	});
	it("different phrase → different stream", () => {
		expect(draws(createMapPrng("rotten-cursed-ossuary"))).not.toEqual(
			draws(createMapPrng("brittle-damned-crypt")),
		);
	});
	it("emits floats in [0,1)", () => {
		for (const v of draws(createMapPrng(CANONICAL_SEED_PHRASE), 50)) {
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
});

describe("SEED1 — forkStream", () => {
	it("same (phrase, tag) → identical stream", () => {
		expect(draws(forkStream("p", "PROP"))).toEqual(draws(forkStream("p", "PROP")));
	});
	it("different tags on the same phrase diverge", () => {
		expect(draws(forkStream("p", "PROP"))).not.toEqual(draws(forkStream("p", "TRAP")));
	});
	it("a fork diverges from the base map stream", () => {
		expect(draws(forkStream("p", "PROP"))).not.toEqual(draws(createMapPrng("p")));
	});
});

describe("SEED1 — event PRNG + seed phrase", () => {
	it("createEventPrng is deterministic per seed", () => {
		expect(draws(createEventPrng("evt-1"))).toEqual(draws(createEventPrng("evt-1")));
	});
	it("randomSeedPhrase is deterministic from a seeded event rng + well-formed", () => {
		const a = randomSeedPhrase(createEventPrng("evt-1"));
		const b = randomSeedPhrase(createEventPrng("evt-1"));
		expect(a).toBe(b);
		expect(isSeedPhrase(a)).toBe(true);
		expect(a.split("-")).toHaveLength(3);
	});
	it("different event seeds usually yield different phrases", () => {
		const phrases = new Set(
			["s1", "s2", "s3", "s4", "s5"].map((s) => randomSeedPhrase(createEventPrng(s))),
		);
		expect(phrases.size).toBeGreaterThan(1);
	});
	it("advanceEventSeed forks a new deterministic seed from a stream", () => {
		expect(advanceEventSeed(createEventPrng("evt-1"))).toBe(
			advanceEventSeed(createEventPrng("evt-1")),
		);
		expect(advanceEventSeed(createEventPrng("evt-1"))).not.toBe(
			advanceEventSeed(createEventPrng("evt-2")),
		);
	});
	it("CANONICAL_SEED_PHRASE is a well-formed phrase", () => {
		expect(isSeedPhrase(CANONICAL_SEED_PHRASE)).toBe(true);
	});
});
