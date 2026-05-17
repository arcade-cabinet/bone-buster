import { COSMETIC_TAGS, cosmeticRng, pickCosmetic, pickCosmeticOnce } from "@engine/prng";
import { describe, expect, it } from "vitest";

/**
 * D19 — cosmetic stream byte-stability pins.
 *
 * Captured 2026-05-17 from `seedrandom@3.0.5` alea variant. If any value
 * below changes, cosmetic picks across runs will drift — DON'T re-bless
 * without an explicit decision note in DECISIONS.md.
 *
 * Seed=0 is NOT pinned here (it short-circuits to pool[0] in pickCosmetic
 * + pickCosmeticOnce); the canonical-screenshot battery covers that case.
 */

describe("D19 — COSMETIC_TAGS registry", () => {
	it("all tags are disjoint", () => {
		const values = Object.values(COSMETIC_TAGS);
		expect(new Set(values).size).toBe(values.length);
	});

	it("all tags occupy the 0xc0-prefixed cosmetic space", () => {
		for (const value of Object.values(COSMETIC_TAGS)) {
			expect(value >>> 24).toBe(0xc0);
		}
	});

	it("cosmetic tags are disjoint from canonical RNG_TAGS space", () => {
		// Canonical tops out below 0x55000000; cosmetic starts at 0xc0000000.
		for (const value of Object.values(COSMETIC_TAGS)) {
			expect(value >>> 0).toBeGreaterThanOrEqual(0xc0000000);
		}
	});
});

describe("D19 — cosmeticRng byte-stability anchors (alea)", () => {
	it("MELEE/seed=12345 head matches pin", () => {
		const rng = cosmeticRng(12345, COSMETIC_TAGS.MELEE);
		expect([rng(), rng(), rng()]).toEqual([
			0.1822824622504413, 0.7328460491262376, 0.5739091886207461,
		]);
	});

	it("PISTOL/seed=12345 head matches pin", () => {
		const rng = cosmeticRng(12345, COSMETIC_TAGS.PISTOL);
		expect([rng(), rng(), rng()]).toEqual([
			0.8521936757024378, 0.013030349975451827, 0.9096491250675172,
		]);
	});

	it("CHAINGUN/seed=12345 head matches pin", () => {
		const rng = cosmeticRng(12345, COSMETIC_TAGS.CHAINGUN);
		expect([rng(), rng(), rng()]).toEqual([
			0.2524120230227709, 0.909321645507589, 0.7026964346878231,
		]);
	});

	it("PLANT/seed=12345 head matches pin", () => {
		const rng = cosmeticRng(12345, COSMETIC_TAGS.PLANT);
		expect([rng(), rng(), rng()]).toEqual([
			0.4571029054932296, 0.31870506913401186, 0.6322485832497478,
		]);
	});

	it("PHONEME/seed=12345 head matches pin", () => {
		const rng = cosmeticRng(12345, COSMETIC_TAGS.PHONEME);
		expect([rng(), rng(), rng()]).toEqual([
			0.01680173142813146, 0.4761326089501381, 0.9682235273066908,
		]);
	});

	it("MISC/seed=12345 head matches pin", () => {
		const rng = cosmeticRng(12345, COSMETIC_TAGS.MISC);
		expect([rng(), rng(), rng()]).toEqual([
			0.0004204327706247568, 0.1054447153583169, 0.18594496534205973,
		]);
	});

	it("different tags yield distinct streams for same seed", () => {
		const heads = Object.values(COSMETIC_TAGS).map((tag) => cosmeticRng(12345, tag)());
		// All six tags produce six distinct first outputs at the same seed.
		expect(new Set(heads).size).toBe(heads.length);
	});

	it("each canonical archetype seed (1..4) produces a distinct head per tag", () => {
		// Same property the canonical mulberry32 test enforces — divergence
		// across archetypes is what keeps cross-archetype cosmetic streams
		// from accidentally aligning.
		for (const tag of Object.values(COSMETIC_TAGS)) {
			const heads = [1, 2, 3, 4].map((s) => cosmeticRng(s, tag)());
			expect(new Set(heads).size).toBe(4);
		}
	});
});

describe("D19 — pickCosmetic / pickCosmeticOnce canonical baseline", () => {
	const POOL = ["a", "b", "c", "d", "e"] as const;

	it("pickCosmetic(0, *, *, pool) always returns pool[0]", () => {
		// The canonical-screenshot guarantee. ANY tag, ANY instanceId — seed=0
		// short-circuits to the canonical baseline.
		for (const tag of Object.values(COSMETIC_TAGS)) {
			for (const id of [0, 1, 2, 17, 1000, 0xffffffff]) {
				expect(pickCosmetic(0, tag, id, POOL)).toBe("a");
			}
		}
	});

	it("pickCosmeticOnce(0, *, pool) always returns pool[0]", () => {
		for (const tag of Object.values(COSMETIC_TAGS)) {
			expect(pickCosmeticOnce(0, tag, POOL)).toBe("a");
		}
	});

	it("pickCosmetic at non-zero seed is deterministic per (seed, tag, id)", () => {
		const a = pickCosmetic(12345, COSMETIC_TAGS.MELEE, 7, POOL);
		const b = pickCosmetic(12345, COSMETIC_TAGS.MELEE, 7, POOL);
		expect(a).toBe(b);
	});

	it("pickCosmetic spreads adjacent ids across the pool", () => {
		const picks = new Set<string>();
		for (let id = 0; id < 50; id++) {
			picks.add(pickCosmetic(12345, COSMETIC_TAGS.PLANT, id, POOL));
		}
		// 50 ids into a 5-pool should hit every entry.
		expect(picks.size).toBe(POOL.length);
	});

	it("pickCosmetic throws on empty pool", () => {
		expect(() => pickCosmetic(1, COSMETIC_TAGS.MELEE, 0, [])).toThrow(/empty pool/);
	});

	it("pickCosmeticOnce throws on empty pool", () => {
		expect(() => pickCosmeticOnce(1, COSMETIC_TAGS.MELEE, [])).toThrow(/empty pool/);
	});

	it("pickCosmetic distributes across the pool when tags vary (seed + id fixed)", () => {
		// Spread test: same seed + id, all tags — should hit at least 2 distinct
		// pool entries across the six tags. (Cannot hit 5 distinct picks since
		// there are 6 tags landing in a 5-pool — pigeon-hole forces ≥1 collision.)
		const picks = new Set(
			Object.values(COSMETIC_TAGS).map((tag) => pickCosmetic(12345, tag, 0, POOL)),
		);
		expect(picks.size).toBeGreaterThanOrEqual(2);
	});
});
