/**
 * A3 — PostprocessingChain stepLowQuality state-machine pin.
 *
 * The chain mounts/unmounts Bloom based on a 2-window debounced fps
 * gate that ALSO requires AdaptiveResolution to have bottomed out
 * its pixel-ratio ladder (≤ 0.55). The downgrade is the second
 * tier of quality drop, fired only after AdaptiveResolution has
 * exhausted its lever. Restore is asymmetric — avgFps >55 alone
 * trips back to full quality (we restore aggressively once
 * headroom returns).
 *
 * State machine lives in a pure `.ts` module so this test stays
 * out of React/postprocessing import graph.
 *
 * Source: PERF audit Architectural C + PR #56 review.
 */

import { describe, expect, it } from "vitest";
import { stepLowQuality } from "../../scene/effects/stepLowQuality";

/** Pixel ratio at AdaptiveResolution's floor. Below the
 * `PIXEL_RATIO_FLOOR_GATE` threshold, so trigger is armed. */
const AT_FLOOR = 0.5;
/** Pixel ratio while AdaptiveResolution still has headroom. Above
 * the gate, so trigger is disarmed regardless of FPS. */
const ABOVE_FLOOR = 1.5;

describe("A3 — stepLowQuality state machine", () => {
	it("starts at full quality, in-band fps clears both counters", () => {
		const r = stepLowQuality({
			avgFps: 45,
			pixelRatio: AT_FLOOR,
			lowQuality: false,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		});
		expect(r.lowQuality).toBe(false);
		expect(r.consecutiveLow).toBe(0);
		expect(r.consecutiveHigh).toBe(0);
	});

	it("one low window doesn't trip lowQuality (debounce)", () => {
		const r = stepLowQuality({
			avgFps: 25,
			pixelRatio: AT_FLOOR,
			lowQuality: false,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		});
		expect(r.lowQuality).toBe(false);
		expect(r.consecutiveLow).toBe(1);
		expect(r.consecutiveHigh).toBe(0);
	});

	it("two consecutive low windows flip to lowQuality=true", () => {
		const f1 = stepLowQuality({
			avgFps: 25,
			pixelRatio: AT_FLOOR,
			lowQuality: false,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		});
		expect(f1.lowQuality).toBe(false);
		expect(f1.consecutiveLow).toBe(1);

		const f2 = stepLowQuality({
			avgFps: 25,
			pixelRatio: AT_FLOOR,
			lowQuality: f1.lowQuality,
			consecutiveLow: f1.consecutiveLow,
			consecutiveHigh: f1.consecutiveHigh,
		});
		expect(f2.lowQuality).toBe(true);
		expect(f2.consecutiveLow).toBe(0);
	});

	it("low fps with pixel-ratio still above floor does NOT trip (tier gate)", () => {
		// AdaptiveResolution hasn't drained its lever yet — A3 must
		// wait. Two consecutive low windows at full pixel-ratio
		// should NOT flip lowQuality.
		const f1 = stepLowQuality({
			avgFps: 25,
			pixelRatio: ABOVE_FLOOR,
			lowQuality: false,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		});
		const f2 = stepLowQuality({
			avgFps: 25,
			pixelRatio: ABOVE_FLOOR,
			lowQuality: f1.lowQuality,
			consecutiveLow: f1.consecutiveLow,
			consecutiveHigh: f1.consecutiveHigh,
		});
		expect(f1.lowQuality).toBe(false);
		expect(f2.lowQuality).toBe(false);
		// Counter stays clear because the path is the in-band
		// fallback (no trigger arming).
		expect(f2.consecutiveLow).toBe(0);
	});

	it("one high window doesn't restore lowQuality (debounce)", () => {
		const r = stepLowQuality({
			avgFps: 58,
			pixelRatio: AT_FLOOR,
			lowQuality: true,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		});
		expect(r.lowQuality).toBe(true);
		expect(r.consecutiveLow).toBe(0);
		expect(r.consecutiveHigh).toBe(1);
	});

	it("two consecutive high windows flip back to lowQuality=false", () => {
		const f1 = stepLowQuality({
			avgFps: 58,
			pixelRatio: AT_FLOOR,
			lowQuality: true,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		});
		expect(f1.lowQuality).toBe(true);
		expect(f1.consecutiveHigh).toBe(1);

		const f2 = stepLowQuality({
			avgFps: 58,
			pixelRatio: AT_FLOOR,
			lowQuality: f1.lowQuality,
			consecutiveLow: f1.consecutiveLow,
			consecutiveHigh: f1.consecutiveHigh,
		});
		expect(f2.lowQuality).toBe(false);
		expect(f2.consecutiveHigh).toBe(0);
	});

	it("high-fps restore works regardless of pixel-ratio (asymmetric)", () => {
		// Restore is asymmetric — we restore as soon as headroom
		// returns, even if AdaptiveResolution hasn't yet raised PR
		// back. Otherwise lowQuality would stick forever after a
		// transient stall.
		const f1 = stepLowQuality({
			avgFps: 58,
			pixelRatio: AT_FLOOR,
			lowQuality: true,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		});
		const f2 = stepLowQuality({
			avgFps: 58,
			pixelRatio: AT_FLOOR,
			lowQuality: f1.lowQuality,
			consecutiveLow: f1.consecutiveLow,
			consecutiveHigh: f1.consecutiveHigh,
		});
		expect(f2.lowQuality).toBe(false);
	});

	it("in-band fps after a low resets the low counter (no oscillation)", () => {
		const f1 = stepLowQuality({
			avgFps: 25,
			pixelRatio: AT_FLOOR,
			lowQuality: false,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		});
		expect(f1.consecutiveLow).toBe(1);

		const f2 = stepLowQuality({
			avgFps: 45,
			pixelRatio: AT_FLOOR,
			lowQuality: f1.lowQuality,
			consecutiveLow: f1.consecutiveLow,
			consecutiveHigh: f1.consecutiveHigh,
		});
		expect(f2.consecutiveLow).toBe(0);

		const f3 = stepLowQuality({
			avgFps: 25,
			pixelRatio: AT_FLOOR,
			lowQuality: f2.lowQuality,
			consecutiveLow: f2.consecutiveLow,
			consecutiveHigh: f2.consecutiveHigh,
		});
		expect(f3.lowQuality).toBe(false);
		expect(f3.consecutiveLow).toBe(1);
	});

	it("boundary: avgFps=30 is in-band (not low)", () => {
		const r = stepLowQuality({
			avgFps: 30,
			pixelRatio: AT_FLOOR,
			lowQuality: false,
			consecutiveLow: 5,
			consecutiveHigh: 0,
		});
		expect(r.lowQuality).toBe(false);
		expect(r.consecutiveLow).toBe(0);
	});

	it("boundary: avgFps=55 is in-band (not high)", () => {
		const r = stepLowQuality({
			avgFps: 55,
			pixelRatio: AT_FLOOR,
			lowQuality: true,
			consecutiveLow: 0,
			consecutiveHigh: 5,
		});
		expect(r.lowQuality).toBe(true);
		expect(r.consecutiveHigh).toBe(0);
	});

	it("idempotent: low fps when already lowQuality does not increment counter", () => {
		const f1 = stepLowQuality({
			avgFps: 25,
			pixelRatio: AT_FLOOR,
			lowQuality: true,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		});
		expect(f1.lowQuality).toBe(true);
		expect(f1.consecutiveLow).toBe(0);

		const f2 = stepLowQuality({
			avgFps: 25,
			pixelRatio: AT_FLOOR,
			lowQuality: f1.lowQuality,
			consecutiveLow: f1.consecutiveLow,
			consecutiveHigh: f1.consecutiveHigh,
		});
		expect(f2.lowQuality).toBe(true);
		expect(f2.consecutiveLow).toBe(0);
	});

	it("idempotent: high fps when already full quality does not increment counter", () => {
		const f1 = stepLowQuality({
			avgFps: 58,
			pixelRatio: AT_FLOOR,
			lowQuality: false,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		});
		expect(f1.lowQuality).toBe(false);
		expect(f1.consecutiveHigh).toBe(0);
	});

	it("oscillation: alternating low/high never flips (debounce contract)", () => {
		const seq = [25, 58, 25, 58, 25, 58];
		let state = {
			lowQuality: false,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		};
		for (const fps of seq) {
			state = stepLowQuality({
				avgFps: fps,
				pixelRatio: AT_FLOOR,
				lowQuality: state.lowQuality,
				consecutiveLow: state.consecutiveLow,
				consecutiveHigh: state.consecutiveHigh,
			});
			expect(state.lowQuality).toBe(false);
		}
	});
});
