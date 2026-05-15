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
	onUpdate?: (info: {
		fps: number;
		pixelRatio: number;
		drawCalls?: number;
		triangles?: number;
	}) => void;
}) {
	const gl = useThree((s) => s.gl);

	const deltaBuf = useRef<number[]>([]);
	const consecutiveLow = useRef(0);
	const consecutiveHigh = useRef(0);
	const lastUpdateAt = useRef(performance.now());
	const ratioRef = useRef<number>(Math.min(window.devicePixelRatio || 1, 1.5));
	// OBS1 — sample peak draw-call + triangle counts across the 60-frame
	// window. `gl.info.render` resets per-render by default, so we
	// accumulate the max we see between windows instead of the last
	// value alone.
	const peakCalls = useRef(0);
	const peakTris = useRef(0);

	useEffect(() => {
		gl.setPixelRatio(ratioRef.current);
		// OBS1 — disable auto-reset so we can read render info inside
		// useFrame (which runs BEFORE r3f's render call by default).
		// We manually call `gl.info.reset()` after sampling instead.
		gl.info.autoReset = false;
	}, [gl]);

	// QW10 — priority={2} pins this useFrame AFTER r3f's render in the
	// frame loop. Default-priority useFrames run BEFORE render, so a
	// `gl.info.render.{calls,triangles}` read there reads LAST frame's
	// totals; pinning to priority=2 (any positive value runs post-render)
	// makes the sample read THIS frame's totals, which is the OBS1
	// contract the rest of the pipeline assumes.
	useFrame((_, dt) => {
		// OBS1 — sample render info from THIS frame's render (post-render
		// because priority=2 puts this useFrame after r3f's manual render
		// call). `autoReset=false` set above means the counters survived
		// until now; we read and then reset for the next frame.
		const info = gl.info.render as { calls?: number; triangles?: number };
		if (info.calls != null && info.calls > peakCalls.current) peakCalls.current = info.calls;
		if (info.triangles != null && info.triangles > peakTris.current)
			peakTris.current = info.triangles;
		gl.info.reset();

		deltaBuf.current.push(dt);
		if (deltaBuf.current.length < 60) return;

		const total = deltaBuf.current.reduce((a, b) => a + b, 0);
		const avgFps = deltaBuf.current.length / total;
		deltaBuf.current = [];

		const now = performance.now();
		// Skip the very first window after mount — initial frames include
		// GLB load + Tone.js warmup which would otherwise trip a downgrade.
		if (now - lastUpdateAt.current < 2000) return;
		lastUpdateAt.current = now;

		const cap = window.devicePixelRatio || 1;
		const current = ratioRef.current;
		let next = current;

		if (avgFps < 30) {
			consecutiveLow.current += 1;
			consecutiveHigh.current = 0;
			if (consecutiveLow.current >= 2 && current > 0.5) {
				next = Math.max(0.5, (current * 10 - 1) / 10);
				consecutiveLow.current = 0;
			}
		} else if (avgFps > 55) {
			consecutiveHigh.current += 1;
			consecutiveLow.current = 0;
			if (consecutiveHigh.current >= 2 && current < cap) {
				next = Math.min(cap, (current * 10 + 1) / 10);
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

		// OBS1 — emit the PEAK calls + triangles observed during the
		// 60-frame window (sampled every useFrame above). Reset the
		// peaks for the next window.
		const drawCalls = peakCalls.current > 0 ? peakCalls.current : undefined;
		const triangles = peakTris.current > 0 ? peakTris.current : undefined;
		peakCalls.current = 0;
		peakTris.current = 0;
		onUpdate?.({
			fps: avgFps,
			pixelRatio: next,
			drawCalls,
			triangles,
		});
	}, 2);

	return null;
}
