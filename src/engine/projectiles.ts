/**
 * CR-H1eng / H-3 — enemy projectile simulation.
 *
 * Extracted from engine.ts to fix the wrong-direction dependency: engine.ts
 * is the lowest sim layer (map types + geometry), yet it imported
 * `@ai/yukaIntegration` for the projectile step. Projectiles sit ABOVE the
 * map-geometry layer (they consume it), so depending on `@ai` from here is
 * in-direction. engine.ts no longer imports `@ai` at all.
 */

import { yukaProjectileStep } from "@ai/yukaIntegration";
import { type BoneBusterMap, type CollisionContext, castRayAny, type Vec2 } from "@engine/engine";
import { TILE } from "@shared/constants";

export const ENEMY_BULLET_SPEED = 1.4 * TILE; // ≈ 1 cell / second
// L1 — damage values rescaled for the 0-9 HP scale. Bouncer bullets land
// for 1 hp on Hurt Me Plenty; phaser bullets pile up over time.
export const ENEMY_BULLET_DAMAGE = 1;
export const ENEMY_BULLET_TTL_MS = 8_000;
export const ENEMY_BULLET_RADIUS = 0.4;

export type EnemyBullet = {
	id: number;
	ownerEnemyId: number;
	position: Vec2;
	velocity: Vec2;
	createdAt: number;
	dead: boolean;
};

export function makeEnemyBullet(
	id: number,
	ownerEnemyId: number,
	origin: Vec2,
	target: Vec2,
	now: number,
): EnemyBullet {
	const dx = target.x - origin.x;
	const dy = target.y - origin.y;
	const len = Math.hypot(dx, dy) || 1;
	return {
		id,
		ownerEnemyId,
		position: { ...origin },
		velocity: {
			x: (dx / len) * ENEMY_BULLET_SPEED,
			y: (dy / len) * ENEMY_BULLET_SPEED,
		},
		createdAt: now,
		dead: false,
	};
}

/**
 * Advances an EnemyBullet by `dt` seconds against the active map. Returns
 * one of:
 *   - { kind: "alive" }            — keep simulating.
 *   - { kind: "hitWall" }          — bullet should be removed; no damage.
 *   - { kind: "hitPlayer" }        — bullet should be removed; player damaged.
 *   - { kind: "expired" }          — older than ENEMY_BULLET_TTL_MS.
 */
export type EnemyBulletStep =
	| { kind: "alive" }
	| { kind: "hitWall" }
	| { kind: "hitPlayer" }
	| { kind: "expired" };

export function stepEnemyBullet(
	bullet: EnemyBullet,
	dt: number,
	now: number,
	playerPos: Vec2,
	map: BoneBusterMap,
	ctx: CollisionContext,
): EnemyBulletStep {
	// `dead` is set by the scene as a removal signal — treat it the same as
	// expired so the bullet gets compacted out of the active list this frame.
	if (bullet.dead) return { kind: "expired" };
	if (now - bullet.createdAt > ENEMY_BULLET_TTL_MS) return { kind: "expired" };

	// Y5 — projectile integration routes through the yuka-style helper so
	// the math matches yuka.Projectile.update; wall + player collision
	// continue to be tested here against the engine's raycast dispatcher.
	const next = yukaProjectileStep(bullet.position, bullet.velocity, dt);

	// Wall test: cast from current to next along the velocity. If the cast
	// distance is shorter than the step length, we hit something.
	const stepLen = Math.hypot(next.x - bullet.position.x, next.y - bullet.position.y);
	if (stepLen > 0) {
		const dir = {
			x: (next.x - bullet.position.x) / stepLen,
			y: (next.y - bullet.position.y) / stepLen,
		};
		const wallHit = castRayAny(bullet.position, dir, map, ctx, stepLen);
		if (wallHit.dist < stepLen - 1e-3) return { kind: "hitWall" };
	}

	// Player hit test.
	const dx = next.x - playerPos.x;
	const dy = next.y - playerPos.y;
	if (Math.hypot(dx, dy) < ENEMY_BULLET_RADIUS + 0.45) {
		bullet.position = next;
		return { kind: "hitPlayer" };
	}

	bullet.position = next;
	return { kind: "alive" };
}
