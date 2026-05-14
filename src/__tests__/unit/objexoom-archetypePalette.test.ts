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
		// E13 step-4 — fog also preserves the pre-step-4 literal for
		// refLevel 0 canonical byte-stability.
		expect(corridor.fogColor).toBe(OBJEXOOM_PALETTE.ink);
		// COV3 step-6 — floor color preserves the pre-step-6 grid-map
		// literal (`OBJEXOOM_PALETTE.ink`) so MapGeometry's corridor
		// procedural floor remains visually identical to the prior
		// hardcoded value.
		expect(corridor.floorColor).toBe(OBJEXOOM_PALETTE.ink);
		expect(corridor.floorEmissive).toBe(OBJEXOOM_PALETTE.wallEmissive);
	});

	it("every entry has all 5 colors set as valid hex", () => {
		for (const name of ARCHETYPE_NAMES) {
			const p = ARCHETYPE_LIGHT_PALETTES[name];
			expect(p.ambientColor).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.directionalColor).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.fogColor).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.floorColor).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.floorEmissive).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});

	it("at least 3 archetypes have unique floor colors (visual separation)", () => {
		const floors = new Set(ARCHETYPE_NAMES.map((n) => ARCHETYPE_LIGHT_PALETTES[n].floorColor));
		expect(floors.size).toBeGreaterThanOrEqual(3);
	});

	it("at least 3 archetypes have unique fog colors (visual depth-fade separation)", () => {
		const fogs = new Set(ARCHETYPE_NAMES.map((n) => ARCHETYPE_LIGHT_PALETTES[n].fogColor));
		expect(fogs.size).toBeGreaterThanOrEqual(3);
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
