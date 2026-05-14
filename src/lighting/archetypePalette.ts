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
	/**
	 * COV3 step-6 — procedural grid-map floor tint. With per-archetype
	 * walls in place (COV3 step-5), the flat-ink procedural floor was
	 * the conspicuous remaining flat surface. This tint reads via
	 * `MapGeometry`'s floor `<meshStandardMaterial>`; sector maps
	 * render the floor via `floorTiles.ts` GLB scatter, untouched.
	 * Corridor preserves the pre-step-6 literal `OBJEXOOM_PALETTE.ink`.
	 */
	readonly floorColor: string;
	/** COV3 step-6 — procedural floor emissive tint (low-intensity bias). */
	readonly floorEmissive: string;
	/**
	 * COV3 step-7 — procedural grid-map ceiling tint. Mirror of
	 * `floorColor` for the upper plane. Corridor preserves the
	 * pre-step-7 literal `OBJEXOOM_PALETTE.wallBase`.
	 */
	readonly ceilingColor: string;
	/**
	 * E13 step-9 — per-archetype lit-lamp pointLight color. Corridor
	 * preserves the pre-step-9 literal `OBJEXOOM_PALETTE.flashlightWarm`
	 * so lamp shadows on refLevel 0 stay byte-stable.
	 */
	readonly lampLightColor: string;
	/**
	 * E13 step-12 — hemisphere light sky + ground colors. Drives the
	 * subtle horizon-up vs floor-down lighting bias. Corridor preserves
	 * the pre-step-12 literals (indigo sky, ink ground) for canonical
	 * byte-stability.
	 */
	readonly hemisphereSky: string;
	readonly hemisphereGround: string;
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
		floorColor: OBJEXOOM_PALETTE.ink,
		floorEmissive: OBJEXOOM_PALETTE.wallEmissive,
		ceilingColor: OBJEXOOM_PALETTE.wallBase,
		lampLightColor: OBJEXOOM_PALETTE.flashlightWarm,
		hemisphereSky: OBJEXOOM_PALETTE.indigo,
		hemisphereGround: OBJEXOOM_PALETTE.ink,
	},
	arena: {
		ambientColor: SCALE.blood[300],
		directionalColor: SCALE.ember[300],
		fogColor: SCALE.ember[900],
		floorColor: SCALE.ember[900],
		floorEmissive: SCALE.blood[700],
		ceilingColor: SCALE.blood[900],
		lampLightColor: SCALE.ember[300],
		hemisphereSky: SCALE.ember[400],
		hemisphereGround: SCALE.blood[900],
	},
	courtyard: {
		ambientColor: SCALE.indigo[300],
		directionalColor: SCALE.amber[200],
		fogColor: SCALE.indigo[900],
		floorColor: SCALE.indigo[900],
		floorEmissive: SCALE.indigo[700],
		ceilingColor: SCALE.indigo[700],
		lampLightColor: SCALE.amber[200],
		hemisphereSky: SCALE.indigo[200],
		hemisphereGround: SCALE.indigo[900],
	},
	sewer: {
		ambientColor: SCALE.parchment[600],
		directionalColor: SCALE.indigo[200],
		fogColor: SCALE.parchment[900],
		floorColor: SCALE.parchment[900],
		floorEmissive: SCALE.parchment[700],
		ceilingColor: SCALE.ink[700],
		lampLightColor: SCALE.parchment[300],
		hemisphereSky: SCALE.parchment[600],
		hemisphereGround: SCALE.ink[700],
	},
	library: {
		ambientColor: SCALE.parchment[300],
		directionalColor: SCALE.amber[100],
		fogColor: SCALE.amber[900],
		floorColor: SCALE.amber[900],
		floorEmissive: SCALE.amber[700],
		ceilingColor: SCALE.parchment[700],
		lampLightColor: SCALE.amber[100],
		hemisphereSky: SCALE.amber[200],
		hemisphereGround: SCALE.amber[900],
	},
};

/** Resolve the palette for a given archetype. */
export function getArchetypeLightPalette(archetype: PropArchetype): ArchetypeLightPalette {
	return ARCHETYPE_LIGHT_PALETTES[archetype];
}
