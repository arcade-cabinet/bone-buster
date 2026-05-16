/**
 * POL3-v2 — per-archetype PBR floor texture URLs.
 *
 * Color + NormalGL maps from the photorealistic asset library, 1K
 * JPGs (~600KB-2MB each). Corridor is intentionally omitted from the
 * texture-keyed path — the corridor flat-color floor is canonical
 * (refLevel 0 + every canonical screenshot pose runs on corridor by
 * the seed%5 invariant) and texturing it would break byte-stable e2e
 * gates without a corresponding visual win (corridor is meant to read
 * as a stark, abstract DOOM-clone hallway, not a PBR-textured floor).
 *
 * Asset selection rationale:
 *   arena     → MetalPlates006 — cracked metal grating + rivets reads
 *               as combat-arena heavy industrial.
 *   sewer     → Concrete032    — wet stone surface, matches the damp
 *               underground sewer mood.
 *   library   → Wood035        — natural wood plank floor for the
 *               study-hall study aesthetic.
 *   courtyard → PavingStones070 — outdoor cobble pavers, evokes a
 *               medieval town courtyard at dusk.
 *
 * Texture tiling: floors are 24×24 tiles wide on procedural grid
 * maps (= 24 world units squared at TILE=1). 1K textures repeated at
 * (4, 4) gives 6 tiles per repeat — fine grain per tile without
 * blurring. Tune per archetype if the natural texture scale demands.
 */

import { A } from "@assets/assetUrl";
import type { PropArchetype } from "@world/scatter/propPool";

export interface FloorTextureSet {
	color: string;
	normal: string;
	/** UV repeat per planar axis. 4 = 4 tiles per repeat across the floor. */
	repeat: number;
}

export const FLOOR_TEXTURES: Partial<Record<PropArchetype, FloorTextureSet>> = {
	arena: {
		color: A("/assets/textures/floors/arena_color.jpg"),
		normal: A("/assets/textures/floors/arena_normal.jpg"),
		repeat: 6,
	},
	sewer: {
		color: A("/assets/textures/floors/sewer_color.jpg"),
		normal: A("/assets/textures/floors/sewer_normal.jpg"),
		repeat: 4,
	},
	library: {
		color: A("/assets/textures/floors/library_color.jpg"),
		normal: A("/assets/textures/floors/library_normal.jpg"),
		repeat: 5,
	},
	courtyard: {
		color: A("/assets/textures/floors/courtyard_color.jpg"),
		normal: A("/assets/textures/floors/courtyard_normal.jpg"),
		repeat: 5,
	},
	// corridor → omitted. Canonical flat-color floor preserved.
};

export const ALL_FLOOR_TEXTURE_URLS: readonly string[] = Object.values(FLOOR_TEXTURES).flatMap(
	(set) => [set.color, set.normal],
);
