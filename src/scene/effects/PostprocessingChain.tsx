import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { addObjexoomListener } from "../../events";
import { HitChromaticAberration } from "./HitChromaticAberration";

/**
 * A3 — selective postprocess chain. The EffectComposer owns Bloom +
 * HitChromaticAberration + Vignette. When sustained avgFps drops
 * below 30 for two consecutive 60-frame windows, Bloom is removed
 * from the pass list — full-screen Bloom is the heaviest pass and
 * unmounting it is a cheap lever that parallels AdaptiveResolution's
 * pixel-ratio drop. Restored at >55fps for two consecutive windows.
 *
 * The state machine is pure (`stepLowQuality`) so the band math is
 * unit-testable without mounting r3f or the EventTarget bus.
 *
 * Implementation note — the EffectComposer is mounted ONCE; its
 * children are diffed via the library's useLayoutEffect, which
 * calls `removePass` for removed effects and `addPass` for added
 * effects on every children-prop change. We rely on that behavior
 * to swap Bloom in/out without rebuilding the composer itself
 * (composer rebuild would leak HalfFloat MRTs on every flip).
 *
 * Pre-review this file used a React `key` flip on `<EffectComposer>`
 * to force a clean rebuild; that approach was rejected after
 * `comprehensive-review:code-reviewer` inspected
 * `@react-three/postprocessing` v3 internals and confirmed the
 * composer is built in `useMemo` (not re-keyed by children) and
 * its cleanup `removePass`es without `.dispose()`ing — the `key`
 * flip leaked the previous composer's framebuffers, which is the
 * exact failure A3 is meant to mitigate.
 *
 * Source: PERF audit Architectural C.
 */

export type StepLowQualityInput = Readonly<{
	avgFps: number;
	lowQuality: boolean;
	consecutiveLow: number;
	consecutiveHigh: number;
}>;

export type StepLowQualityResult = Readonly<{
	lowQuality: boolean;
	consecutiveLow: number;
	consecutiveHigh: number;
}>;

/**
 * Pure state-machine for the lowQuality flag.
 *
 *  - avgFps < 30 increments `consecutiveLow`, resets `consecutiveHigh`.
 *    On the 2nd consecutive low, set `lowQuality=true`.
 *  - avgFps > 55 increments `consecutiveHigh`, resets `consecutiveLow`.
 *    On the 2nd consecutive high, set `lowQuality=false`.
 *  - In-band (30..55) resets both counters; `lowQuality` unchanged.
 *
 * Hysteresis band (30..55) is deliberately wider than the trigger
 * thresholds to prevent oscillation around the boundary — same
 * design as AdaptiveResolution's stepPixelRatio.
 */
export function stepLowQuality(input: StepLowQualityInput): StepLowQualityResult {
	const { avgFps } = input;
	let { lowQuality, consecutiveLow, consecutiveHigh } = input;

	if (avgFps < 30) {
		// Reset the opposite-direction counter unconditionally so
		// an alternating low/high sequence never accumulates either
		// streak past 1 (the debounce contract).
		consecutiveHigh = 0;
		// If we're already in lowQuality, no transition can fire
		// from another low window — skip the counter bump so it
		// stays bounded across a sustained slow session.
		// (Patched after comprehensive-review:code-reviewer flagged
		// the pre-patch unbounded-counter path.)
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
		consecutiveLow = 0;
		consecutiveHigh = 0;
	}

	return { lowQuality, consecutiveLow, consecutiveHigh };
}

export function PostprocessingChain() {
	const [lowQuality, setLowQuality] = useState(false);

	useEffect(() => {
		let consecutiveLow = 0;
		let consecutiveHigh = 0;
		let currentLow = false;
		return addObjexoomListener("fpsUpdate", ({ fps }) => {
			const stepped = stepLowQuality({
				avgFps: fps,
				lowQuality: currentLow,
				consecutiveLow,
				consecutiveHigh,
			});
			consecutiveLow = stepped.consecutiveLow;
			consecutiveHigh = stepped.consecutiveHigh;
			if (stepped.lowQuality !== currentLow) {
				currentLow = stepped.lowQuality;
				setLowQuality(stepped.lowQuality);
			}
		});
	}, []);

	// A3 — single EffectComposer mount, children swapped in/out by
	// the library's useLayoutEffect (addPass/removePass on child
	// diff). Filtering nulls into the array satisfies
	// EffectComposerProps.children type. The `as JSX.Element[]`
	// cast is safe because the filter strips every null and the
	// remaining values are concrete component elements.
	const passes: Array<JSX.Element | null> = [
		lowQuality ? null : (
			<Bloom key="bloom" intensity={0.45} luminanceThreshold={0.55} luminanceSmoothing={0.2} />
		),
		<HitChromaticAberration key="chromatic" />,
		<Vignette key="vignette" eskil={false} offset={0.25} darkness={0.7} />,
	];
	const children = passes.filter((p): p is JSX.Element => p !== null);
	return <EffectComposer>{children}</EffectComposer>;
}
