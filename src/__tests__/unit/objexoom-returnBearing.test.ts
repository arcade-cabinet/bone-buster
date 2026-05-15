import { describe, expect, it } from "vitest";
import { computeBearingRad } from "../../scene/hooks/returnBearing";

/**
 * PT4B-fold — screen-space bearing from camera to spawn.
 *
 * Convention: 0 = chevron points UP the screen (spawn is dead ahead),
 * positive = chevron rotates CCW (spawn is to the right in screen),
 * ±π = spawn is behind the player.
 *
 * The three.js camera at yaw=0 faces -Z. Rotating the camera left
 * (positive yaw) makes the world appear to rotate right; the bearing
 * to a fixed spawn point shifts equivalently.
 */

const EPSILON = 1e-9;

describe("PT4B-fold computeBearingRad", () => {
	it("points straight up (0 rad) when spawn is directly ahead at yaw=0 (along -Z)", () => {
		// Player at origin facing -Z; spawn at (0, -10) is dead ahead.
		const angle = computeBearingRad(0, 0, 0, 0, -10);
		expect(angle).toBeCloseTo(0, 6);
	});

	it("points down (±π) when spawn is directly behind", () => {
		// Player at origin facing -Z; spawn at (0, +10) is behind.
		const angle = computeBearingRad(0, 0, 0, 0, 10);
		expect(Math.abs(angle)).toBeCloseTo(Math.PI, 6);
	});

	it("points right (+π/2) when spawn is to the player's right at yaw=0", () => {
		// Player at origin facing -Z; right is +X. Spawn at (+10, 0).
		// Right_component = 10 * cos(0) - 0 * sin(0) = 10 (positive).
		// Forward_component = -10 * sin(0) - 0 * cos(0) = 0.
		// atan2(10, 0) = +π/2.
		const angle = computeBearingRad(0, 0, 0, 10, 0);
		expect(angle).toBeCloseTo(Math.PI / 2, 6);
	});

	it("points left (-π/2) when spawn is to the player's left at yaw=0", () => {
		const angle = computeBearingRad(0, 0, 0, -10, 0);
		expect(angle).toBeCloseTo(-Math.PI / 2, 6);
	});

	it("rotates bearing as camera turns (yaw=+π/2 puts forward-spawn to the player's right)", () => {
		// Spawn dead ahead at (0, -10). Camera yaw=+π/2 means camera-forward is now +X
		// (camera turned left). The world spawn at (0,-10) is now in the +Z direction
		// from the camera-forward perspective. Camera-right at yaw=+π/2 is +Z, so
		// the spawn IS to the player's right → screen-bearing = +π/2.
		const angleLeftTurn = computeBearingRad(Math.PI / 2, 0, 0, 0, -10);
		expect(angleLeftTurn).toBeCloseTo(+Math.PI / 2, 6);
		// Yaw = -π/2: camera-forward is -X, spawn at (0,-10) is to the player's left.
		const angleRightTurn = computeBearingRad(-Math.PI / 2, 0, 0, 0, -10);
		expect(angleRightTurn).toBeCloseTo(-Math.PI / 2, 6);
	});

	it("player at non-origin: bearing is relative to player position, not world origin", () => {
		// Player at (5, 5) facing -Z; spawn at (5, -5) is 10 units ahead.
		const angle = computeBearingRad(0, 5, 5, 5, -5);
		expect(angle).toBeCloseTo(0, 6);
	});

	it("is continuous (no NaN) at the singular point where player is on the spawn", () => {
		// atan2(0, 0) returns 0 by spec, not NaN.
		const angle = computeBearingRad(0, 5, 5, 5, 5);
		expect(Number.isFinite(angle)).toBe(true);
	});
});

void EPSILON;
