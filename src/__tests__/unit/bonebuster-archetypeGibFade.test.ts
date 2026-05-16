import {
	ARCHETYPE_LIGHT_PALETTES,
	getArchetypeLightPalette,
} from "@scene/lighting/archetypePalette";
import { describe, expect, it } from "vitest";

/**
 * POL41 — per-archetype gib fade speed. Tests pin the gibFadeMs
 * table contract: corridor preserves canonical 5000, every other
 * archetype is non-default, archetypes are monotonically ordered
 * by mood (arena fastest, sewer slowest).
 */

describe("POL41 per-archetype gib fade", () => {
	it("corridor preserves canonical 5000ms TTL (refLevel 0 byte-stable)", () => {
		expect(getArchetypeLightPalette("corridor").gibFadeMs).toBe(5000);
	});

	it("every archetype declares a gibFadeMs value", () => {
		for (const archetype of ["corridor", "arena", "courtyard", "sewer", "library"] as const) {
			expect(typeof getArchetypeLightPalette(archetype).gibFadeMs).toBe("number");
			expect(getArchetypeLightPalette(archetype).gibFadeMs).toBeGreaterThan(0);
		}
	});

	it("arena is the fastest (busy combat → fast cleanup)", () => {
		const arena = getArchetypeLightPalette("arena").gibFadeMs;
		for (const other of ["corridor", "courtyard", "sewer", "library"] as const) {
			expect(arena).toBeLessThanOrEqual(getArchetypeLightPalette(other).gibFadeMs);
		}
	});

	it("sewer is the slowest (dim, gibs persist atmospherically)", () => {
		const sewer = getArchetypeLightPalette("sewer").gibFadeMs;
		for (const other of ["corridor", "arena", "courtyard", "library"] as const) {
			expect(sewer).toBeGreaterThanOrEqual(getArchetypeLightPalette(other).gibFadeMs);
		}
	});

	it("at least 3 archetypes have distinct gibFadeMs values (variety)", () => {
		const values = Object.values(ARCHETYPE_LIGHT_PALETTES).map((p) => p.gibFadeMs);
		const distinct = new Set(values).size;
		expect(distinct).toBeGreaterThanOrEqual(3);
	});

	it("every TTL is at least motion(800) + fade(1000) = 1800ms (safety floor)", () => {
		for (const palette of Object.values(ARCHETYPE_LIGHT_PALETTES)) {
			expect(palette.gibFadeMs).toBeGreaterThanOrEqual(1800);
		}
	});
});
