/**
 * COV5 step-1 — debris variant pool.
 *
 * 10 curated PSX Mega Pack II "Debris & Misc" GLBs (loose bricks +
 * stacked bricks + debris piles + gravel piles) staged for sector-
 * body scatter. The full pack has 34 GLBs but most are redundant
 * brick orientations; this 10-entry curation covers the visual
 * spread (single bricks → stacks → piles → gravel) without bloat.
 *
 * Acceptance per directive COV5: "≥5 destroyed-prop variants spawn in
 * the body of every sector; reads as 'this place has been overrun.'"
 * Step-1 ships the pool + picker; step-2 wires sector-body placement
 * in propScatter or a sibling.
 */

import { A } from "@assets/assetUrl";

export const DEBRIS_VARIANTS: readonly string[] = [
	A("/assets/models/props/debris/brick_mx_1.glb"),
	A("/assets/models/props/debris/brick_mx_2.glb"),
	A("/assets/models/props/debris/brick_mx_3.glb"),
	A("/assets/models/props/debris/brick_mx_4.glb"),
	A("/assets/models/props/debris/bricks_stacked_mx_1.glb"),
	A("/assets/models/props/debris/bricks_stacked_mx_2.glb"),
	A("/assets/models/props/debris/debris_bricks_mx_1.glb"),
	A("/assets/models/props/debris/debris_bricks_mx_2.glb"),
	A("/assets/models/props/debris/gravel_pile_hr_1.glb"),
	A("/assets/models/props/debris/gravel_pile_hr_2.glb"),
];

/** Deterministic debris-variant pick by hash (e.g. `sectorId * map.seed + i`). */
export function pickDebrisUrl(hash: number): string {
	const idx = (hash >>> 0) % DEBRIS_VARIANTS.length;
	return DEBRIS_VARIANTS[idx];
}
