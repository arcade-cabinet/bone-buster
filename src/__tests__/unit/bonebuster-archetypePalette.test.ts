/**
 * E13 step-2 — per-archetype lighting palette contract.
 */

import {
	ARCHETYPE_LIGHT_PALETTES,
	getArchetypeLightPalette,
} from "@scene/lighting/archetypePalette";
import { BONE_BUSTER_PALETTE, SCALE } from "@styles/tokens/index";
import { ARCHETYPE_NAMES } from "@world/archetype";
import { describe, expect, it } from "vitest";

describe("E13 — archetype lighting palette", () => {
	it("ships an entry for every archetype", () => {
		for (const name of ARCHETYPE_NAMES) {
			expect(ARCHETYPE_LIGHT_PALETTES[name]).toBeDefined();
		}
	});

	it("corridor preserves the pre-step-2 literal colors (canonical byte-stability)", () => {
		const corridor = getArchetypeLightPalette("corridor");
		expect(corridor.ambientColor).toBe(BONE_BUSTER_PALETTE.violet);
		expect(corridor.directionalColor).toBe(BONE_BUSTER_PALETTE.parchment);
		// VIS2 (OVERHAUL2) — corridor fog is now the Silent-Hill haze
		// (SCALE.indigo[500]), NOT the pre-step-4 near-black ink. The
		// dark-reveal canonical was retired: PSX assets are lit by the flood
		// (VIS1) and distance fades into a luminous tinted mist, not a void.
		expect(corridor.fogColor).toBe(SCALE.indigo[500]);
		// COV3 step-6 — floor color preserves the pre-step-6 grid-map
		// literal (`BONE_BUSTER_PALETTE.ink`) so MapGeometry's corridor
		// procedural floor remains visually identical to the prior
		// hardcoded value.
		expect(corridor.floorColor).toBe(BONE_BUSTER_PALETTE.ink);
		expect(corridor.floorEmissive).toBe(BONE_BUSTER_PALETTE.wallEmissive);
		// COV3 step-7 — corridor ceiling preserves pre-step-7 literal.
		expect(corridor.ceilingColor).toBe(BONE_BUSTER_PALETTE.wallBase);
		// E13 step-9 — lamp light color preserves canonical literal.
		expect(corridor.lampLightColor).toBe(BONE_BUSTER_PALETTE.flashlightWarm);
		// E13 step-12 — hemisphere preserves canonical literals.
		expect(corridor.hemisphereSky).toBe(BONE_BUSTER_PALETTE.indigo);
		expect(corridor.hemisphereGround).toBe(BONE_BUSTER_PALETTE.ink);
		// E13 step-13 — water preserves canonical literal.
		expect(corridor.waterColor).toBe(BONE_BUSTER_PALETTE.indigo);
	});

	it("every entry has all 10 colors set as valid hex", () => {
		for (const name of ARCHETYPE_NAMES) {
			const p = ARCHETYPE_LIGHT_PALETTES[name];
			expect(p.ambientColor).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.directionalColor).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.fogColor).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.floorColor).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.floorEmissive).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.ceilingColor).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.lampLightColor).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.hemisphereSky).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.hemisphereGround).toMatch(/^#[0-9a-f]{6}$/i);
			expect(p.waterColor).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});

	it("at least 3 archetypes have unique floor colors (visual separation)", () => {
		const floors = new Set(ARCHETYPE_NAMES.map((n) => ARCHETYPE_LIGHT_PALETTES[n].floorColor));
		expect(floors.size).toBeGreaterThanOrEqual(3);
	});

	it("at least 3 archetypes have unique ceiling colors (visual separation)", () => {
		const ceilings = new Set(ARCHETYPE_NAMES.map((n) => ARCHETYPE_LIGHT_PALETTES[n].ceilingColor));
		expect(ceilings.size).toBeGreaterThanOrEqual(3);
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
