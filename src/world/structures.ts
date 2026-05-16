/**
 * COV3 step-2+4 — modular wall asset pool, archetype-keyed.
 *
 * Step-2 shipped a single 4-GLB pool used for refLevel 0 only.
 * Step-4 expands to one pool per archetype so each ref level (and
 * future procedural sector maps) reads visually distinct per PRD §E13.
 *
 * The corridor pool is the literal step-2 array (same URLs, same
 * order) so refLevel 0's canonical screenshots remain byte-stable —
 * `pickArchetype(refLevel 0) === "corridor"` by canonical invariant
 * (seed 0 → seed%5=0 → corridor), and the deterministic per-edge
 * variant pick reads the same array.
 *
 * GLB families on the NAS:
 *   hr_*  — clean industrial brick (corridor)
 *   hs_*  — stone/parchment-cool (courtyard, library)
 *   rg_*  — rough underground (sewer)
 *   rtx_* — sleek metallic (arena)
 *   rx_*  — varied / outdoor (courtyard)
 */

import { A } from "@assets/assetUrl";
import type { PropArchetype } from "@world/scatter/propPool";

/**
 * Corridor pool — frozen step-2 contract. **Do not reorder.**
 * `WALL_VARIANTS` is exported as an alias for back-compat with the
 * step-2 unit tests and any external consumer that grew up reading
 * the flat array.
 */
const CORRIDOR_WALLS: readonly string[] = [
	A("/assets/models/structures/wall_hr_1.glb"),
	A("/assets/models/structures/wall_hr_2.glb"),
	A("/assets/models/structures/wall_hr_1_double.glb"),
	A("/assets/models/structures/wall_hs_1.glb"),
];

export const WALL_VARIANTS: readonly string[] = CORRIDOR_WALLS;

const ARENA_WALLS: readonly string[] = [
	A("/assets/models/structures/wall_rtx_1.glb"),
	A("/assets/models/structures/wall_rtx_2.glb"),
	A("/assets/models/structures/wall_hr_1_double.glb"),
	A("/assets/models/structures/wall_hs_1_double.glb"),
];

const COURTYARD_WALLS: readonly string[] = [
	A("/assets/models/structures/wall_rx_1.glb"),
	A("/assets/models/structures/wall_hr_2.glb"),
	A("/assets/models/structures/wall_hs_1.glb"),
	A("/assets/models/structures/wall_hs_1_double.glb"),
];

const SEWER_WALLS: readonly string[] = [
	A("/assets/models/structures/wall_rg_1.glb"),
	A("/assets/models/structures/wall_rg_1_double.glb"),
	A("/assets/models/structures/wall_rg_15.glb"),
	A("/assets/models/structures/wall_rg_15_double.glb"),
];

const LIBRARY_WALLS: readonly string[] = [
	A("/assets/models/structures/wall_hs_1.glb"),
	A("/assets/models/structures/wall_hs_1_double.glb"),
	A("/assets/models/structures/wall_hr_15.glb"),
	A("/assets/models/structures/wall_hr_15_double.glb"),
];

export const WALLS_BY_ARCHETYPE: Readonly<Record<PropArchetype, readonly string[]>> = {
	corridor: CORRIDOR_WALLS,
	arena: ARENA_WALLS,
	courtyard: COURTYARD_WALLS,
	sewer: SEWER_WALLS,
	library: LIBRARY_WALLS,
};

/**
 * Union of every URL across every archetype pool. Used by the GLB
 * preloader so the first sector mount doesn't stall on a network
 * request, and by the runtime-asset verifier to assert every URL
 * resolves on disk.
 */
export const ALL_WALL_URLS: readonly string[] = Array.from(
	new Set(Object.values(WALLS_BY_ARCHETYPE).flat()),
);

/**
 * Deterministic wall pick — archetype-keyed pool, hash-driven variant.
 *
 * Same `(archetype, hash)` always returns the same URL. Hash is
 * typically `sectorId * 100 + edgeIdx` so two consecutive edges in
 * the same sector get different variants.
 */
export function pickWallUrl(archetype: PropArchetype, hash: number): string {
	const pool = WALLS_BY_ARCHETYPE[archetype];
	const idx = (hash >>> 0) % pool.length;
	return pool[idx];
}
