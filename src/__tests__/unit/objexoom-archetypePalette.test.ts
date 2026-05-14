/**
 * E13 step-2 — per-archetype lighting palette contract.
 */

import { describe, expect, it } from "vitest";
import { ARCHETYPE_NAMES } from "../../archetype";
import { OBJEXOOM_PALETTE } from "../../design-tokens";
import {
	ARCHETYPE_LIGHT_PALETTES,
	getArchetypeLightPalette,
} from "../../lighting/archetypePalette";

describe("E13 — archetype lighting palette", () => {
	it("ships an entry for every archetype", () => {
		for (const name of ARCHETYPE_NAMES) {
			expect(ARCHETYPE_LIGHT_PALETTES[name]).toBeDefined();
		}
	});

	it("corridor preserves the pre-step-2 literal colors (canonical byte-stability)", () => {
		const corridor = getArchetypeLightPalette("corridor");
		expect(corridor.ambientColor).toBe(OBJEXOOM_PALETTE.violet);
		expect(corridor.directionalColor).toBe(OBJEXOOM_PALETTE.parchment);
	});

	it("every entry has both ambient + directional colors set", () => {
		for (const name of ARCHETYPE_NAMES) {
			const p = ARCHETYPE_LIGHT_PALETTES[name];
			expect(p.ambientColor).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.directionalColor).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});

	it("ambient + directional differ within each archetype (no flat-look)", () => {
		for (const name of ARCHETYPE_NAMES) {
			const p = ARCHETYPE_LIGHT_PALETTES[name];
			expect(p.ambientColor).not.toBe(p.directionalColor);
		}
	});

	it("at least 3 archetypes have unique ambient colors (separation across maps)", () => {
		const ambients = new Set(ARCHETYPE_NAMES.map((n) => ARCHETYPE_LIGHT_PALETTES[n].ambientColor));
		expect(ambients.size).toBeGreaterThanOrEqual(3);
	});

	it("getArchetypeLightPalette is referentially-equal across calls (object identity, no new alloc)", () => {
		expect(getArchetypeLightPalette("arena")).toBe(getArchetypeLightPalette("arena"));
	});
});
