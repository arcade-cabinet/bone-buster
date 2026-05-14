import { useFrame } from "@react-three/fiber";
import { ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import { Vector2 } from "three";
import { addObjexoomListener } from "../../events";

/**
 * POL14 — chromatic-aberration pulse on player hits.
 *
 * Holds a `Vector2` instance which is passed as the `offset` prop to
 * drei's `<ChromaticAberration>`. The effect reads the Vector2 each
 * frame, so mutating it in `useFrame` modulates the offset live.
 * On every `playerHit` event the offset spikes to ~3.7× baseline and
 * ease-out-cubics back over 180ms, reading as the screen briefly
 * fracturing — modernized-DOOM "you got hit" feedback.
 *
 * Why we own the Vector2 rather than `ref`-into the effect: drei's
 * `wrapEffect` attaches its `ref` to a dynamically-extended JSX
 * intrinsic (not to the underlying ChromaticAberrationEffect
 * instance), so `effectRef.current.offset.set(...)` would call
 * `.set` on the wrapper, not the underlying Vector2 uniform — which
 * is the runtime error we surfaced on the first cut of this effect.
 * Owning the Vector2 and passing it by reference is both simpler
 * and works correctly across drei versions.
 */

const BASE_X = 0.0015;
const BASE_Y = 0.0015;
const PEAK_X = 0.0055;
const PEAK_Y = 0.0055;
const PULSE_MS = 180;

export function HitChromaticAberration() {
	// One Vector2 instance per mount. Pass-by-reference into the effect
	// so the postprocessing pass reads our latest values each frame.
	const offset = useMemo(() => new Vector2(BASE_X, BASE_Y), []);
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
		const now = performance.now();
		if (now >= pulseUntil.current) {
			offset.set(BASE_X, BASE_Y);
			return;
		}
		const t = (now - pulseStarted.current) / PULSE_MS;
		const ease = 1 - (1 - t) * (1 - t) * (1 - t);
		offset.set(PEAK_X + (BASE_X - PEAK_X) * ease, PEAK_Y + (BASE_Y - PEAK_Y) * ease);
	});

	return <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={offset} />;
}
