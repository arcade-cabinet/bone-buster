/**
 * PB5 step-1 — EMF reader contract tests.
 *
 * Pins the threshold table + edge cases for `pickEmfReading`.
 * Pure-function tests; the HUD chip + ownership wiring land in
 * separate commits with their own tests.
 */

import { EMF_TOKEN, type EmfReading, pickEmfReading } from "@world/ghostHunting";
import { describe, expect, it } from "vitest";

describe("PB5 step-1 — pickEmfReading thresholds", () => {
	it("returns 0 (no signal) for non-finite distance", () => {
		expect(pickEmfReading(Number.POSITIVE_INFINITY)).toBe(0);
		expect(pickEmfReading(Number.NaN)).toBe(0);
	});

	it("returns 5 (touching) for distance < 2 tiles", () => {
		expect(pickEmfReading(0)).toBe(5);
		expect(pickEmfReading(1)).toBe(5);
		expect(pickEmfReading(1.99)).toBe(5);
	});

	it("returns 4 for distance in [2, 4)", () => {
		expect(pickEmfReading(2)).toBe(4);
		expect(pickEmfReading(3.5)).toBe(4);
		expect(pickEmfReading(3.99)).toBe(4);
	});

	it("returns 3 for distance in [4, 8)", () => {
		expect(pickEmfReading(4)).toBe(3);
		expect(pickEmfReading(7.99)).toBe(3);
	});

	it("returns 2 for distance in [8, 16)", () => {
		expect(pickEmfReading(8)).toBe(2);
		expect(pickEmfReading(15.99)).toBe(2);
	});

	it("returns 1 for distance >= 16", () => {
		expect(pickEmfReading(16)).toBe(1);
		expect(pickEmfReading(100)).toBe(1);
		expect(pickEmfReading(1_000_000)).toBe(1);
	});

	it("treats negative distance (overlap / inside enemy) as the strongest reading", () => {
		// Comes up if the player walks through a phasing enemy. The
		// reading should pin at 5 rather than fall into an undefined
		// bucket.
		expect(pickEmfReading(-1)).toBe(5);
	});

	it("is monotonic non-increasing as distance grows", () => {
		// Property test: the reading never goes UP as the enemy gets
		// farther. Catches a future threshold rewrite that introduces
		// a non-monotonic step.
		let prev = pickEmfReading(0);
		for (let d = 0; d < 32; d += 0.5) {
			const cur = pickEmfReading(d);
			expect(cur).toBeLessThanOrEqual(prev);
			prev = cur;
		}
	});
});

describe("PB5 step-1 — EMF_TOKEN color ramp", () => {
	it("has a token for every reading 0..5", () => {
		for (const lvl of [0, 1, 2, 3, 4, 5] as EmfReading[]) {
			expect(EMF_TOKEN[lvl]).toMatch(/^[a-z]+\.\d+$/);
		}
	});

	it("0 (no signal) is keyed off the bone scale (neutral)", () => {
		expect(EMF_TOKEN[0]).toMatch(/^bone\./);
	});

	it("5 (touching) is keyed off the blood scale (urgent)", () => {
		expect(EMF_TOKEN[5]).toMatch(/^blood\./);
	});
});
