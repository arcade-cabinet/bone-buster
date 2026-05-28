/**
 * CR-M1 — shared per-sector scatter sampling primitives.
 *
 * Before this, `bboxOf` and `nearAny` were copy-pasted byte-identically
 * into 6 scatter modules (prop / trap / npc / nature / kitchen / largeProp),
 * and `ID_STRIDE` was an inconsistent magic constant (100 in five files,
 * 1000 in propScatter — an id-collision drift the comprehensive review
 * flagged). This centralizes them so a sampling-geometry fix lands once and
 * the id-stride invariant has one source of truth.
 *
 * See docs/specs / full-review M-1.
 */

import type { Vec2 } from "@engine/mapTypes";

/**
 * Axis-aligned bounding box of a sector polygon's vertices. Used to seed
 * the per-sector rejection sampler's candidate range.
 */
export function bboxOf(verts: readonly Vec2[]): {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
} {
	let minX = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const v of verts) {
		if (v.x < minX) minX = v.x;
		if (v.x > maxX) maxX = v.x;
		if (v.y < minY) minY = v.y;
		if (v.y > maxY) maxY = v.y;
	}
	return { minX, maxX, minY, maxY };
}

/** True if `point` is within `radius` of any point in `others`. */
export function nearAny(point: Vec2, others: readonly Vec2[], radius: number): boolean {
	for (const o of others) {
		if (Math.hypot(o.x - point.x, o.y - point.y) < radius) return true;
	}
	return false;
}

/**
 * Per-sector instance-id stride. An instance's id is
 * `sector.id * SCATTER_ID_STRIDE + indexWithinSector`, so the stride must
 * exceed every scatter system's max-per-sector count to keep ids globally
 * unique. 1000 covers the densest system (props) with headroom; using ONE
 * value across all systems removes the prior 100-vs-1000 drift.
 */
export const SCATTER_ID_STRIDE = 1000;

/**
 * Build a globally-unique scatter instance id. Dev-asserts the per-sector
 * index stays under the stride (an overflow would silently collide ids
 * across sectors — the invariant the old prose-only comments relied on).
 */
export function scatterId(sectorId: number, indexWithinSector: number): number {
	if (
		process.env.NODE_ENV !== "production" &&
		(indexWithinSector < 0 || indexWithinSector >= SCATTER_ID_STRIDE)
	) {
		throw new RangeError(
			`scatterId: index ${indexWithinSector} out of [0, ${SCATTER_ID_STRIDE}) — would collide ids across sectors`,
		);
	}
	return sectorId * SCATTER_ID_STRIDE + indexWithinSector;
}
