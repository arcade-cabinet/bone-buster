import { BONE_PALETTE, ROLE } from "@styles/tokens/colors";
import { describe, expect, it } from "vitest";

/**
 * R2 contract pins. The bone palette is the new shippable identity;
 * the nested ROLE.surface/text/accent/brand surface mirrors the
 * PRD §R2 color table. The legacy flat ROLE keys (bgVoid,
 * textPrimary, accentPrimary, actionFire, ...) keep working but
 * resolve through the bone palette so the rebrand ripples even
 * before R7 migrates each call site.
 */

const HEX = /^#[0-9a-f]{6}$/i;

describe("Bone palette (PRD §R2)", () => {
	it("BONE_PALETTE carries the 16 named anchors (14 R2 + 2 SLA5 signal)", () => {
		const keys = Object.keys(BONE_PALETTE).sort();
		expect(keys).toEqual([
			"accentDanger",
			"accentDiscovery",
			"accentGain",
			"accentPrimary",
			"accentWarning",
			"brandBlood",
			"brandBone1",
			"brandBone2",
			"brandBone3",
			"signalSpiritBox",
			"signalUv",
			"surfaceBase",
			"surfaceDeep",
			"surfaceElevated",
			"textMuted",
			"textPrimary",
			"textSecondary",
		]);
	});

	it("every BONE_PALETTE value is a valid 6-digit hex", () => {
		for (const v of Object.values(BONE_PALETTE)) {
			expect(v).toMatch(HEX);
		}
	});

	it("PRD §R2 hex anchors are byte-stable", () => {
		// Pinned from docs/REBRAND.md §Color scheme. Editing any
		// anchor here requires a brand decision (see DECISIONS.md
		// when D# is added) — not a casual color tweak.
		expect(BONE_PALETTE.surfaceBase).toBe("#0F0C12");
		expect(BONE_PALETTE.surfaceElevated).toBe("#1A1620");
		expect(BONE_PALETTE.surfaceDeep).toBe("#070509");
		expect(BONE_PALETTE.textPrimary).toBe("#F4ECDC");
		expect(BONE_PALETTE.textSecondary).toBe("#A89B85");
		expect(BONE_PALETTE.textMuted).toBe("#6D6458");
		expect(BONE_PALETTE.accentPrimary).toBe("#FF6B35");
		expect(BONE_PALETTE.accentWarning).toBe("#FFB347");
		expect(BONE_PALETTE.accentDanger).toBe("#E63946");
		expect(BONE_PALETTE.accentDiscovery).toBe("#9D4EDD");
		expect(BONE_PALETTE.accentGain).toBe("#06D6A0");
		expect(BONE_PALETTE.brandBone1).toBe("#F4ECDC");
		expect(BONE_PALETTE.brandBone2).toBe("#D9C5A0");
		expect(BONE_PALETTE.brandBone3).toBe("#8B6F47");
		expect(BONE_PALETTE.brandBlood).toBe("#9B2226");
	});
});

describe("ROLE nested namespaces (PRD §R2 canonical surface)", () => {
	it("ROLE.surface mirrors the PRD surface tier", () => {
		expect(ROLE.surface.base).toBe(BONE_PALETTE.surfaceBase);
		expect(ROLE.surface.elevated).toBe(BONE_PALETTE.surfaceElevated);
		expect(ROLE.surface.deep).toBe(BONE_PALETTE.surfaceDeep);
	});

	it("ROLE.text mirrors the PRD text tier", () => {
		expect(ROLE.text.primary).toBe(BONE_PALETTE.textPrimary);
		expect(ROLE.text.secondary).toBe(BONE_PALETTE.textSecondary);
		expect(ROLE.text.muted).toBe(BONE_PALETTE.textMuted);
	});

	it("ROLE.accent mirrors the PRD accent tier", () => {
		expect(ROLE.accent.primary).toBe(BONE_PALETTE.accentPrimary);
		expect(ROLE.accent.warning).toBe(BONE_PALETTE.accentWarning);
		expect(ROLE.accent.danger).toBe(BONE_PALETTE.accentDanger);
		expect(ROLE.accent.discovery).toBe(BONE_PALETTE.accentDiscovery);
		expect(ROLE.accent.gain).toBe(BONE_PALETTE.accentGain);
	});

	it("ROLE.brand mirrors the PRD brand tier", () => {
		expect(ROLE.brand.bone1).toBe(BONE_PALETTE.brandBone1);
		expect(ROLE.brand.bone2).toBe(BONE_PALETTE.brandBone2);
		expect(ROLE.brand.bone3).toBe(BONE_PALETTE.brandBone3);
		expect(ROLE.brand.blood).toBe(BONE_PALETTE.brandBlood);
	});
});

describe("Legacy flat ROLE keys re-point at bone palette", () => {
	// These keys keep working until R7 migrates each call site to
	// the nested ROLE.* form. The values rippling through to the
	// bone palette is what makes R2 effectively complete the
	// visual rebrand even without R7 having run yet.
	it("background tier resolves through surface anchors", () => {
		expect(ROLE.bgVoid).toBe(BONE_PALETTE.surfaceDeep);
		expect(ROLE.bgWorld).toBe(BONE_PALETTE.surfaceBase);
		expect(ROLE.bgWall).toBe(BONE_PALETTE.surfaceElevated);
		expect(ROLE.bgPanel).toBe(BONE_PALETTE.surfaceElevated);
	});

	it("text tier resolves through text anchors", () => {
		expect(ROLE.textPrimary).toBe(BONE_PALETTE.textPrimary);
		expect(ROLE.textSecondary).toBe(BONE_PALETTE.textSecondary);
		expect(ROLE.textMuted).toBe(BONE_PALETTE.textMuted);
	});

	it("accent + action tier resolves through accent anchors", () => {
		expect(ROLE.accentPrimary).toBe(BONE_PALETTE.accentPrimary);
		expect(ROLE.accentCool).toBe(BONE_PALETTE.accentDiscovery);
		expect(ROLE.actionFire).toBe(BONE_PALETTE.accentDanger);
		expect(ROLE.actionHurt).toBe(BONE_PALETTE.accentWarning);
		expect(ROLE.actionWin).toBe(BONE_PALETTE.accentGain);
		expect(ROLE.actionGoingBack).toBe(BONE_PALETTE.accentPrimary);
	});
});
