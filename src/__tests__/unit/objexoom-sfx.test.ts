// I7 — covers the pure positional-pan helper. The rest of sfx.ts wraps
// Tone.js (browser-only), so we only test what's deterministic.
//
// Convention matches three.js + the game's PlayerController:
// camera.rotation.y = yaw, with forward in the XZ plane equal to
// `(-sin(yaw), -cos(yaw))` (so yaw 0 = forward is -Z, i.e. -y in our
// XZ-as-XY world). pan ∈ [-1, 1]; centered = 0, right = +, left = -.
//
// K8 — also covers getMusicLoadProgress for the K6 landing indicator.
import { describe, expect, it } from "vitest";
import { getMusicLoadProgress, panForPosition } from "@/sfx";

describe("objexoom sfx — panForPosition", () => {
	const camera = { x: 0, y: 0, yaw: 0 };

	it("enemy directly ahead (-y at yaw 0) → ~0 pan (centered)", () => {
		const pan = panForPosition({ x: 0, y: -5 }, camera);
		expect(Math.abs(pan)).toBeLessThan(0.05);
	});

	it("enemy on player's right (+x at yaw 0) → pan ≈ +1", () => {
		// At yaw 0, forward = (0, -1). The camera-right vector is (+x, 0).
		const pan = panForPosition({ x: 5, y: 0 }, camera);
		expect(pan).toBeGreaterThan(0.95);
	});

	it("enemy on player's left (-x at yaw 0) → pan ≈ -1", () => {
		const pan = panForPosition({ x: -5, y: 0 }, camera);
		expect(pan).toBeLessThan(-0.95);
	});

	it("yawing 90° rotates forward from -y to +x", () => {
		// At yaw π/2: forward = (-sin(π/2), -cos(π/2)) = (-1, 0). Enemy in
		// the -x direction is now dead-ahead.
		const turned = { x: 0, y: 0, yaw: Math.PI / 2 };
		const pan = panForPosition({ x: -5, y: 0 }, turned);
		expect(Math.abs(pan)).toBeLessThan(0.05);
	});

	it("enemy behind the player → ±~0 pan (front/back is ambiguous on stereo)", () => {
		// Directly behind (+y at yaw 0): forward = (0,-1), enemy at (0,+1).
		// The dot of right vs. enemy is 0, so pan = 0.
		const pan = panForPosition({ x: 0, y: 5 }, camera);
		expect(Math.abs(pan)).toBeLessThan(0.05);
	});

	it("pan is always within [-1, 1] for any position/yaw", () => {
		for (let i = 0; i < 50; i += 1) {
			const x = (Math.random() - 0.5) * 100;
			const y = (Math.random() - 0.5) * 100;
			const yaw = Math.random() * Math.PI * 2;
			const pan = panForPosition({ x, y }, { x: 0, y: 0, yaw });
			expect(pan).toBeGreaterThanOrEqual(-1);
			expect(pan).toBeLessThanOrEqual(1);
		}
	});
});

describe("objexoom sfx — K6 music load progress", () => {
	it("returns a {loaded, total} pair with total=6", () => {
		const p = getMusicLoadProgress();
		expect(p.total).toBe(6);
		expect(p.loaded).toBeGreaterThanOrEqual(0);
		expect(p.loaded).toBeLessThanOrEqual(p.total);
	});
});
