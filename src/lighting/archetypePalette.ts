/**
 * E13 step-2 — per-archetype lighting palette tint.
 *
 * Each of the 5 archetypes in `ARCHETYPE_NAMES` gets a distinct
 * ambient + directional color so the spawn pose reads visually
 * different by archetype. Step-1 wired archetype to the prop pool;
 * this step extends to lighting per PRD §E13.
 *
 * Back-compat: the "corridor" entry uses the literal colors that
 * ObjexoomScene had before this module shipped (violet ambient,
 * parchment directional) so refLevel 0's canonical screenshots stay
 * byte-stable.
 *
 * Intensity multipliers stay 1.0 across the board for step-2; the
 * existing `hasFlashlight ? bright : dark` blending in ObjexoomScene
 * is untouched. A future step can vary intensity per archetype if
 * the visual reads need additional separation.
 */

import { OBJEXOOM_PALETTE, SCALE } from "../design-tokens";
import type { PropArchetype } from "../scatter/propPool";

export interface ArchetypeLightPalette {
	/** Ambient light tint — a low-saturation hue that biases the bounced fill. */
	readonly ambientColor: string;
	/** Directional ("sun") light tint — a warmer/cooler key cast. */
	readonly directionalColor: string;
	/**
	 * E13 step-4 — fog tint. The dominant depth-fade signal in low-lit
	 * play; biggest visual lever for archetype-distinctness. The
	 * corridor entry preserves the pre-step-4 literal `OBJEXOOM_PALETTE.ink`
	 * for canonical byte-stability.
	 */
	readonly fogColor: string;
}

/**
 * Palette per archetype. Picks contrasting hues so two adjacent maps
 * (different seeds) read as different places.
 */
export const ARCHETYPE_LIGHT_PALETTES: Readonly<Record<PropArchetype, ArchetypeLightPalette>> = {
	// Pre-existing literal values — preserves the refLevel 0 canonical.
	corridor: {
		ambientColor: OBJEXOOM_PALETTE.violet,
		directionalColor: OBJEXOOM_PALETTE.parchment,
		fogColor: OBJEXOOM_PALETTE.ink,
	},
	// Hot arena — reddish ambient, ember sun, ember-deep fog. Reads as
	// a combat pit with smoke and heat haze on the depth fade.
	arena: {
		ambientColor: SCALE.blood[300],
		directionalColor: SCALE.ember[300],
		fogColor: SCALE.ember[900],
	},
	// Outdoor courtyard — cool indigo ambient, warm amber sun, indigo-
	// deep fog (dusk). The dusk-cool fog separates this hardest from
	// corridor's ink fog.
	courtyard: {
		ambientColor: SCALE.indigo[300],
		directionalColor: SCALE.amber[200],
		fogColor: SCALE.indigo[900],
	},
	// Damp sewer — desaturated parchment ambient, cool fill, parchment-
	// deep fog with a slight green-ink mix. Reads as "underground".
	sewer: {
		ambientColor: SCALE.parchment[600],
		directionalColor: SCALE.indigo[200],
		fogColor: SCALE.parchment[900],
	},
	// Library — warm parchment ambient, soft amber sun, ember-deep fog
	// for the "paper + dust mote sunshafts" feel. Lifts away from
	// corridor's cool ink toward a warm sepia depth fade.
	library: {
		ambientColor: SCALE.parchment[300],
		directionalColor: SCALE.amber[100],
		fogColor: SCALE.amber[900],
	},
};

/** Resolve the palette for a given archetype. */
export function getArchetypeLightPalette(archetype: PropArchetype): ArchetypeLightPalette {
	return ARCHETYPE_LIGHT_PALETTES[archetype];
}
