/**
 * CR-H1eng — polygonal-sector map primitives (the BoneBusterSectorMap
 * representation used by turtle-decoded reference levels): point-in-polygon,
 * sector lookup + cache, floor/ceiling height queries, ray-vs-segment cast,
 * portal-edge detection, lava test, and circle-vs-edge pushout. The grid
 * representation has its parallel set in `gridCollision.ts`; the
 * kind-agnostic dispatchers live in `collisionAny.ts`.
 */

import { at } from "@engine/arrayAt";
import {
	type BoneBusterMap,
	type BoneBusterSectorMap,
	EPS,
	type MapSector,
	type SectorCache,
	type Vec2,
} from "@engine/mapTypes";
import { PISTOL_MAX_RANGE, PLAYER_RADIUS } from "@shared/constants";

/**
 * Even-odd point-in-polygon test. Works for non-convex polygons. Counts how
 * many polygon edges a horizontal ray from `point` crosses; odd ⇒ inside.
 * Edges that pass exactly through `point.y` are jittered up by ε to avoid
 * the degenerate boundary case (matches the reference's urandom_vector
 * jitter in `is_in_region`).
 */
export function polygonContains(point: Vec2, vertices: readonly Vec2[]): boolean {
	let inside = false;
	const len = vertices.length;
	if (len < 3) return false;
	const px = point.x;
	const py = point.y + 1e-6;
	for (let i = 0, j = len - 1; i < len; j = i, i += 1) {
		const vi = at(vertices, i);
		const vj = at(vertices, j);
		const xi = vi.x;
		const yi = vi.y;
		const xj = vj.x;
		const yj = vj.y;
		const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-30) + xi;
		if (intersects) inside = !inside;
	}
	return inside;
}

export const newSectorCache = (): SectorCache => ({ last: null });

export function getSectorAtPoint(
	map: BoneBusterSectorMap,
	point: Vec2,
	cache?: SectorCache,
): MapSector | null {
	if (cache?.last && polygonContains(point, cache.last.vertices)) {
		return cache.last;
	}
	for (const sector of map.sectors) {
		if (polygonContains(point, sector.vertices)) {
			if (cache) cache.last = sector;
			return sector;
		}
	}
	if (cache) cache.last = null;
	return null;
}

export function getFloorHeightAt(
	map: BoneBusterSectorMap,
	point: Vec2,
	cache?: SectorCache,
): number {
	const sector = getSectorAtPoint(map, point, cache);
	return sector ? sector.floorHeight : -100;
}

/**
 * E7 — true if `point` lies inside a water-flagged sector. Used by
 * PlayerController to apply the wading slowdown. Returns false for
 * grid maps + for points outside any sector.
 */
export function isInWaterAt(map: BoneBusterMap, point: Vec2, cache?: SectorCache): boolean {
	if (map.kind !== "sectors") return false;
	const sector = getSectorAtPoint(map, point, cache);
	return sector?.isWater === true;
}

export function getCeilingHeightAt(
	map: BoneBusterSectorMap,
	point: Vec2,
	cache?: SectorCache,
): number {
	const sector = getSectorAtPoint(map, point, cache);
	return sector ? sector.ceilingHeight : 0;
}

// H2 — map-shape-agnostic floor/ceiling lookup. Grid maps are flat
// (floor=0, ceiling=WALL_HEIGHT); sector maps look up the polygon
// the point sits inside. Returns null when the point is outside the
// playable region (e.g. inside a wall).
export function getFloorHeightAtAny(map: BoneBusterMap, point: Vec2): number | null {
	if (map.kind === "grid") return 0;
	const sector = getSectorAtPoint(map, point);
	return sector ? sector.floorHeight : null;
}

export function getCeilingHeightAtAny(map: BoneBusterMap, point: Vec2): number | null {
	if (map.kind === "grid") return 3; // matches WALL_HEIGHT
	const sector = getSectorAtPoint(map, point);
	return sector ? sector.ceilingHeight : null;
}

/**
 * Ray-vs-segment intersection. Returns the parametric distance `t` along
 * the ray at which it crosses the segment, or null if no intersection.
 * The ray is `origin + t * dir` (dir need not be normalized — `t` is in
 * units of `|dir|`). Returned `t` is non-negative.
 *
 * Reference: `ray_line_intersect` in utils.js.
 */
export function rayHitsSegment(origin: Vec2, dir: Vec2, p1: Vec2, p2: Vec2): number | null {
	const v1x = origin.x - p1.x;
	const v1y = origin.y - p1.y;
	const v2x = p2.x - p1.x;
	const v2y = p2.y - p1.y;
	const v3x = -dir.y;
	const v3y = dir.x;
	const denom = v2x * v3x + v2y * v3y;
	if (Math.abs(denom) < 1e-12) return null;
	const t1 = (v2x * v1y - v2y * v1x) / denom;
	const t2 = (v1x * v3x + v1y * v3y) / denom;
	if (t1 < 0 || t2 < 0 || t2 > 1) return null;
	return t1;
}

/**
 * Cast a ray through a polygonal-sector map. Returns the distance to the
 * first wall edge (an edge whose adjacent sectors would force a height
 * step) and the sector + edge that was hit.
 *
 * For now every sector edge counts as a wall — we do not yet detect
 * shared edges between adjacent sectors at the same height (i.e. portals
 * between sectors). A4 will add edge-sharing detection so the player can
 * walk through doorways.
 */
