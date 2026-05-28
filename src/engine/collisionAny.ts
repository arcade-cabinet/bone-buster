/**
 * CR-H1eng — map-kind-agnostic collision/raycast dispatchers. Call these
 * from r3f / UI / AI code so callers don't need to know whether the active
 * map is a grid or a sector map. Each routes to the grid primitives
 * (`gridCollision.ts`) or the sector primitives (`sectors.ts`) based on
 * `map.kind`, and layers in the COV2 circle-blocker pushout on top.
 *
 * This is the top of the engine geometry stack: it depends on both
 * representations; nothing in those representations depends back on it.
 */

import { castRay, hasLineOfSight, resolveCollision } from "@engine/gridCollision";
import { type BoneBusterMap, type CollisionContext, EPS, type Vec2 } from "@engine/mapTypes";
import { castRaySectors, hasLineOfSightSectors, resolveCollisionSectors } from "@engine/sectors";
import { PLAYER_RADIUS } from "@shared/constants";

export function resolveCollisionAny(
	desired: Vec2,
	map: BoneBusterMap,
	ctx: CollisionContext,
	radius: number = PLAYER_RADIUS,
): Vec2 {
	if (map.kind === "grid") {
		const resolved = resolveCollision(desired, map, ctx.doorOpen ?? false, radius);
		return ctx.blockers && ctx.blockers.length > 0
			? pushOutBlockers(resolved, ctx.blockers, radius)
			: resolved;
	}
	if (!ctx.portals) {
		throw new Error("resolveCollisionAny: sector map requires portals set");
	}
	const resolved = resolveCollisionSectors(desired, map, ctx.portals, radius);
	return ctx.blockers && ctx.blockers.length > 0
		? pushOutBlockers(resolved, ctx.blockers, radius)
		: resolved;
}

/**
 * COV2 step-2 — push the actor out of each circular blocker. Walks
 * the blocker list (O(n), n ≤ 2 * sectors in practice) and applies a
 * radial pushout. Used after the wall-pushout so the actor never ends
 * up inside a blocker even on a corner-into-blocker desired move.
 */
function pushOutBlockers(
	desired: Vec2,
	blockers: readonly { position: Vec2; radius: number }[],
	actorRadius: number,
): Vec2 {
	let { x, y } = desired;
	for (let iter = 0; iter < 3; iter += 1) {
		let moved = false;
		for (const b of blockers) {
			const dx = x - b.position.x;
			const dy = y - b.position.y;
			const min = b.radius + actorRadius;
			const d2 = dx * dx + dy * dy;
			if (d2 >= min * min) continue;
			if (d2 < EPS) {
				// Actor exactly on the blocker centre — pop east by min.
				x = b.position.x + min;
				y = b.position.y;
			} else {
				const d = Math.sqrt(d2);
				const push = min - d;
				x += (dx / d) * push;
				y += (dy / d) * push;
			}
			moved = true;
		}
		if (!moved) break;
	}
	return { x, y };
}

export function hasLineOfSightAny(
	a: Vec2,
	b: Vec2,
	map: BoneBusterMap,
	ctx: CollisionContext,
): boolean {
	if (map.kind === "grid") {
		return hasLineOfSight(a, b, map, ctx.doorOpen ?? false);
	}
	return hasLineOfSightSectors(a, b, map);
}

export function castRayAny(
	origin: Vec2,
	dir: Vec2,
	map: BoneBusterMap,
	ctx: CollisionContext,
	maxDist?: number,
): { dist: number } {
	if (map.kind === "grid") {
		return castRay(origin, dir, map, ctx.doorOpen ?? false, maxDist);
	}
	return castRaySectors(origin, dir, map, maxDist);
}
