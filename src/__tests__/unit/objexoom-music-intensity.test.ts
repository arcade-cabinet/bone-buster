/**
 * POL33 — pins the difficulty → music-intensity dB delta table.
 *
 * The exact values are part of the modernized-DOOM audio contract:
 * NIGHTMARE reads sonically hotter than TOO YOUNG TO DIE without
 * changing the note material. Wider deltas would have to widen
 * SFX_BANDS.musicVoice in tandem; this test pins both contracts.
 */

import { describe, expect, it } from "vitest";
import { MUSIC_INTENSITY_DB, SFX_BANDS } from "@/sfx";

describe("POL33 — music intensity dB table", () => {
	it("ranks the 5 difficulties monotonically from quiet to loud", () => {
		expect(MUSIC_INTENSITY_DB.tooYoung).toBeLessThan(MUSIC_INTENSITY_DB.notTooRough);
		expect(MUSIC_INTENSITY_DB.notTooRough).toBeLessThan(MUSIC_INTENSITY_DB.hurtMePlenty);
		expect(MUSIC_INTENSITY_DB.hurtMePlenty).toBeLessThan(MUSIC_INTENSITY_DB.ultraViolence);
		expect(MUSIC_INTENSITY_DB.ultraViolence).toBeLessThan(MUSIC_INTENSITY_DB.nightmare);
	});

	it("centers hurtMePlenty at 0dB (the baseline)", () => {
		expect(MUSIC_INTENSITY_DB.hurtMePlenty).toBe(0);
	});

	it("nightmare bump + base v0 stays inside SFX_BANDS.musicVoice", () => {
		// Voice 0 has the loudest base volume (-28dB per the construction
		// formula in sfx.ts). NIGHTMARE adds the most positive delta.
		// The result must still fit musicVoice.max.
		const baseV0 = -28;
		expect(baseV0 + MUSIC_INTENSITY_DB.nightmare).toBeLessThanOrEqual(SFX_BANDS.musicVoice.max);
	});

	it("tooYoung delta + base v5 stays inside SFX_BANDS.musicVoice", () => {
		// Voice 5 has the quietest base volume (-28 - 5*1.5 = -35.5dB).
		// TOO YOUNG adds the most negative delta. The result must still
		// fit musicVoice.min.
		const baseV5 = -28 - 5 * 1.5;
		expect(baseV5 + MUSIC_INTENSITY_DB.tooYoung).toBeGreaterThanOrEqual(SFX_BANDS.musicVoice.min);
	});

	it("table covers every shipped difficulty", () => {
		const expectedKeys = ["tooYoung", "notTooRough", "hurtMePlenty", "ultraViolence", "nightmare"];
		for (const k of expectedKeys) {
			expect(MUSIC_INTENSITY_DB).toHaveProperty(k);
		}
	});
});
