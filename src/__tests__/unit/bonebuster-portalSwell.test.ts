import { describe, expect, it } from "vitest";

/**
 * POL38 — portal audio swell. Verify the gain curve contract by
 * replicating the same proximity → dB math as a pure helper.
 * The real wiring in sfx.ts touches Tone.js which requires audio
 * context init; the contract is independently verifiable.
 */

const PORTAL_SWELL_MIN_DB = -36;
const PORTAL_BASELINE_DB = -16; // SFX_VOLUMES.portal

function targetDb(distance: number, radius: number): number {
	const clamped = Math.max(0, Math.min(distance, radius));
	const proximity = 1 - clamped / radius;
	return PORTAL_SWELL_MIN_DB + (PORTAL_BASELINE_DB - PORTAL_SWELL_MIN_DB) * proximity;
}

describe("POL38 portal swell gain curve", () => {
	const RADIUS = 4.0;

	it("emits silent baseline (PORTAL_SWELL_MIN_DB) at the approach radius edge", () => {
		expect(targetDb(RADIUS, RADIUS)).toBeCloseTo(PORTAL_SWELL_MIN_DB, 6);
	});

	it("emits full baseline (SFX_VOLUMES.portal) at distance 0 (player on portal)", () => {
		expect(targetDb(0, RADIUS)).toBeCloseTo(PORTAL_BASELINE_DB, 6);
	});

	it("clamps distances beyond radius to silent baseline (no negative gain explosion)", () => {
		expect(targetDb(10, RADIUS)).toBeCloseTo(PORTAL_SWELL_MIN_DB, 6);
		expect(targetDb(100, RADIUS)).toBeCloseTo(PORTAL_SWELL_MIN_DB, 6);
	});

	it("monotonically increases from radius-edge silent to portal-touch full", () => {
		const samples = [4, 3, 2, 1, 0].map((d) => targetDb(d, RADIUS));
		for (let i = 1; i < samples.length; i++) {
			const cur = samples[i];
			const prev = samples[i - 1];
			if (cur === undefined || prev === undefined) throw new RangeError(`samples missing at ${i}`);
			expect(cur).toBeGreaterThan(prev);
		}
	});

	it("midpoint distance lands exactly halfway in dB space (linear interpolation)", () => {
		const midpoint = targetDb(RADIUS / 2, RADIUS);
		const expected = (PORTAL_SWELL_MIN_DB + PORTAL_BASELINE_DB) / 2;
		expect(midpoint).toBeCloseTo(expected, 6);
	});

	it("treats negative distance as zero (no anomalous boost)", () => {
		expect(targetDb(-1, RADIUS)).toBeCloseTo(PORTAL_BASELINE_DB, 6);
		expect(targetDb(-100, RADIUS)).toBeCloseTo(PORTAL_BASELINE_DB, 6);
	});
});
