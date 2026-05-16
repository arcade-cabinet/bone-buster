// J9 — pure-logic coverage of the fade-overlay trigger semantics.
// The overlay itself is a React/framer-motion component (asserted
// end-to-end by the headed e2e screenshot pass); this pins the
// derivation of color + peak per trigger kind.
//
// QW9 — pre-QW9 this file kept a local copy of COLOR_BY_KIND /
// PEAK_BY_KIND tables and asserted against the local copy, which
// is a tautology — the test couldn't detect drift because there was
// only one source. CONV9 moved the tables to src/fadeTriggers.ts;
// the test now imports them so a change to the real table either
// passes (assertions still hold) or fails (assertions need re-baselining).

import { computeFadePeak, FADE_COLOR_BY_KIND, FADE_PEAK_BY_KIND } from "@shared/fadeTriggers";
import type { FadeKind } from "@views/Shell";
import { describe, expect, it } from "vitest";

describe("objexoom J9 — fade trigger derivations", () => {
	it("each kind maps to a defined (non-empty) CSS color", () => {
		for (const k of Object.keys(FADE_COLOR_BY_KIND) as FadeKind[]) {
			expect(FADE_COLOR_BY_KIND[k]).toBeTruthy();
			expect(typeof FADE_COLOR_BY_KIND[k]).toBe("string");
		}
	});

	it("peak opacities are all in (0, 1]", () => {
		for (const k of Object.keys(FADE_PEAK_BY_KIND) as FadeKind[]) {
			const p = FADE_PEAK_BY_KIND[k];
			expect(p).toBeGreaterThan(0);
			expect(p).toBeLessThanOrEqual(1);
		}
	});

	it("computeFadePeak scales by intensity and caps at 1", () => {
		expect(computeFadePeak("damage", 0)).toBe(0);
		expect(computeFadePeak("damage", 0.5)).toBeCloseTo(FADE_PEAK_BY_KIND.damage * 0.5, 5);
		expect(computeFadePeak("damage", 1)).toBe(FADE_PEAK_BY_KIND.damage);
		expect(computeFadePeak("damage", 5)).toBe(1); // capped
	});

	it("win is the loudest flash (level-clear should read as the climax)", () => {
		expect(FADE_PEAK_BY_KIND.win).toBeGreaterThan(FADE_PEAK_BY_KIND.damage);
		expect(FADE_PEAK_BY_KIND.win).toBeGreaterThan(FADE_PEAK_BY_KIND.flash);
		expect(FADE_PEAK_BY_KIND.win).toBeGreaterThan(FADE_PEAK_BY_KIND.key);
	});

	it("damage and key colors are visually distinct from win/flash", () => {
		// damage uses ROLE.actionDamage; key uses SCALE.amber[400]; win+flash
		// share SCALE.parchment[50]. Asserts the design-token shape without
		// pinning specific hex codes (those can drift with token refactors).
		expect(FADE_COLOR_BY_KIND.damage).not.toBe(FADE_COLOR_BY_KIND.win);
		expect(FADE_COLOR_BY_KIND.key).not.toBe(FADE_COLOR_BY_KIND.win);
		expect(FADE_COLOR_BY_KIND.win).toBe(FADE_COLOR_BY_KIND.flash); // both parchment-50 by design
	});
});
