/**
 * HUD weapon-chip style contract (owned-only strip).
 *
 * The HUD bottom strip is OWNED-ONLY (HUD2 — `WEAPON_ORDER.filter(ownedWeapons)`),
 * so every chip is owned; the locked/unowned variant was dropped with the filter
 * (review QUAL-L3). The only remaining state axis is active vs owned-inactive.
 * This pins:
 *   - owned-inactive chip: pointer cursor, full opacity, transparent ring
 *   - active chip: accent border + accent fill adornment
 */

import { describe, expect, it } from "vitest";
import { weaponChipStyle } from "../../../app/views/HUD";

const ACCENT = "#ff8800";

describe("weaponChipStyle — owned-only contract", () => {
	it("owned-inactive chip: pointer cursor, full opacity, transparent ring", () => {
		const style = weaponChipStyle(false, ACCENT);
		expect(style.cursor).toBe("pointer");
		expect(style.opacity).toBe(1);
		expect(String(style.border)).toContain("transparent");
	});

	it("active chip: accent border + accent fill adornment", () => {
		const style = weaponChipStyle(true, ACCENT);
		expect(String(style.border)).toContain(ACCENT);
		expect(String(style.background)).toContain(ACCENT);
	});
});
