/**
 * A3 — pure state-machine for the `lowQuality` flag that gates
 * Bloom in the PostprocessingChain. Lives in its own `.ts` module
 * (not the `.tsx` component file) so the unit test can import it
 * without pulling React + @react-three/postprocessing into the
 * dependency graph.
 *
 *  - avgFps < 30 AND pixelRatio at floor (≤ 0.55, i.e.
 *    AdaptiveResolution's downgrade ladder has bottomed out):
 *    increment `consecutiveLow`, reset `consecutiveHigh`. On the
 *    2nd consecutive low, set `lowQuality=true`.
 *  - avgFps > 55 (any pixelRatio): increment `consecutiveHigh`,
 *    reset `consecutiveLow`. On the 2nd consecutive high, set
 *    `lowQuality=false`. Restore is asymmetric — we restore
 *    aggressively because the user has earned headroom, but only
 *    drop quality after AdaptiveResolution has already exhausted
 *    its lever.
 *  - In-band (30..55) resets both counters; `lowQuality` unchanged.
 *  - When sustaining the current quality state, the same-direction
 *    counter does NOT increment (early-skip) to keep the counter
 *    bounded across long sessions.
 *
 * The pixel-ratio gate (≤ 0.55) is intentionally just above
 * AdaptiveResolution's 0.5 floor — `stepPixelRatio` clamps to
 * 0.5 exact, so any value at or below 0.55 means the ladder has
 * landed at its lowest rung. Above that we let AdaptiveResolution
 * keep dropping pixel-ratio (cheaper visual change) before we
 * pull the Bloom lever (more drastic).
 *
 * Source: PERF audit Architectural C +
 * comprehensive-review:code-reviewer NICE-TO-HAVE #2 +
 * gemini-code-assist L114 comment.
 */

export type StepLowQualityInput = Readonly<{
	avgFps: number;
	/**
	 * Current pixel ratio, sourced from AdaptiveResolution's
	 * `fpsUpdate` payload. Default to 1 if absent (e.g. in tests
	 * that only care about the fps gate).
	 */
	pixelRatio: number;
	lowQuality: boolean;
	consecutiveLow: number;
	consecutiveHigh: number;
}>;

export type StepLowQualityResult = Readonly<{
	lowQuality: boolean;
	consecutiveLow: number;
	consecutiveHigh: number;
}>;

/** AdaptiveResolution clamps the pixel-ratio floor at 0.5; this
 * threshold is just above that so any value below means the
 * ladder has bottomed out. */
export const PIXEL_RATIO_FLOOR_GATE = 0.55;

export function stepLowQuality(input: StepLowQualityInput): StepLowQualityResult {
	const { avgFps, pixelRatio } = input;
	let { lowQuality, consecutiveLow, consecutiveHigh } = input;

	const atFloor = pixelRatio <= PIXEL_RATIO_FLOOR_GATE;

	if (avgFps < 30 && atFloor) {
		consecutiveHigh = 0;
		if (!lowQuality) {
			consecutiveLow += 1;
			if (consecutiveLow >= 2) {
				lowQuality = true;
				consecutiveLow = 0;
			}
		}
	} else if (avgFps > 55) {
		consecutiveLow = 0;
		if (lowQuality) {
			consecutiveHigh += 1;
			if (consecutiveHigh >= 2) {
				lowQuality = false;
				consecutiveHigh = 0;
			}
		}
	} else {
		// In-band, or avgFps<30 but pixelRatio still above floor.
		// Either way, no transition is pending — clear both counters
		// so a future trigger starts from a clean slate.
		consecutiveLow = 0;
		consecutiveHigh = 0;
	}

	return { lowQuality, consecutiveLow, consecutiveHigh };
}
