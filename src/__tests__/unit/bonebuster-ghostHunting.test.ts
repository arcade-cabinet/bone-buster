/**
 * PB5 step-1 — EMF reader contract tests.
 *
 * Pins the threshold table + edge cases for `pickEmfReading`.
 * Pure-function tests; the HUD chip + ownership wiring land in
 * separate commits with their own tests.
 */

import { ROLE } from "@styles/tokens/index";
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
			// Every entry must be a non-empty string — the resolved
			// shape (hex / rgba / linear-gradient) depends on the
			// underlying ROLE token, so the structural check is loose.
			// The semantic identity assertions below pin the mapping.
			expect(typeof EMF_TOKEN[lvl]).toBe("string");
			expect(EMF_TOKEN[lvl].length).toBeGreaterThan(0);
		}
	});

	it("0 (no signal) resolves through ROLE.textMuted", () => {
		expect(EMF_TOKEN[0]).toBe(ROLE.textMuted);
	});

	it("5 (touching) resolves through ROLE.actionFire (urgent)", () => {
		expect(EMF_TOKEN[5]).toBe(ROLE.actionFire);
	});

	it("middle bands escalate gain → pickup → warning → fire", () => {
		// PB5 fold — semantic ramp pinned to existing ROLE tokens.
		// Any future re-keying of the chip ramp has to update both
		// EMF_TOKEN and this test in lockstep — protects against
		// silent drift between the design intent (low = passive, high
		// = urgent) and the actual rendered color.
		expect(EMF_TOKEN[1]).toBe(ROLE.brand.bone3);
		expect(EMF_TOKEN[2]).toBe(ROLE.actionWin);
		expect(EMF_TOKEN[3]).toBe(ROLE.actionPickup);
		expect(EMF_TOKEN[4]).toBe(ROLE.actionHurt);
	});
});
