/**
 * A3 — PostprocessingChain stepLowQuality state-machine pin.
 *
 * The chain mounts/unmounts Bloom based on a 2-window debounced fps
 * gate. The downgrade ladder mirrors AdaptiveResolution's
 * stepPixelRatio: avgFps <30 for 2 consecutive windows trips
 * `lowQuality=true`, avgFps >55 for 2 consecutive windows trips it
 * back to `false`. The in-band (30..55) range resets both counters.
 *
 * Source: PERF audit Architectural C.
 */

import { describe, expect, it } from "vitest";
import { stepLowQuality } from "../../scene/effects/PostprocessingChain";

describe("A3 — stepLowQuality state machine", () => {
	it("starts at full quality, in-band fps clears both counters", () => {
		const r = stepLowQuality({
			avgFps: 45,
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
			lowQuality: false,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		});
		expect(f1.lowQuality).toBe(false);
		expect(f1.consecutiveLow).toBe(1);

		const f2 = stepLowQuality({
			avgFps: 25,
			lowQuality: f1.lowQuality,
			consecutiveLow: f1.consecutiveLow,
			consecutiveHigh: f1.consecutiveHigh,
		});
		expect(f2.lowQuality).toBe(true);
		expect(f2.consecutiveLow).toBe(0);
	});

	it("one high window doesn't restore lowQuality (debounce)", () => {
		const r = stepLowQuality({
			avgFps: 58,
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
			lowQuality: true,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		});
		expect(f1.lowQuality).toBe(true);
		expect(f1.consecutiveHigh).toBe(1);

		const f2 = stepLowQuality({
			avgFps: 58,
			lowQuality: f1.lowQuality,
			consecutiveLow: f1.consecutiveLow,
			consecutiveHigh: f1.consecutiveHigh,
		});
		expect(f2.lowQuality).toBe(false);
		expect(f2.consecutiveHigh).toBe(0);
	});

	it("in-band fps after a low resets the low counter (no oscillation)", () => {
		const f1 = stepLowQuality({
			avgFps: 25,
			lowQuality: false,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		});
		expect(f1.consecutiveLow).toBe(1);

		// In-band window between two low windows must clear the streak.
		const f2 = stepLowQuality({
			avgFps: 45,
			lowQuality: f1.lowQuality,
			consecutiveLow: f1.consecutiveLow,
			consecutiveHigh: f1.consecutiveHigh,
		});
		expect(f2.consecutiveLow).toBe(0);

		const f3 = stepLowQuality({
			avgFps: 25,
			lowQuality: f2.lowQuality,
			consecutiveLow: f2.consecutiveLow,
			consecutiveHigh: f2.consecutiveHigh,
		});
		// Only 1 consecutive low again, still no flip.
		expect(f3.lowQuality).toBe(false);
		expect(f3.consecutiveLow).toBe(1);
	});

	it("boundary: avgFps=30 is in-band (not low)", () => {
		const r = stepLowQuality({
			avgFps: 30,
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
			lowQuality: true,
			consecutiveLow: 0,
			consecutiveHigh: 5,
		});
		expect(r.lowQuality).toBe(true);
		expect(r.consecutiveHigh).toBe(0);
	});

	it("idempotent: low fps when already lowQuality does not re-flip", () => {
		// Once lowQuality is true, additional low windows should not
		// keep clobbering the counter or re-triggering the transition.
		const f1 = stepLowQuality({
			avgFps: 25,
			lowQuality: true,
			consecutiveLow: 0,
			consecutiveHigh: 0,
		});
		expect(f1.lowQuality).toBe(true);
		expect(f1.consecutiveLow).toBe(1);

		const f2 = stepLowQuality({
			avgFps: 25,
			lowQuality: f1.lowQuality,
			consecutiveLow: f1.consecutiveLow,
			consecutiveHigh: f1.consecutiveHigh,
		});
		// counter resets to 0 on the "trigger" path but lowQuality stays true.
		expect(f2.lowQuality).toBe(true);
	});
});
