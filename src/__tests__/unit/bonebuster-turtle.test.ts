import {
	decodeLevel,
	decodeRefLevel,
	levelBounds,
	listRefLevels,
	REF_LEVEL_COUNT,
	type RefLevelIndex,
} from "@ai/turtle";
import { describe, expect, it } from "vitest";

describe("bonebuster turtle-graphics decoder", () => {
	it("exposes the original five reference levels", () => {
		const levels = listRefLevels();
		expect(REF_LEVEL_COUNT).toBe(levels.length);
		expect(levels.length).toBeGreaterThanOrEqual(5);
		for (const l of levels) {
			expect(l.length).toBeGreaterThan(50);
		}
	});

	it("decodes each reference level into polygons + object specs", () => {
		for (let i = 0; i < REF_LEVEL_COUNT; i += 1) {
			const level = decodeRefLevel(i as RefLevelIndex);
			expect(level.polygons.length).toBeGreaterThan(2);
			expect(level.objects.length).toBeGreaterThan(0);
			for (const poly of level.polygons) {
				expect(poly.vertices.length).toBeGreaterThan(2);
				expect(typeof poly.floorHeight).toBe("number");
				expect(typeof poly.ceilingHeight).toBe("number");
			}
			for (const obj of level.objects) {
				expect(obj.classIdx).toBeGreaterThanOrEqual(0);
				expect(obj.classIdx).toBeLessThan(32);
				expect(Number.isFinite(obj.position.x)).toBe(true);
				expect(Number.isFinite(obj.position.y)).toBe(true);
				expect(Number.isFinite(obj.position.z)).toBe(true);
			}
		}
	});

	it("returns deterministic decoded levels", () => {
		const a = decodeRefLevel(0);
		const b = decodeRefLevel(0);
		expect(a.polygons).toEqual(b.polygons);
		expect(a.objects).toEqual(b.objects);
	});

	it("reports finite bounding box for each reference level", () => {
		for (let i = 0; i < REF_LEVEL_COUNT; i += 1) {
			const level = decodeRefLevel(i as RefLevelIndex);
			const bb = levelBounds(level);
			expect(bb.maxX).toBeGreaterThanOrEqual(bb.minX);
			expect(bb.maxY).toBeGreaterThanOrEqual(bb.minY);
		}
	});

	it("rejects empty input without throwing", () => {
		expect(() => decodeLevel("")).not.toThrow();
		const empty = decodeLevel("");
		expect(empty.polygons.length).toBe(0);
		expect(empty.objects.length).toBe(0);
	});
});
