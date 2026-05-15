/**
 * PT4B-fold — return-to-spawn bearing.
 *
 * A module-scope ref shared between a scene-side useFrame hook (the
 * writer) and the GoingBackOverlay slot (the reader). The writer
 * computes the screen-space angle from the player camera to the
 * map's spawn point once per frame; the reader polls on its own
 * 250ms tick.
 *
 * Per-frame event dispatch was rejected: 60 dispatches/sec for the
 * lifetime of going-back is wasteful when the overlay only needs
 * ~4 reads/sec. Module-scope ref is the cheapest correct shape.
 *
 * Angle convention: 0 = up (toward the top of the screen), CCW
 * positive. CSS `rotate(${angleRad}rad)` rotates the chevron glyph
 * accordingly. `null` means "no bearing available" (overlay hides
 * the chevron — pre-PT4B-fold fallback).
 */

let currentAngleRad: number | null = null;

export function setReturnBearing(angleRad: number | null): void {
	currentAngleRad = angleRad;
}

export function getReturnBearing(): number | null {
	return currentAngleRad;
}

/**
 * Compute the screen-space angle pointing from the player at
 * (px, py) toward the spawn at (sx, sy), given the camera yaw.
 *
 *   yaw     three.js camera.rotation.y (radians; 0 = facing -Z)
 *   px, py  player XZ (camera.position.{x, z})
 *   sx, sy  spawn XZ (map.playerSpawn.{x, y})
 *
 * Result is the rotation needed for a glyph whose "up" axis is +Y
 * (canvas convention) so that it points at the spawn.
 *
 * Exported pure for tests.
 */
export function computeBearingRad(
	yaw: number,
	px: number,
	py: number,
	sx: number,
	sy: number,
): number {
	const worldDx = sx - px;
	const worldDz = sy - py;
	// Camera-relative bearing: the angle between the camera-forward
	// vector (which faces -Z in world space when yaw=0) and the
	// player→spawn vector, measured CCW in the XZ plane.
	//
	// Forward vector at yaw θ:
	//   fx = -sin(θ)
	//   fz = -cos(θ)
	// Right vector (perpendicular, CCW from forward in screen):
	//   rx =  cos(θ)
	//   rz = -sin(θ)
	//
	// Project (worldDx, worldDz) onto (forward, right):
	//   forward_component = worldDx * fx + worldDz * fz
	//   right_component   = worldDx * rx + worldDz * rz
	//
	// Screen-space angle (0 = up, CCW positive) is:
	//   atan2(right_component, forward_component)
	const sin = Math.sin(yaw);
	const cos = Math.cos(yaw);
	const forwardComp = worldDx * -sin + worldDz * -cos;
	const rightComp = worldDx * cos + worldDz * -sin;
	return Math.atan2(rightComp, forwardComp);
}
