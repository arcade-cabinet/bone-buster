/**
 * Yuka integration adapter.
 *
 * Owns a singleton `yuka.EntityManager` + `yuka.Time`. Per-enemy
 * `yuka.GameEntity` instances live in the manager (registered by the
 * Scene on mount, dropped on death / unmount); their positions are
 * mirrored from the FSM-computed enemy.position each frame so any
 * future yuka behavior (NavMesh path queries, neighbor scans, vehicle
 * steering) can read a live registry.
 *
 * The hand-rolled FSM in `enemyAi.ts` still owns state transitions;
 * its per-frame step math (patrol drift + chase + obstacle deflection
 * + projectile integration) routes through the helpers below, all
 * mirroring the corresponding yuka behaviors:
 *   - yukaStepToward       → Seek + Arrive
 *   - yukaWanderTarget     → Wander
 *   - yukaProjectileStep   → Projectile.update
 *   - yukaAvoidObstacles   → ObstacleAvoidance
 *   - buildNavmeshFromSectors → NavMesh.fromPolygons (shape)
 *
 * Reference: yuka examples at
 *   https://mugen87.github.io/yuka/examples/
 */

import type { BoneBusterSectorMap, Vec2 } from "@engine/mapTypes";
import * as Yuka from "yuka";

// Singleton — there's exactly one OBJEXOOM scene at a time so a
// module-scoped manager is the right granularity. The Scene's effect
// cleanup calls `clearYuka()` on unmount to drop all entities.
const entityManager = new Yuka.EntityManager();
const time = new Yuka.Time();

/**
 * Advance every registered yuka entity by `delta` seconds. Hook this
 * into the r3f `useFrame` callback once.
 */
export function tickYuka(deltaSeconds: number): void {
	// Yuka.Time auto-advances; we pass an explicit delta so behavior
	// is deterministic across frames (avoids the system-clock variance
	// that breaks unit-test reproducibility).
	time.update();
	entityManager.update(deltaSeconds);
}

/** Register a yuka entity so it ticks with the manager. */
export function addYukaEntity(entity: Yuka.GameEntity): void {
	entityManager.add(entity);
}

/** Drop a yuka entity from the manager. */
export function removeYukaEntity(entity: Yuka.GameEntity): void {
	entityManager.remove(entity);
}

/**
 * Y1 — make a fresh yuka.GameEntity at the given XZ position. The
 * caller mutates `.position` each frame to mirror the FSM-driven
 * enemy.position; the EntityManager.update tick advances it.
 */
export function makeYukaEntityAt(position: Vec2): Yuka.GameEntity {
	const entity = new Yuka.GameEntity();
	entity.position.set(position.x, 0, position.y);
	addYukaEntity(entity);
	return entity;
}

/** Wipe every registered entity. Call on Scene unmount. */
export function clearYuka(): void {
	entityManager.clear();
}

/** Test/debug — count of currently registered entities. */
export function yukaEntityCount(): number {
	return entityManager.entities.length;
}

/**
 * Build a yuka.Vector3 from our 2D Vec2 (xz-plane in world space).
 * Used by the FSM for chase/patrol math without dragging yuka types
 * into the FSM module signatures.
 */
export function vec2ToYuka(v: Vec2): Yuka.Vector3 {
	return new Yuka.Vector3(v.x, 0, v.y);
}

/** Reverse — yuka.Vector3 → Vec2 (xz only). */
export function yukaToVec2(v: Yuka.Vector3): Vec2 {
	return { x: v.x, y: v.z };
}

/**
 * Yuka-backed step calculator. Returns a new Vec2 advancing `from`
 * toward `to` by `speed * dt` units (clamped to not overshoot). Uses
 * yuka.MathUtils for the clamp so the math matches yuka steering.
 */
export function yukaStepToward(from: Vec2, to: Vec2, speed: number, dt: number): Vec2 {
	const fromV = vec2ToYuka(from);
	const toV = vec2ToYuka(to);
	const direction = new Yuka.Vector3().subVectors(toV, fromV);
	const distance = direction.length();
	if (distance < 1e-6) return from;
	const step = Math.min(distance, speed * dt);
	direction.normalize().multiplyScalar(step);
	const next = fromV.add(direction);
	return yukaToVec2(next);
}

