/**
 * POL33 — pins the difficulty → music-intensity dB delta table.
 *
 * The exact values are part of the modernized-DOOM audio contract:
 * NIGHTMARE reads sonically hotter than TOO YOUNG TO DIE without
 * changing the note material. Wider deltas would have to widen
 * SFX_BANDS.musicVoice in tandem; this test pins both contracts.
 */

import { MUSIC_INTENSITY_DB, SFX_BANDS } from "@audio/sfx";
import { describe, expect, it } from "vitest";

describe("POL33 — music intensity dB table", () => {
	it("ranks the 5 difficulties monotonically from quiet to loud", () => {
		const { tooYoung, notTooRough, hurtMePlenty, ultraViolence, nightmare } = MUSIC_INTENSITY_DB;
		if (
			tooYoung === undefined ||
			notTooRough === undefined ||
			hurtMePlenty === undefined ||
			ultraViolence === undefined ||
			nightmare === undefined
		)
			throw new Error("MUSIC_INTENSITY_DB missing expected keys");
		expect(tooYoung).toBeLessThan(notTooRough);
		expect(notTooRough).toBeLessThan(hurtMePlenty);
		expect(hurtMePlenty).toBeLessThan(ultraViolence);
		expect(ultraViolence).toBeLessThan(nightmare);
	});

	it("centers hurtMePlenty at 0dB (the baseline)", () => {
		expect(MUSIC_INTENSITY_DB.hurtMePlenty).toBe(0);
	});

	it("nightmare bump + base v0 stays inside SFX_BANDS.musicVoice", () => {
		// Voice 0 has the loudest base volume (-28dB per the construction
		// formula in sfx.ts). NIGHTMARE adds the most positive delta.
		// The result must still fit musicVoice.max.
		const baseV0 = -28;
		const nightmare = MUSIC_INTENSITY_DB.nightmare;
		if (nightmare === undefined) throw new Error("MUSIC_INTENSITY_DB.nightmare missing");
		expect(baseV0 + nightmare).toBeLessThanOrEqual(SFX_BANDS.musicVoice.max);
	});

	it("tooYoung delta + base v5 stays inside SFX_BANDS.musicVoice", () => {
		// Voice 5 has the quietest base volume (-28 - 5*1.5 = -35.5dB).
		// TOO YOUNG adds the most negative delta. The result must still
		// fit musicVoice.min.
		const baseV5 = -28 - 5 * 1.5;
		const tooYoung = MUSIC_INTENSITY_DB.tooYoung;
		if (tooYoung === undefined) throw new Error("MUSIC_INTENSITY_DB.tooYoung missing");
		expect(baseV5 + tooYoung).toBeGreaterThanOrEqual(SFX_BANDS.musicVoice.min);
	});

	it("table covers every shipped difficulty", () => {
		const expectedKeys = ["tooYoung", "notTooRough", "hurtMePlenty", "ultraViolence", "nightmare"];
		for (const k of expectedKeys) {
			expect(MUSIC_INTENSITY_DB).toHaveProperty(k);
		}
	});
});
