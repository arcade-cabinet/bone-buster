import { hash, smoothstep, valueNoise } from "@atoms/ScuffShader";
import { describe, expect, it } from "vitest";

/**
 * R4 contract pins. The ScuffShader noise field is decorative, but
 * its pure helpers are deterministic — pinning them catches a
 * regression that would shift the landing's noise pattern.
 */
describe("ScuffShader pure helpers (PRD §R4)", () => {
	describe("smoothstep", () => {
		it("anchors at the endpoints", () => {
			expect(smoothstep(0)).toBe(0);
			expect(smoothstep(1)).toBe(1);
		});

		it("midpoint = 0.5", () => {
			expect(smoothstep(0.5)).toBeCloseTo(0.5, 5);
		});

		it("monotonically non-decreasing on [0, 1]", () => {
			let prev = -Infinity;
			for (let i = 0; i <= 20; i++) {
				const v = smoothstep(i / 20);
				expect(v).toBeGreaterThanOrEqual(prev);
				prev = v;
			}
		});

		it("zero-derivative at endpoints (no boundary jolt)", () => {
			// Derivative of t²(3 - 2t) is 6t(1 - t); zero at t=0 and t=1.
			const eps = 1e-5;
			expect(smoothstep(eps) / eps).toBeLessThan(eps * 10);
			expect((1 - smoothstep(1 - eps)) / eps).toBeLessThan(eps * 10);
		});
	});

	describe("hash", () => {
		it("returns a finite number in [0, 1) for any integer pair", () => {
			for (const [x, y] of [
				[0, 0],
				[1, 0],
				[-1, 0],
				[100, 200],
				[1024, 4096],
				[-1000, -1000],
			]) {
				const v = hash(x, y);
				expect(Number.isFinite(v)).toBe(true);
				expect(v).toBeGreaterThanOrEqual(0);
				expect(v).toBeLessThan(1);
			}
		});

		it("is deterministic for the same input", () => {
			expect(hash(7, 13)).toBe(hash(7, 13));
			expect(hash(0, 0)).toBe(hash(0, 0));
		});

		it("diverges across neighboring lattice cells", () => {
			// Adjacent cells should produce visibly different samples,
			// otherwise the noise field would clump into bands.
			const a = hash(10, 10);
			const b = hash(11, 10);
			const c = hash(10, 11);
			expect(Math.abs(a - b)).toBeGreaterThan(0.01);
			expect(Math.abs(a - c)).toBeGreaterThan(0.01);
		});
	});

	describe("valueNoise", () => {
		it("returns values in [0, 1]", () => {
			for (let i = 0; i < 100; i++) {
				const v = valueNoise(i * 0.137, i * 0.281);
				expect(v).toBeGreaterThanOrEqual(0);
				expect(v).toBeLessThanOrEqual(1);
			}
		});

		it("matches the hash at integer lattice points", () => {
			// At (xi, yi) the bilinear weights collapse and value =
			// hash(xi, yi). u = smoothstep(0) = 0, so the (1-u)(1-v)
			// term carries the full weight.
			expect(valueNoise(5, 7)).toBeCloseTo(hash(5, 7), 6);
			expect(valueNoise(0, 0)).toBeCloseTo(hash(0, 0), 6);
		});

		it("is deterministic", () => {
			expect(valueNoise(3.14, 2.71)).toBe(valueNoise(3.14, 2.71));
		});

		it("smooths between lattice cells (no discontinuities)", () => {
			// Sample 100 points along a unit cell and check no jump
			// exceeds the max swing of the four surrounding hashes —
			// no jump above (max - min). Looser bound = absolute 1.0.
			let prev = valueNoise(0, 0.5);
			for (let i = 1; i <= 100; i++) {
				const v = valueNoise(i / 100, 0.5);
				const jump = Math.abs(v - prev);
				expect(jump).toBeLessThan(0.5);
				prev = v;
			}
		});
	});
});
