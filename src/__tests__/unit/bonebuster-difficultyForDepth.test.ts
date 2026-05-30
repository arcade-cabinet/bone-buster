/**
 * STRUCT3 — logarithmic depth difficulty curve contract.
 */

import { difficultyForDepth } from "@engine/maze/difficulty";
import { describe, expect, it } from "vitest";

describe("STRUCT3 — difficultyForDepth", () => {
	it("is exactly 1 at depth 0 (preserves the canonical baseline)", () => {
		expect(difficultyForDepth(0)).toBe(1);
		// negative / NaN-ish guards collapse to 1 too.
		expect(difficultyForDepth(-3)).toBe(1);
	});

	it("is monotonic non-decreasing in depth", () => {
		let prev = difficultyForDepth(0);
		for (let d = 1; d <= 40; d += 1) {
			const cur = difficultyForDepth(d);
			expect(cur).toBeGreaterThanOrEqual(prev);
			prev = cur;
		}
	});

	it("is sub-linear — grows slower than depth (log curve, not linear)", () => {
		// At depth 10 a linear 1+0.55·depth would be 6.5; the log curve is far below.
		expect(difficultyForDepth(10)).toBeLessThan(1 + 0.55 * 10);
		// The early jump (0→1) is bigger than a much-later jump (20→21).
		const early = difficultyForDepth(1) - difficultyForDepth(0);
		const late = difficultyForDepth(21) - difficultyForDepth(20);
		expect(early).toBeGreaterThan(late);
	});

	it("is bounded by the ceiling (endless runs stay survivable)", () => {
		expect(difficultyForDepth(1000)).toBeLessThanOrEqual(3.0);
		expect(difficultyForDepth(50)).toBeLessThanOrEqual(3.0);
	});

	it("climbs meaningfully early (deeper feels harder)", () => {
		expect(difficultyForDepth(1)).toBeGreaterThan(1.4);
		expect(difficultyForDepth(7)).toBeGreaterThan(2.0);
	});
});