export function castRaySectors(
	origin: Vec2,
	dir: Vec2,
	map: BoneBusterSectorMap,
	maxDist: number = PISTOL_MAX_RANGE,
): {
	dist: number;
	hit: { sectorId: number; edgeIndex: number } | null;
} {
	let bestDist = maxDist;
	let bestHit: { sectorId: number; edgeIndex: number } | null = null;
	for (const sector of map.sectors) {
		const verts = sector.vertices;
		const len = verts.length;
		for (let i = 0; i < len; i += 1) {
			const a = at(verts, i);
			const b = at(verts, (i + 1) % len);
			const t = rayHitsSegment(origin, dir, a, b);
			if (t == null) continue;
			if (t < 1e-6) continue;
			if (t < bestDist) {
				bestDist = t;
				bestHit = { sectorId: sector.id, edgeIndex: i };
			}
		}
	}
	return { dist: bestDist, hit: bestHit };
}

export function hasLineOfSightSectors(a: Vec2, b: Vec2, map: BoneBusterSectorMap): boolean {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.hypot(dx, dy);
	if (len === 0) return true;
	const dir = { x: dx / len, y: dy / len };
	const { dist } = castRaySectors(a, dir, map, len);
	return dist >= len - 1e-3;
}

export function edgeKey(a: Vec2, b: Vec2): string {
	// Order-independent so shared edges match regardless of winding direction.
	const ax = Math.round(a.x * 1000) / 1000;
	const ay = Math.round(a.y * 1000) / 1000;
	const bx = Math.round(b.x * 1000) / 1000;
	const by = Math.round(b.y * 1000) / 1000;
	const k1 = `${ax},${ay}`;
	const k2 = `${bx},${by}`;
	return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
}

/**
 * Build an index of shared edges. Two sectors share an edge when their
 * polygons have two identical vertices in the same pair. Shared edges
 * with **identical floor heights on both sides** are *portals* — the
 * actor can walk across them. Shared edges with differing heights are
 * still walls (steps up/down in the reference render as wall segments).
 *
 * Returns a Set of edge keys that should NOT block movement.
 */
export function computePortalEdges(map: BoneBusterSectorMap): Set<string> {
	const owners = new Map<string, MapSector[]>();
	for (const sector of map.sectors) {
		const verts = sector.vertices;
		const len = verts.length;
		for (let i = 0; i < len; i += 1) {
			const k = edgeKey(at(verts, i), at(verts, (i + 1) % len));
			const list = owners.get(k);
			if (list) list.push(sector);
			else owners.set(k, [sector]);
		}
	}
	const portals = new Set<string>();
	for (const [k, sectors] of owners) {
		if (sectors.length < 2) continue;
		// Treat any pair of co-floor sectors as a portal. (Reference behaves
		// similarly — same floor + same ceiling => no wall drawn.)
		const a = at(sectors, 0);
		const allMatch = sectors.every(
			(s) =>
				Math.abs(s.floorHeight - a.floorHeight) < 0.001 &&
				Math.abs(s.ceilingHeight - a.ceilingHeight) < 0.001,
		);
		if (allMatch) portals.add(k);
	}
	return portals;
}

/**
 * Lava check for sector maps. Heuristic: sectors with negative floor
 * height read as lava in the reference. Returns true if the actor stands
 * on lava.
 */
export function isOnLavaSector(
	map: BoneBusterSectorMap,
	point: Vec2,
	cache?: SectorCache,
): boolean {
	const sector = getSectorAtPoint(map, point, cache);
	return sector ? sector.floorHeight < 0 : false;
}

/**
 * Closest point on segment ab to p. Used for circle-vs-segment collision.
 */
function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
	const abx = b.x - a.x;
	const aby = b.y - a.y;
	const denom = abx * abx + aby * aby;
	if (denom < EPS) return a;
	let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / denom;
	if (t < 0) t = 0;
	else if (t > 1) t = 1;
	return { x: a.x + t * abx, y: a.y + t * aby };
}

/**
 * Push the actor out of any blocking sector edge it's overlapping. Walks
 * every wall edge of every sector — at ~150 edges per ref level the cost
 * is negligible relative to a frame. Mirrors the grid version's signature.
 *
 * `portals` is the set of edge keys returned by `computePortalEdges` —
 * those edges are skipped (no wall, free passage).
 */
export function resolveCollisionSectors(
	desired: Vec2,
	map: BoneBusterSectorMap,
	portals: Set<string>,
	radius: number = PLAYER_RADIUS,
): Vec2 {
	let { x, y } = desired;
	// Run a few iterations because pushing off one edge can pop the actor
	// into another. 3 passes is enough in practice (matches the grid
	// version's behavior on inside corners).
	for (let iter = 0; iter < 3; iter += 1) {
		let moved = false;
		for (const sector of map.sectors) {
			const verts = sector.vertices;
			const len = verts.length;
			for (let i = 0; i < len; i += 1) {
				const a = at(verts, i);
				const b = at(verts, (i + 1) % len);
				if (portals.has(edgeKey(a, b))) continue;
				const closest = closestPointOnSegment({ x, y }, a, b);
				const dx = x - closest.x;
				const dy = y - closest.y;
				const d2 = dx * dx + dy * dy;
				if (d2 >= radius * radius) continue;
				if (d2 < EPS) {
					// Edge passes through point — push perpendicular to the edge.
					const ex = b.x - a.x;
					const ey = b.y - a.y;
					const el = Math.hypot(ex, ey) || 1;
					x += (-ey / el) * radius;
					y += (ex / el) * radius;
				} else {
					const d = Math.sqrt(d2);
					const push = radius - d;
					x += (dx / d) * push;
					y += (dy / d) * push;
				}
				moved = true;
			}
		}
		if (!moved) break;
	}
	return { x, y };
}
