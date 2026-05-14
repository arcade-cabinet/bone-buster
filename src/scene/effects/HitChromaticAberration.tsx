import { useFrame } from "@react-three/fiber";
import { ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction, type ChromaticAberrationEffect } from "postprocessing";
import { useEffect, useRef } from "react";
import { Vector2 } from "three";
import { addObjexoomListener } from "../../events";

/**
 * POL14 — chromatic-aberration pulse on player hits.
 *
 * Wraps drei's `<ChromaticAberration>` and pulses its offset to ~3×
 * the baseline for ~180ms whenever a `playerHit` event fires. The
 * effect reads as the screen briefly fracturing — modernized-DOOM
 * "you got hit" feedback without an opaque overlay.
 *
 * Why pulse instead of just spike: a hard step → step-back reads as
 * a glitch artifact, not a coherent visual response. The ease-out
 * curve (1 - (1-t)^3) gives a punchy onset + smooth recovery so the
 * brain reads it as a single hit-shock rather than a flicker.
 *
 * Why share the existing CA pass instead of adding a second one:
 * stacking two ChromaticAberration passes doubles the per-frame cost
 * and the second pass would be inert 99% of the time. Driving the
 * offset of the always-on pass keeps the postprocessing stack at the
 * pre-POL14 cost in the steady state.
 */

const BASE_OFFSET = new Vector2(0.0015, 0.0015);
const PEAK_OFFSET = new Vector2(0.0055, 0.0055); // ~3.7× baseline.
const PULSE_MS = 180;

export function HitChromaticAberration() {
	const effectRef = useRef<ChromaticAberrationEffect | null>(null);
	const pulseUntil = useRef(0);
	const pulseStarted = useRef(0);

	useEffect(() => {
		return addObjexoomListener("playerHit", () => {
			const now = performance.now();
			pulseStarted.current = now;
			pulseUntil.current = now + PULSE_MS;
		});
	}, []);

	useFrame(() => {
		const fx = effectRef.current;
		if (!fx) return;
		const now = performance.now();
		if (now >= pulseUntil.current) {
			// Steady state — keep at baseline (the pre-POL14 offset).
			fx.offset.set(BASE_OFFSET.x, BASE_OFFSET.y);
			return;
		}
		// Ease-out cubic over the pulse window: t=0 → peak, t=1 → base.
		const t = (now - pulseStarted.current) / PULSE_MS;
		const ease = 1 - (1 - t) * (1 - t) * (1 - t);
		const cx = PEAK_OFFSET.x + (BASE_OFFSET.x - PEAK_OFFSET.x) * ease;
		const cy = PEAK_OFFSET.y + (BASE_OFFSET.y - PEAK_OFFSET.y) * ease;
		fx.offset.set(cx, cy);
	});

	return (
		<ChromaticAberration
			ref={effectRef}
			blendFunction={BlendFunction.NORMAL}
			offset={[BASE_OFFSET.x, BASE_OFFSET.y]}
		/>
	);
}
