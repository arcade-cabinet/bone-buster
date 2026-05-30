import { type FrameClass, useFrameClass } from "@views/useFrameClass";
import type { CSSProperties } from "react";

/**
 * HUD1 — frames the 3D scene "dark / gritty / chrome." Responsive per
 * {@link useFrameClass}:
 *   - cockpit (tablet / unfolded foldable / desktop): a gritty chrome border
 *     surround + heavier edge vignette — a DOOM/RE-style HUD cockpit.
 *   - compact (phone, any orientation): a subtle radial vignette only, so the
 *     already-small view isn't boxed in.
 *
 * Pure DOM overlay above the Canvas, pointer-events:none, sits UNDER the HUD
 * chips (the chips keep their own z). No raw-HTML injection (CI-8).
 */

const SHARED: CSSProperties = {
	position: "absolute",
	inset: 0,
	pointerEvents: "none",
	// Honour safe-area insets so the frame doesn't tuck under a notch/cutout.
	padding:
		"env(safe-area-inset-top,0) env(safe-area-inset-right,0) env(safe-area-inset-bottom,0) env(safe-area-inset-left,0)",
};

/** Subtle vignette — used alone on phones, and under the cockpit chrome. */
function vignetteStyle(strength: number): CSSProperties {
	return {
		...SHARED,
		// Radial darkening toward the edges; the centre stays clear so the
		// readable flood (VIS3) isn't dimmed where the player is aiming.
		// scale-step: a near-black edge-vignette gradient at a runtime-variable
		// alpha — no semantic ROLE token captures "frame vignette darkness".
		background: `radial-gradient(120% 120% at 50% 48%, rgba(0,0,0,0) 55%, rgba(8,5,10,${strength}) 100%)`,
	};
}

function CockpitChrome() {
	return (
		<div aria-hidden style={SHARED} data-frame="cockpit">
			{/* Edge vignette (stronger than compact). */}
			<div style={vignetteStyle(0.72)} />
			{/* Chrome border surround — a gritty dark metal frame inset from the
			    viewport edge. Layered box-shadows give it bevel + grime depth
			    without an image asset.
			    scale-step: bespoke dark-metal bevel + grime shadow stack — a
			    physical-frame material with no semantic ROLE token. */}
			<div
				style={{
					...SHARED,
					margin: 10,
					borderRadius: 14,
					border: "2px solid #2b2630",
					boxShadow:
						"inset 0 0 0 1px rgba(120,120,135,0.18), inset 0 0 22px rgba(0,0,0,0.85), inset 0 2px 1px rgba(150,150,165,0.10), 0 0 0 1px rgba(0,0,0,0.6)",
				}}
			/>
		</div>
	);
}

function CompactVignette() {
	return <div aria-hidden style={vignetteStyle(0.5)} data-frame="compact" />;
}

export function HudFrame({ classOverride }: { classOverride?: FrameClass } = {}) {
	const auto = useFrameClass();
	const cls = classOverride ?? auto;
	return cls === "cockpit" ? <CockpitChrome /> : <CompactVignette />;
}
