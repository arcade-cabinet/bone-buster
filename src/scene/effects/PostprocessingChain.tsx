import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useEffect, useState } from "react";
import { addObjexoomListener } from "../../events";
import { HitChromaticAberration } from "./HitChromaticAberration";

/**
 * A3 — selective postprocess chain. The EffectComposer owns Bloom +
 * HitChromaticAberration + Vignette. When the AdaptiveResolution
 * downgrade ladder is already at floor and FPS is still <30 for two
 * consecutive windows we drop Bloom from the chain — full-screen
 * Bloom is the heaviest pass and unmounting it is the next-cheapest
 * lever once pixel-ratio can no longer shrink. Restored at >55fps
 * for two consecutive windows.
 *
 * The state machine is pure (`stepLowQuality`) so the band math is
 * unit-testable without mounting r3f or the EventTarget bus.
 *
 * Counters live in module-local React state because mount/unmount of
 * a postprocessing pass is a React tree operation — refs alone won't
 * re-render the EffectComposer children.
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
		consecutiveLow += 1;
		consecutiveHigh = 0;
		if (consecutiveLow >= 2 && !lowQuality) {
			lowQuality = true;
			consecutiveLow = 0;
		}
	} else if (avgFps > 55) {
		consecutiveHigh += 1;
		consecutiveLow = 0;
		if (consecutiveHigh >= 2 && lowQuality) {
			lowQuality = false;
			consecutiveHigh = 0;
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

	// A3 — re-mount the EffectComposer when `lowQuality` flips. The
	// composer internally builds an EffectPass over its children at
	// mount and does not reconcile pass swaps on child-array diffs;
	// keying on `lowQuality` forces a clean rebuild so Bloom is gone
	// from the pass chain entirely (not just hidden). Branching at
	// JSX level (not via `children?` array) keeps the EffectComposer
	// children-prop type happy across @react-three/postprocessing
	// versions.
	if (lowQuality) {
		return (
			<EffectComposer key="low">
				<HitChromaticAberration />
				<Vignette eskil={false} offset={0.25} darkness={0.7} />
			</EffectComposer>
		);
	}
	return (
		<EffectComposer key="full">
			<Bloom intensity={0.45} luminanceThreshold={0.55} luminanceSmoothing={0.2} />
			<HitChromaticAberration />
			<Vignette eskil={false} offset={0.25} darkness={0.7} />
		</EffectComposer>
	);
}
