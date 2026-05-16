/**
 * D1 — Locked-weapon HUD chip as status indicator.
 *
 * Pre-D1 the locked weapon chip rendered with `cursor: not-allowed`
 * and a transparent border, signaling "you can't click this" instead
 * of "you don't own this yet." DOOM's HUD treats the weapon row as
 * a pure status indicator — the digits 2-7 are always present, dim
 * when un-owned, bright when owned, never adorned with "disabled"
 * affordances.
 *
 * This test pins the locked-chip contract:
 *   - dim numeral (opacity ≤ 0.6)
 *   - no visible border (border evaluates to "none" or 0)
 *   - default cursor (not "not-allowed")
 *   - active flag still adorns the OWNED chip (border + accent fill)
 *
 * The active chip + the owned-inactive chip retain their pre-D1
 * styling so the regression is scoped to the locked branch.
 */

import { describe, expect, it } from "vitest";
import { weaponChipStyle } from "../../../app/views/HUD";

const ACCENT = "#ff8800";

describe("D1 — weaponChipStyle locked-state contract", () => {
	it("locked chip: dim numeral (opacity ≤ 0.6)", () => {
		const style = weaponChipStyle(false, false, ACCENT);
		expect(style.opacity).toBeDefined();
		expect(Number(style.opacity)).toBeLessThanOrEqual(0.6);
	});

	it("locked chip: no visible border (transparent string forbidden — collapses to 'none' or 0)", () => {
		const style = weaponChipStyle(false, false, ACCENT);
		// Either "none", "0", or undefined satisfies "no border". A
		// `1px solid transparent` border still reserves layout space
		// AND signals border-ness to screen readers — D1 wants the
		// locked chip to read as plain text in the row, not as a
		// disabled control.
		const b = String(style.border ?? "none");
		expect(b === "none" || b === "0" || b === "0px").toBe(true);
	});

	it("locked chip: cursor is default (NOT 'not-allowed')", () => {
		const style = weaponChipStyle(false, false, ACCENT);
		expect(style.cursor).not.toBe("not-allowed");
		// default | undefined both satisfy "no disabled affordance".
		const c = style.cursor ?? "default";
		expect(["default", "auto"]).toContain(c);
	});

	it("owned-inactive chip: pointer cursor (clickable for weapon swap)", () => {
		const style = weaponChipStyle(false, true, ACCENT);
		expect(style.cursor).toBe("pointer");
		expect(style.opacity).toBe(1);
	});

	it("active chip: accent border preserved (active selection adornment intact)", () => {
		const style = weaponChipStyle(true, true, ACCENT);
		expect(String(style.border)).toContain(ACCENT);
	});
});
