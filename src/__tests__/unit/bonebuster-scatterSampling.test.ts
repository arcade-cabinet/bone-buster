/**
 * CR-M1 — shared scatter sampling primitives. Pins the extracted bboxOf /
 * nearAny / scatterId so the 7 scatter modules that now share them have one
 * tested contract (was 6 byte-identical copies + a 100-vs-1000 id-stride drift).
 */

import { bboxOf, nearAny, SCATTER_ID_STRIDE, scatterId } from "@world/scatter/sampling";
import { describe, expect, it } from "vitest";

describe("CR-M1 — bboxOf", () => {
	it("computes the AABB of a polygon", () => {
		const box = bboxOf([
			{ x: -2, y: 1 },
			{ x: 5, y: -3 },
			{ x: 0, y: 8 },
		]);
		expect(box).toEqual({ minX: -2, maxX: 5, minY: -3, maxY: 8 });
	});
	it("handles a single vertex (degenerate box)", () => {
		expect(bboxOf([{ x: 3, y: 4 }])).toEqual({ minX: 3, maxX: 3, minY: 4, maxY: 4 });
	});
});

describe("CR-M1 — nearAny", () => {
	const others = [
		{ x: 0, y: 0 },
		{ x: 10, y: 10 },
	];
	it("true when within radius of some point", () => {
		expect(nearAny({ x: 1, y: 0 }, others, 2)).toBe(true);
	});
	it("false when outside radius of all points", () => {
		expect(nearAny({ x: 5, y: 5 }, others, 2)).toBe(false);
	});
	it("strict <: a point exactly `radius` away is NOT near (matches original)", () => {
		expect(nearAny({ x: 2, y: 0 }, [{ x: 0, y: 0 }], 2)).toBe(false);
	});
	it("empty others → false", () => {
		expect(nearAny({ x: 0, y: 0 }, [], 5)).toBe(false);
	});
});

describe("CR-M1 — scatterId", () => {
	it("composes sectorId * stride + index", () => {
		expect(scatterId(3, 7)).toBe(3 * SCATTER_ID_STRIDE + 7);
		expect(SCATTER_ID_STRIDE).toBe(1000);
	});
	it("ids are globally unique across sectors for in-range indices", () => {
		const ids = new Set<number>();
		for (let s = 0; s < 20; s++) {
			for (let i = 0; i < 50; i++) ids.add(scatterId(s, i));
		}
		expect(ids.size).toBe(20 * 50);
	});
	it("dev-asserts an out-of-range index (would collide across sectors)", () => {
		expect(() => scatterId(0, SCATTER_ID_STRIDE)).toThrow(RangeError);
		expect(() => scatterId(0, -1)).toThrow(RangeError);
	});
});
