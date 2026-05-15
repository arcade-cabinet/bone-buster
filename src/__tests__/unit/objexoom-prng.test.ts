import { describe, expect, it } from "vitest";
import { mulberry32, RNG_TAGS } from "../../prng";

/**
 * CONV1 — byte-stability snapshot for the canonical mulberry32 PRNG.
 *
 * These golden values were captured from the pre-CONV1 implementation
 * (12 inline copies across engine/barrels/scatter, all byte-identical
 * for non-negative seeds). If any value below changes, canonical
 * screenshots will drift — DON'T re-bless without explicit reason.
 *
 * Seeds chosen: 0 (corridor canonical anchor), 1 (arena), 2 (courtyard),
 * 3 (sewer), 4 (library), 12345 (common test seed), 0xdeadbeef (debug).
 */

describe("CONV1 — mulberry32 byte-stability", () => {
	it("seed=0 produces canonical-anchor stream", () => {
		const rng = mulberry32(0);
		expect([rng(), rng(), rng(), rng(), rng()]).toEqual([
			0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111,
			0.46732782293111086,
		]);
	});

	it("seed=12345 produces stable stream", () => {
		const rng = mulberry32(12345);
		expect([rng(), rng(), rng(), rng(), rng()]).toEqual([
			0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203,
			0.5094283693470061,
		]);
	});

	it("seed=0xdeadbeef produces stable stream", () => {
		const rng = mulberry32(0xdeadbeef);
		expect([rng(), rng(), rng(), rng(), rng()]).toEqual([
			0.9413696140982211, 0.26719574979506433, 0.772033357527107, 0.35816076025366783,
			0.47554167779162526,
		]);
	});

	it("each per-archetype canonical seed produces a distinct first value", () => {
		const heads = [0, 1, 2, 3, 4].map((s) => mulberry32(s)());
		// Must all be distinct — if any two collide the scatter streams
		// for two archetypes would align.
		expect(new Set(heads).size).toBe(5);
	});
});

describe("CONV1 — RNG_TAGS registry", () => {
	it("all tag values are ASCII-packed and stable", () => {
		expect(RNG_TAGS.LMP).toBe(0x4c4d50);
		expect(RNG_TAGS.PROP).toBe(0x50524f50);
		expect(RNG_TAGS.FLRT).toBe(0x464c5254);
		expect(RNG_TAGS.DEBR).toBe(0x44455242);
		expect(RNG_TAGS.LARP).toBe(0x4c415250);
		expect(RNG_TAGS.TRAP).toBe(0x54524150);
		expect(RNG_TAGS.KTCH).toBe(0x4b544348);
		expect(RNG_TAGS.NATU).toBe(0x4e415455);
		expect(RNG_TAGS.NPCS).toBe(0x4e504353);
		expect(RNG_TAGS.ENMX).toBe(0x454e4d58);
	});

	it("all tag values are distinct (no XOR collisions)", () => {
		const values = Object.values(RNG_TAGS);
		expect(new Set(values).size).toBe(values.length);
	});

	it("tagged stream diverges from untagged for same map seed", () => {
		const seed = 12345;
		const untagged = mulberry32(seed)();
		const tagged = mulberry32((seed >>> 0) ^ RNG_TAGS.PROP)();
		expect(untagged).not.toBe(tagged);
	});
});
