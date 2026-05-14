/**
 * COV3 step-2 — modular wall asset pool.
 *
 * 4 wall variants from `3DPSX/PSX Mega Pack II v1.8/Modular Structures/`.
 * Each GLB is a wall "panel" textured for industrial-warehouse look;
 * a deterministic per-edge picker chooses a variant per sector edge
 * so the level reads as varied without obvious repeats.
 *
 * Step-2 (this commit) ships the pool + picker + SectorMapGeometry
 * wiring (gated on `useModularWalls`). Tiling along edges + portal
 * cutouts are step-3.
 */

import { A } from "./assetUrl";

export const WALL_VARIANTS: readonly string[] = [
	A("/assets/models/structures/wall_hr_1.glb"),
	A("/assets/models/structures/wall_hr_2.glb"),
	A("/assets/models/structures/wall_hr_1_double.glb"),
	A("/assets/models/structures/wall_hs_1.glb"),
];

/**
 * Deterministic wall pick by hash (typically `sectorId * 100 +
 * edgeIdx`). Same hash → same variant.
 */
export function pickWallUrl(hash: number): string {
	const idx = (hash >>> 0) % WALL_VARIANTS.length;
	return WALL_VARIANTS[idx];
}
