/**
 * E6 — Secret switches + hidden wall reveals.
 *
 * Data model: each `Secret` is a pair of a wall-mounted switch and the
 * wall segment it raises. The runtime holds an array of these on the
 * map alongside enemies/barrels/pickups. The fire-resolution pipeline
 * gains a switch hit-test that runs before barrels (which run before
 * enemies); on a hit, the switch flips to `triggered` and the secret
 * wall starts its lift animation.
 *
 * One secret per ref level is the step-1 slice; multi-secret + grid-map
 * support follow as the use cases demand (see CLAUDE.md meta-rule).
 *
 * Hit-test contract mirrors `pickRayBarrel(origin, dir, list, maxDist)`:
 * returns the closest unrtriggered switch within `maxDist` along the
 * ray, or null. Triggered switches are inert (can't be re-fired).
 */

import type { Vec2 } from "./engine";

export interface SecretSpec {
	/** Stable id per map; survives reloads of the same seed. */
	id: number;
	/** World-XZ position of the switch decal mounted on a wall. */
	switchPosition: Vec2;
	/**
	 * Approximate hit radius for the switch (in world units, same scale
	 * as TILE). The hit test treats the switch as a disc on the wall.
	 */
	switchRadius: number;
	/** World-XZ position of the wall block that lifts on trigger. */
	wallPosition: Vec2;
	/** Footprint of the lifting wall block (X = width, Z = depth). */
	wallSize: Readonly<{ x: number; z: number }>;
	/** How high above the floor the wall sits at rest, in world units. */
	wallRestY: number;
	/** Vertical lift in world units when fully open. */
	wallLiftY: number;
}

export interface Secret {
	id: number;
	spec: SecretSpec;
	/** True once the player has fired at the switch in this run. */
	triggered: boolean;
	/** Wall-lift progress 0→1; advanced by the SecretWall component. */
	liftProgress: number;
}

export function spawnSecrets(specs: readonly SecretSpec[]): Secret[] {
	return specs.map((spec) => ({
		id: spec.id,
		spec,
		triggered: false,
		liftProgress: 0,
	}));
}

/**
 * Ray-disc hit test. Treats each unrtriggered switch as a small disc
 * at switchPosition; returns the closest within `maxDist`.
 *
 * Geometric model (XZ plane, same as barrels): project the switch
 * position onto the ray, reject behind-the-origin and out-of-range
 * hits, then accept if the perpendicular distance to the ray is
 * within `switchRadius`.
 */
export function pickRaySwitch(
	origin: Vec2,
	dir: Vec2,
	secrets: readonly Secret[],
	maxDist: number,
): { secret: Secret; dist: number } | null {
	let best: { secret: Secret; dist: number } | null = null;
	for (const secret of secrets) {
		if (secret.triggered) continue;
		const sx = secret.spec.switchPosition.x - origin.x;
		const sy = secret.spec.switchPosition.y - origin.y;
		const t = sx * dir.x + sy * dir.y;
		if (t <= 0 || t > maxDist) continue;
		const perpX = sx - dir.x * t;
		const perpY = sy - dir.y * t;
		const perp = Math.hypot(perpX, perpY);
		if (perp > secret.spec.switchRadius) continue;
		if (!best || t < best.dist) best = { secret, dist: t };
	}
	return best;
}
