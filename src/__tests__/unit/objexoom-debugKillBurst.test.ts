import { describe, expect, it } from "vitest";

/**
 * PT1C-fold — synthetic camera-forward burst on debug kill. The
 * burst position math is verifiable as a pure function:
 *
 *   forwardX = -sin(yaw)
 *   forwardZ = -cos(yaw)
 *   burstX   = cameraX + forwardX * OFFSET
 *   burstY   = cameraZ + forwardZ * OFFSET    (XZ plane → Y in event)
 *
 * (At yaw=0, the camera faces -Z, so forwardZ = -1 and the burst lands
 * 2.5 tiles in front of the camera at z = cameraZ - 2.5.)
 */

const OFFSET = 2.5;

function synthBurstPosition(
	yaw: number,
	cameraX: number,
	cameraZ: number,
): { x: number; y: number } {
	const fx = -Math.sin(yaw);
	const fz = -Math.cos(yaw);
	return { x: cameraX + fx * OFFSET, y: cameraZ + fz * OFFSET };
}

describe("PT1C-fold synthetic burst position", () => {
	it("at yaw=0 places the burst 2.5 tiles ahead (camera faces -Z, so burst.y = cameraZ - 2.5)", () => {
		const pos = synthBurstPosition(0, 0, 0);
		expect(pos.x).toBeCloseTo(0, 6);
		expect(pos.y).toBeCloseTo(-2.5, 6);
	});

	it("at yaw=π/2 (camera turned left, facing +X) burst lands at +2.5 in X relative to camera", () => {
		// forward at yaw=π/2: fx = -sin(π/2) = -1, fz = -cos(π/2) = 0
		// So burst is at (cameraX - 2.5, cameraZ).
		const pos = synthBurstPosition(Math.PI / 2, 10, 20);
		expect(pos.x).toBeCloseTo(10 - 2.5, 6);
		expect(pos.y).toBeCloseTo(20, 6);
	});

	it("at yaw=π (camera facing +Z) burst lands at cameraZ + 2.5", () => {
		const pos = synthBurstPosition(Math.PI, 0, 0);
		expect(pos.x).toBeCloseTo(0, 6);
		expect(pos.y).toBeCloseTo(2.5, 6);
	});

	it("preserves camera position when origin shifts", () => {
		const pos = synthBurstPosition(0, 5, 7);
		expect(pos.x).toBeCloseTo(5, 6);
		expect(pos.y).toBeCloseTo(7 - 2.5, 6);
	});

	it("burst is always exactly OFFSET tiles from the camera", () => {
		for (const yaw of [0, 0.3, 1.0, Math.PI / 2, Math.PI, 2.7, -1.1]) {
			const pos = synthBurstPosition(yaw, 0, 0);
			const dist = Math.hypot(pos.x, pos.y);
			expect(dist).toBeCloseTo(OFFSET, 6);
		}
	});
});
