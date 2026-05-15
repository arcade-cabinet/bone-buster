import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { addObjexoomListener } from "../../events";
import { HitChromaticAberration } from "./HitChromaticAberration";
import { stepLowQuality } from "./stepLowQuality";

/**
 * A3 — selective postprocess chain. The EffectComposer owns Bloom +
 * HitChromaticAberration + Vignette. When sustained avgFps drops
 * below 30 for two consecutive 60-frame windows AND
 * AdaptiveResolution's pixel-ratio ladder has already bottomed
 * out (ratio ≤ 0.55), Bloom is removed from the pass list — a
 * second tier of quality drop after AdaptiveResolution has
 * exhausted its lever. Restored at >55fps for two consecutive
 * windows.
 *
 * The state machine (`stepLowQuality`) lives in a sibling `.ts`
 * module so the unit test imports it directly without pulling
 * React + @react-three/postprocessing into the test's dependency
 * graph.
 *
 * The closure-captured `consecutiveLow`/`consecutiveHigh`/
 * `currentLow` vars inside the useEffect form a single shared
 * latch with the React `lowQuality` state — React state drives
 * the JSX tree on transitions; the closure vars are the
 * authoritative input to the next stepLowQuality call.
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
 * Source: PERF audit Architectural C +
 * comprehensive-review:code-reviewer +
 * CodeRabbit / gemini-code-assist PR #56 review.
 */

export function PostprocessingChain() {
	const [lowQuality, setLowQuality] = useState(false);

	useEffect(() => {
		let consecutiveLow = 0;
		let consecutiveHigh = 0;
		let currentLow = false;
		return addObjexoomListener("fpsUpdate", ({ fps, pixelRatio }) => {
			const stepped = stepLowQuality({
				avgFps: fps,
				pixelRatio: pixelRatio ?? 1,
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
