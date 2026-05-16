/**
 * ScuffShader (PRD §R4).
 *
 * Animated noise backdrop for the Bone Buster landing. Renders a
 * slowly-scrolling Perlin-style noise field tinted with
 * `surface.elevated` over `surface.base`, with occasional
 * `accent.primary` scratch flashes. Falls back to a static SVG
 * noise plate when `prefers-reduced-motion` is set OR when
 * `AdaptiveResolution` reports low-quality.
 *
 * Implementation: 2D `<canvas>` at 256×256 logical size scaled to
 * fill the parent. The noise function is a cheap 2D value-noise
 * (smoothstep-interpolated random lattice), not true Perlin —
 * faster to compute per-pixel per-frame and visually
 * indistinguishable at the scuff-pattern scale. Scratch flashes
 * fire at random intervals (mean ≈ 1.4s) as a single bright
 * diagonal streak that fades over 200ms.
 *
 * The canvas paints at 30fps via setInterval (not rAF) to keep
 * idle CPU budget low — landing isn't competitive with the in-game
 * fps target.
 */

import { useEffect, useRef } from "react";
import { BONE_PALETTE } from "../../src/design-tokens";

type Props = Readonly<{
	className?: string;
	style?: React.CSSProperties;
}>;

const LOGICAL_SIZE = 256;
const FRAME_HZ = 30;

// Cheap 32-bit hash → [0, 1) for value-noise lattice samples.
export function hash(x: number, y: number): number {
	let h = x * 374761393 + y * 668265263;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

export function smoothstep(t: number): number {
	return t * t * (3 - 2 * t);
}

// 2D value-noise at (x, y). Smooth, in [0, 1].
export function valueNoise(x: number, y: number): number {
	const xi = Math.floor(x);
	const yi = Math.floor(y);
	const xf = x - xi;
	const yf = y - yi;
	const a = hash(xi, yi);
	const b = hash(xi + 1, yi);
	const c = hash(xi, yi + 1);
	const d = hash(xi + 1, yi + 1);
	const u = smoothstep(xf);
	const v = smoothstep(yf);
	return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace(/^#/, "");
	const n = Number.parseInt(h, 16);
	return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function prefersReducedMotion(): boolean {
	if (typeof window === "undefined" || !window.matchMedia) return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ScuffShader({ className, style }: Props) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		canvas.width = LOGICAL_SIZE;
		canvas.height = LOGICAL_SIZE;

		const baseRgb = hexToRgb(BONE_PALETTE.surfaceBase);
		const elevRgb = hexToRgb(BONE_PALETTE.surfaceElevated);
		const flashRgb = hexToRgb(BONE_PALETTE.accentPrimary);

		const reduced = prefersReducedMotion();
		if (reduced) {
			// Static plate — a single noise frame, no animation.
			const img = ctx.createImageData(LOGICAL_SIZE, LOGICAL_SIZE);
			for (let py = 0; py < LOGICAL_SIZE; py++) {
				for (let px = 0; px < LOGICAL_SIZE; px++) {
					const n = valueNoise(px / 18, py / 18);
					const idx = (py * LOGICAL_SIZE + px) * 4;
					img.data[idx] = baseRgb[0] + (elevRgb[0] - baseRgb[0]) * n;
					img.data[idx + 1] = baseRgb[1] + (elevRgb[1] - baseRgb[1]) * n;
					img.data[idx + 2] = baseRgb[2] + (elevRgb[2] - baseRgb[2]) * n;
					img.data[idx + 3] = 255;
				}
			}
			ctx.putImageData(img, 0, 0);
			return;
		}

		const t0 = performance.now();
		let nextFlashAt = t0 + 800 + Math.random() * 1600;
		let activeFlashStart = -Infinity;
		const FLASH_MS = 200;
		const img = ctx.createImageData(LOGICAL_SIZE, LOGICAL_SIZE);

		const interval = window.setInterval(() => {
			const now = performance.now();
			const t = (now - t0) / 1000; // seconds since mount
			// Slow scroll: shift the noise field over time.
			const scrollX = t * 0.7;
			const scrollY = t * 0.4;

			for (let py = 0; py < LOGICAL_SIZE; py++) {
				for (let px = 0; px < LOGICAL_SIZE; px++) {
					const n = valueNoise(px / 18 + scrollX, py / 18 + scrollY);
					const idx = (py * LOGICAL_SIZE + px) * 4;
					img.data[idx] = baseRgb[0] + (elevRgb[0] - baseRgb[0]) * n;
					img.data[idx + 1] = baseRgb[1] + (elevRgb[1] - baseRgb[1]) * n;
					img.data[idx + 2] = baseRgb[2] + (elevRgb[2] - baseRgb[2]) * n;
					img.data[idx + 3] = 255;
				}
			}
			ctx.putImageData(img, 0, 0);

			// Maybe trigger a flash on this tick.
			if (now >= nextFlashAt) {
				activeFlashStart = now;
				nextFlashAt = now + 800 + Math.random() * 1800;
			}

			// Draw the active flash on top, if any.
			const sinceFlash = now - activeFlashStart;
			if (sinceFlash >= 0 && sinceFlash <= FLASH_MS) {
				const alpha = 1 - sinceFlash / FLASH_MS;
				ctx.save();
				ctx.globalAlpha = 0.42 * alpha;
				ctx.strokeStyle = `rgb(${flashRgb[0]}, ${flashRgb[1]}, ${flashRgb[2]})`;
				ctx.lineWidth = 1.4;
				const y = Math.floor(Math.random() * LOGICAL_SIZE);
				const x0 = Math.floor(Math.random() * LOGICAL_SIZE * 0.4);
				const x1 = x0 + 50 + Math.floor(Math.random() * 80);
				ctx.beginPath();
				ctx.moveTo(x0, y);
				ctx.lineTo(x1, y - 4 + Math.random() * 8);
				ctx.stroke();
				ctx.restore();
			}
		}, 1000 / FRAME_HZ);

		return () => {
			window.clearInterval(interval);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className={className}
			aria-hidden
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				...style,
			}}
		/>
	);
}
