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

import type { PropArchetype } from "@world/scatter/propPool";
import { OBJEXOOM_PALETTE, SCALE } from "../design-tokens";

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
	/**
	 * E13 step-13 — water-surface tint (sector maps with `isWater: true`).
	 * Corridor preserves the pre-step-13 literal `OBJEXOOM_PALETTE.indigo`
	 * for canonical byte-stability. Sewer goes sickly-amber, courtyard
	 * keeps cool indigo, library is still-amber, arena is ember-tinged.
	 */
	readonly waterColor: string;
	/**
	 * POL27 — atmospheric darkness multipliers. Per-archetype scaling
	 * for ambient + directional intensity AND fog-far distance so
	 * archetypes can be tuned to read as "you absolutely need the
	 * flashlight" vs "the room has natural light." All values are
	 * multipliers against the baseline; corridor preserves 1.0 across
	 * the board for canonical byte-stability.
	 *
	 *   ambientMul        scales `<ambientLight intensity>` (both
	 *                     flashlight-on and flashlight-off branches)
	 *   directionalMul    scales `<directionalLight intensity>`
	 *   fogFarTiles       overrides the fog far-plane distance in
	 *                     tiles (was hardcoded 12). Lower = closer
	 *                     fade-out = more claustrophobic.
	 */
	readonly ambientMul: number;
	readonly directionalMul: number;
	readonly fogFarTiles: number;
	/**
	 * POL41 — per-archetype gib lifetime. Replaces the hardcoded
	 * BodyPartField TTL (5000ms). Higher = gibs persist longer, reads
	 * as a more visceral aftermath; lower = clean-up faster, reads as
	 * an active combat space that "resets" quickly. Tuned per
	 * archetype mood: arena=3500 (busy combat, fast cleanup),
	 * corridor=5000 (canonical preserved), courtyard=6000 (calm
	 * outdoor), sewer=8000 (dim, gibs persist atmospherically),
	 * library=4000 (modest).
	 *
	 * The fade still happens only in the final FADE_WINDOW_MS of the
	 * lifetime (per POL25 phased lifecycle); only the total TTL +
	 * settle-end timing scale with this value.
	 */
	readonly gibFadeMs: number;
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
		waterColor: OBJEXOOM_PALETTE.indigo,
		// Canonical defaults — preserves refLevel 0 bytes exactly.
		ambientMul: 1.0,
		directionalMul: 1.0,
		fogFarTiles: 12,
		gibFadeMs: 5000,
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
		waterColor: SCALE.ember[700],
		// Arenas are well-lit combat spaces — full brightness, normal fog.
		ambientMul: 1.1,
		directionalMul: 1.0,
		fogFarTiles: 14,
		gibFadeMs: 3500,
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
		waterColor: SCALE.indigo[300],
		// Outdoor dusk — long sightlines, slightly dim ambient.
		ambientMul: 0.85,
		directionalMul: 1.1,
		fogFarTiles: 16,
		gibFadeMs: 6000,
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
		waterColor: SCALE.parchment[700],
		// Underground — DARK, but readable. PT2A — the first cut
		// (ambient 0.5 / directional 0.3) left the navigable floor
		// nearly invisible even within the flashlight cone, while
		// courtyard (ambient 0.85) and library (0.8) both struck a
		// "dark but readable" balance. Lift ambient to 0.65 so the
		// concrete tile pattern reads as a dim surface, not pure void
		// — keep directional dim (0.3) for "no sun underground"
		// atmosphere, keep fogFarTiles=8 so the flashlight cone
		// remains the practical sight-line.
		ambientMul: 0.65,
		directionalMul: 0.3,
		fogFarTiles: 8,
		gibFadeMs: 8000,
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
		waterColor: SCALE.amber[700],
		// Warm reading-room — slightly dim ambient, lamps carry it.
		ambientMul: 0.8,
		directionalMul: 0.7,
		fogFarTiles: 11,
		gibFadeMs: 4000,
	},
};

/** Resolve the palette for a given archetype. */
export function getArchetypeLightPalette(archetype: PropArchetype): ArchetypeLightPalette {
	return ARCHETYPE_LIGHT_PALETTES[archetype];
}