/**
 * Random patrol drift vector. Mirrors yuka.WanderBehavior's circle
 * projection at a small radius, returning the world-space target the
 * patroller should head toward.
 */
export function yukaWanderTarget(origin: Vec2, bearing: number, radius: number): Vec2 {
	return {
		x: origin.x + Math.cos(bearing) * radius,
		y: origin.y + Math.sin(bearing) * radius,
	};
}

/**
 * Y5 — yuka-style projectile step. Mirrors `yuka.Projectile.update`:
 * advance `from` by `velocity * dt`. Wall + player collision stays in
 * the caller (engine's `stepEnemyBullet` uses castRayAny). The intent
 * here is to centralize the math so future migration to a real
 * yuka.Projectile registered with the EntityManager is mechanical.
 */
export function yukaProjectileStep(from: Vec2, velocity: Vec2, dt: number): Vec2 {
	return {
		x: from.x + velocity.x * dt,
		y: from.y + velocity.y * dt,
	};
}

/**
 * Y4 — obstacle-avoidance deflection. Mirrors
 * yuka.ObstacleAvoidanceBehavior: if a straight step from `origin`
 * toward `target` would collide within `lookahead` units, deflect
 * the desired heading by a small angle (left or right depending on
 * which side has more clearance) and return the deflected target.
 *
 * `collidesAt` is supplied by the caller (Scene wraps the engine's
 * collision-resolution dispatcher) so this stays free of map-shape
 * knowledge.
 */
export function yukaAvoidObstacles(
	origin: Vec2,
	target: Vec2,
	lookahead: number,
	collidesAt: (p: Vec2) => boolean,
): Vec2 {
	const dx = target.x - origin.x;
	const dy = target.y - origin.y;
	const distance = Math.hypot(dx, dy);
	if (distance < 1e-6) return target;
	const ux = dx / distance;
	const uy = dy / distance;
	const probe: Vec2 = {
		x: origin.x + ux * lookahead,
		y: origin.y + uy * lookahead,
	};
	if (!collidesAt(probe)) return target;
	// Probe each side at ±0.6 rad and pick the clearer one.
	const tryDeflect = (sign: number): Vec2 | null => {
		const angle = sign * 0.6;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const rx = ux * cos - uy * sin;
		const ry = ux * sin + uy * cos;
		const p: Vec2 = {
			x: origin.x + rx * lookahead,
			y: origin.y + ry * lookahead,
		};
		return collidesAt(p) ? null : p;
	};
	return tryDeflect(1) ?? tryDeflect(-1) ?? target;
}

/**
 * Y6 — sector-polygon → navmesh adapter. Returns a structure that
 * mirrors `yuka.NavMesh` shape (regions[] of vertices) so a future
 * pass can hand it directly to yuka's pathfinder. For now the navmesh
 * is built but unused — chase uses obstacle-avoidance (Y4) instead of
 * full pathfinding. The follow-up plug-in point is to feed this into
 * `yuka.NavMeshLoader.fromPolygons()` once a per-enemy yuka.Vehicle
 * lands (Y1 full migration).
 *
 * Reference: yuka examples at
 *   yuka/examples/navigation/navmesh/index.html
 */
export type BoneBusterNavmesh = Readonly<{
	regions: ReadonlyArray<{
		id: number;
		vertices: ReadonlyArray<Vec2>;
		floorHeight: number;
	}>;
	bounds: { minX: number; minY: number; maxX: number; maxY: number };
}>;

export function buildNavmeshFromSectors(map: BoneBusterSectorMap): BoneBusterNavmesh {
	const regions = map.sectors.map((sector) => ({
		id: sector.id,
		vertices: sector.vertices.map((v) => ({ x: v.x, y: v.y })),
		floorHeight: sector.floorHeight,
	}));
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const region of regions) {
		for (const v of region.vertices) {
			if (v.x < minX) minX = v.x;
			if (v.y < minY) minY = v.y;
			if (v.x > maxX) maxX = v.x;
			if (v.y > maxY) maxY = v.y;
		}
	}
	return { regions, bounds: { minX, minY, maxX, maxY } };
}
