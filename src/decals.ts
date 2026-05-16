/**
 * COV6 step-1 — wall decal variant pool.
 *
 * Stages 12 PSX Mega Pack II Decals (4 graffiti + 8 poster variants)
 * for per-wall-face seeded mounting. The pool is split by kind so
 * step-2 can prefer one over the other per archetype (e.g. graffiti
 * in sewer, posters in library).
 *
 * Acceptance per directive COV6: "≥3 per sector seeded by tile hash."
 * Step-1 ships the asset pool + picker; step-2 wires the wall-face
 * placement in SectorMapGeometry.
 */

import { A } from "@assets/assetUrl";
import type { PropArchetype } from "./scatter/propPool";

/** Graffiti decals — informal wall tags, sewer / corridor friendly. */
export const DECAL_VARIANTS_GRAFFITI: readonly string[] = [
	A("/assets/models/props/decals/graffiti_mx_1.glb"),
	A("/assets/models/props/decals/graffiti_mx_2.glb"),
	A("/assets/models/props/decals/graffiti_mx_4.glb"),
	A("/assets/models/props/decals/graffiti_mx_5.glb"),
];

/** Poster decals — printed signage, library / arena friendly. */
export const DECAL_VARIANTS_POSTER: readonly string[] = [
	A("/assets/models/props/decals/poster_cx_4.glb"),
	A("/assets/models/props/decals/poster_cx_5.glb"),
	A("/assets/models/props/decals/poster_cx_9.glb"),
	A("/assets/models/props/decals/poster_cx_11.glb"),
	A("/assets/models/props/decals/poster_cx_12.glb"),
	A("/assets/models/props/decals/poster_cx_13.glb"),
	A("/assets/models/props/decals/poster_cx_15.glb"),
	A("/assets/models/props/decals/poster_cx_16.glb"),
];

/** Combined pool across both kinds. */
export const DECAL_VARIANTS_ALL: readonly string[] = [
	...DECAL_VARIANTS_GRAFFITI,
	...DECAL_VARIANTS_POSTER,
];

/**
 * Deterministic decal pick by `tileHash`. Used by step-2's wall-face
 * mounting: hash the (sectorId, edgeIdx, faceX) tuple → pass to this
 * helper → render the resulting GLB on the wall face.
 */
export function pickDecalUrl(tileHash: number): string {
	const idx = (tileHash >>> 0) % DECAL_VARIANTS_ALL.length;
	return DECAL_VARIANTS_ALL[idx];
}

/**
 * E13 step-15 — per-archetype decal pool. Corridor uses the combined
 * `DECAL_VARIANTS_ALL` array unchanged (canonical byte-stability).
 * Other archetypes favor a specific decal flavor that matches their
 * identity: arena/sewer lean graffiti (informal wear), library/
 * courtyard lean posters (printed signage).
 */
export const DECALS_BY_ARCHETYPE: Readonly<Record<PropArchetype, readonly string[]>> = {
	corridor: DECAL_VARIANTS_ALL,
	arena: DECAL_VARIANTS_GRAFFITI,
	courtyard: DECAL_VARIANTS_POSTER,
	sewer: DECAL_VARIANTS_GRAFFITI,
	library: DECAL_VARIANTS_POSTER,
};

/**
 * Archetype-keyed variant of `pickDecalUrl`. Same hash within the same
 * archetype is deterministic; passing `"corridor"` is equivalent to
 * calling `pickDecalUrl(hash)` directly.
 */
export function pickDecalUrlByArchetype(archetype: PropArchetype, tileHash: number): string {
	const pool = DECALS_BY_ARCHETYPE[archetype];
	const idx = (tileHash >>> 0) % pool.length;
	return pool[idx];
}
