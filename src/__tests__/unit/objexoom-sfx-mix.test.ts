/**
 * AUD1 — SFX mix coherence audit.
 *
 * Each synth's volume must sit inside its category's dB band so
 * the ambient bed doesn't bury kill stings, weapon fire doesn't
 * eat the music, and UI feedback (pickups/doors/portal) doesn't
 * compete with combat audio for the listener's attention.
 *
 * Adjustments allowed: WIDEN a band only when documented intent
 * shifts (e.g. shotgun should be louder than chaingun); SHIFT a
 * synth's category only when its role changes. Don't silently
 * push a synth out of its band — the test exists to prevent the
 * "I'll just bump this one synth up 4dB" creep that ruins mixes.
 */

import { SFX_BANDS, SFX_CATEGORIES, SFX_VOLUMES } from "@audio/sfx";
import { describe, expect, it } from "vitest";

describe("AUD1 — SFX mix volume bands", () => {
	for (const [name, volume] of Object.entries(SFX_VOLUMES)) {
		const category = SFX_CATEGORIES[name as keyof typeof SFX_CATEGORIES] as keyof typeof SFX_BANDS;
		const band = SFX_BANDS[category];
		it(`${name} (${volume}dB) sits in '${category}' band [${band.min}, ${band.max}]`, () => {
			expect(volume).toBeGreaterThanOrEqual(band.min);
			expect(volume).toBeLessThanOrEqual(band.max);
		});
	}

	it("every shipped synth has a category", () => {
		const volumeNames = Object.keys(SFX_VOLUMES);
		const categoryNames = Object.keys(SFX_CATEGORIES);
		expect(categoryNames.sort()).toEqual(volumeNames.sort());
	});

	it("bands don't overlap dangerously (ambient must be quietest)", () => {
		// Ambient should be strictly quieter than everything else.
		expect(SFX_BANDS.ambient.max).toBeLessThan(SFX_BANDS.uiFeedback.min);
		expect(SFX_BANDS.ambient.max).toBeLessThan(SFX_BANDS.weaponFire.min);
	});
});
