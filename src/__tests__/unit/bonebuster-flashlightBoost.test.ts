import { describe, expect, it } from "vitest";
import { computeBoostedIntensity } from "../../scene/effects/Flashlight";

/**
 * POL39 — flashlight pickup intensity boost envelope.
 *
 * Contract:
 *   - At t=0 the spotLight intensity is at PEAK (1.8 × 1.4 = 2.52)
 *   - Over 220ms it decays via ease-out-cubic to BASELINE (1.4)
 *   - Outside the window: baseline
 *   - Boost start = -Infinity (never fired): baseline
 */

const BASELINE = 1.4;
const PEAK = 1.8 * 1.4;

describe("POL39 flashlight boost envelope", () => {
	it("returns baseline when no boost has fired (boostStart = -Infinity)", () => {
		expect(computeBoostedIntensity(0, Number.NEGATIVE_INFINITY)).toBeCloseTo(BASELINE, 6);
		expect(computeBoostedIntensity(99999, Number.NEGATIVE_INFINITY)).toBeCloseTo(BASELINE, 6);
	});

	it("is at PEAK at the boost moment (t=0)", () => {
		expect(computeBoostedIntensity(1000, 1000)).toBeCloseTo(PEAK, 6);
	});

	it("decays back to baseline at the end of the 220ms window", () => {
		expect(computeBoostedIntensity(1220, 1000)).toBeCloseTo(BASELINE, 6);
	});

	it("returns baseline before boost start (negative elapsed)", () => {
		expect(computeBoostedIntensity(900, 1000)).toBeCloseTo(BASELINE, 6);
	});

	it("returns baseline after the window expires", () => {
		expect(computeBoostedIntensity(1500, 1000)).toBeCloseTo(BASELINE, 6);
		expect(computeBoostedIntensity(99999, 1000)).toBeCloseTo(BASELINE, 6);
	});

	it("is monotonically decreasing across the window (ease-out from peak to baseline)", () => {
		const samples = [0, 50, 100, 150, 200, 220].map((dt) =>
			computeBoostedIntensity(1000 + dt, 1000),
		);
		for (let i = 1; i < samples.length; i++) {
			expect(samples[i]).toBeLessThanOrEqual(samples[i - 1] + 1e-6);
		}
	});

	it("at midpoint (110ms) the cubic decay has 1/8 of the boost remaining", () => {
		// ease-out-cubic at t=0.5 has decay = (1-0.5)^3 = 0.125
		const mid = computeBoostedIntensity(1110, 1000);
		const expected = BASELINE + (PEAK - BASELINE) * 0.125;
		expect(mid).toBeCloseTo(expected, 6);
	});
});
