"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

/**
 * E12 / PA16 — adaptive resolution. Lives inside `<Canvas>`, samples
 * frame deltas through `useFrame`, and adjusts `gl.setPixelRatio()`
 * dynamically when the rolling FPS drifts out of the target band.
 *
 * Algorithm:
 *  - Maintain a 60-frame rolling buffer of frame deltas.
 *  - Every 60 frames, compute average FPS.
 *  - If avg < 30 FPS for 2 consecutive windows, drop pixel ratio
 *    by 0.1 (down to 0.5 floor).
 *  - If avg > 55 FPS for 2 consecutive windows, raise pixel ratio
 *    by 0.1 (up to devicePixelRatio ceiling).
 *  - 2-window debounce prevents oscillation under transient spikes
 *    (loading a new GLB, audio context warmup, etc).
 *
 * The Canvas's static `dpr={[1, 1.5]}` prop sets the starting band;
 * this hook narrows / widens it at runtime. The starting ratio is
 * always `min(devicePixelRatio, 1.5)` per the Canvas prop.
 *
 * Optional callback fires on every adjustment for the HUD readout
 * gated on ?objexoomDebug.
 */
export function AdaptiveResolution({
	onUpdate,
}: {
	onUpdate?: (info: { fps: number; pixelRatio: number }) => void;
}) {
	const gl = useThree((s) => s.gl);

	const deltaBuf = useRef<number[]>([]);
	const consecutiveLow = useRef(0);
	const consecutiveHigh = useRef(0);
	const lastUpdateAt = useRef(performance.now());

	// Track our authoritative pixel-ratio target separately from
	// whatever the Canvas dpr prop / device-pixel-ratio reports.
	// gl.getPixelRatio() returns the currently-applied value.
	const ratioRef = useRef<number>(Math.min(window.devicePixelRatio || 1, 1.5));

	useEffect(() => {
		gl.setPixelRatio(ratioRef.current);
	}, [gl]);

	useFrame((_, dt) => {
		deltaBuf.current.push(dt);
		if (deltaBuf.current.length < 60) return;

		const total = deltaBuf.current.reduce((a, b) => a + b, 0);
		const avgFps = deltaBuf.current.length / total;
		deltaBuf.current = [];

		const now = performance.now();
		// Skip the very first window after mount — initial frames
		// include GLB load + Tone.js warmup which always look slow
		// and would trip an immediate downgrade.
		if (now - lastUpdateAt.current < 2000) return;
		lastUpdateAt.current = now;

		const cap = window.devicePixelRatio || 1;
		const floor = 0.5;
		const current = ratioRef.current;
		let next = current;

		if (avgFps < 30) {
			consecutiveLow.current += 1;
			consecutiveHigh.current = 0;
			if (consecutiveLow.current >= 2 && current > floor) {
				next = Math.max(floor, Math.round((current - 0.1) * 10) / 10);
				consecutiveLow.current = 0;
			}
		} else if (avgFps > 55) {
			consecutiveHigh.current += 1;
			consecutiveLow.current = 0;
			if (consecutiveHigh.current >= 2 && current < cap) {
				next = Math.min(cap, Math.round((current + 0.1) * 10) / 10);
				consecutiveHigh.current = 0;
			}
		} else {
			consecutiveLow.current = 0;
			consecutiveHigh.current = 0;
		}

		if (next !== current) {
			ratioRef.current = next;
			gl.setPixelRatio(next);
		}

		onUpdate?.({ fps: avgFps, pixelRatio: next });
	});

	return null;
}
