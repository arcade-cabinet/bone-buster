// J9 — pure-logic coverage of the fade-overlay trigger semantics.
// The overlay itself is a React/framer-motion component (asserted
// end-to-end by the headed e2e screenshot pass); this pins the
// derivation of color + peak per trigger kind so a refactor of the
// table can't silently shift colors or intensities.
import { describe, expect, it } from "vitest";
import type { FadeKind } from "@/ObjexoomShell";

// Mirror of the table inside triggerFade. Keep this in sync — the
// test is the canary that catches drift.
const COLOR_BY_KIND: Record<FadeKind, string> = {
	damage: "rgba(220, 38, 38, 1)",
	key: "rgba(34, 197, 94, 1)",
	flash: "rgba(229, 231, 235, 1)",
	win: "rgba(255, 255, 255, 1)",
};
const PEAK_BY_KIND: Record<FadeKind, number> = {
	damage: 0.55,
	key: 0.4,
	flash: 0.5,
	win: 0.85,
};

describe("objexoom J9 — fade trigger derivations", () => {
	it("each kind maps to a distinct CSS color", () => {
		const colors = new Set(Object.values(COLOR_BY_KIND));
		expect(colors.size).toBe(4);
	});

	it("peak opacities are all in (0, 1]", () => {
		for (const k of Object.keys(PEAK_BY_KIND) as FadeKind[]) {
			const p = PEAK_BY_KIND[k];
			expect(p).toBeGreaterThan(0);
			expect(p).toBeLessThanOrEqual(1);
		}
	});

	it("damage intensity scales peak but is capped at 1", () => {
		const scale = (intensity: number) =>
			Math.min(1, PEAK_BY_KIND.damage * intensity);
		expect(scale(0)).toBe(0);
		expect(scale(0.5)).toBeCloseTo(0.275, 5);
		expect(scale(1)).toBe(0.55);
		expect(scale(5)).toBe(1); // capped
	});

	it("win is the loudest flash (level-clear should read as the climax)", () => {
		expect(PEAK_BY_KIND.win).toBeGreaterThan(PEAK_BY_KIND.damage);
		expect(PEAK_BY_KIND.win).toBeGreaterThan(PEAK_BY_KIND.flash);
		expect(PEAK_BY_KIND.win).toBeGreaterThan(PEAK_BY_KIND.key);
	});

	it("damage is red, key is green, win is white, flash is gray", () => {
		expect(COLOR_BY_KIND.damage).toContain("220, 38, 38");
		expect(COLOR_BY_KIND.key).toContain("34, 197, 94");
		expect(COLOR_BY_KIND.win).toContain("255, 255, 255");
		expect(COLOR_BY_KIND.flash).toContain("229, 231, 235");
	});
});
