/**
 * COV2 step-2 — circle-blocker collision contract.
 * Pins resolveCollisionAny's blocker-pushout behavior.
 */

import type { BoneBusterSectorMap, Vec2 } from "@engine/engine";
import { resolveCollisionAny } from "@engine/engine";
import { describe, expect, it } from "vitest";

const farSector: BoneBusterSectorMap = {
	kind: "sectors",
	seed: 0,
	archetype: "corridor",
	sectors: [
		{
			id: 0,
			vertices: [
				{ x: -50, y: -50 },
				{ x: 50, y: -50 },
				{ x: 50, y: 50 },
				{ x: -50, y: 50 },
			],
			floorHeight: 0,
			ceilingHeight: 10,
		},
	],
	playerSpawn: { x: 0, y: 0 },
	playerYaw: 0,
	enemySpawns: [],
	pickupSpawns: [],
	keyPosition: { x: 5, y: 0 },
	exitPosition: { x: 0, y: 5 },
	bounds: { minX: -50, minY: -50, maxX: 50, maxY: 50 },
};

describe("COV2 — blocker pushout in resolveCollisionAny", () => {
	it("pushes the actor out of a blocker circle", () => {
		const blocker = { position: { x: 0, y: 0 }, radius: 1 };
		const desired: Vec2 = { x: 0.3, y: 0 };
		const resolved = resolveCollisionAny(
			desired,
			farSector,
			{ portals: new Set(), blockers: [blocker] },
			0.3,
		);
		const d = Math.hypot(resolved.x - blocker.position.x, resolved.y - blocker.position.y);
		// Resolved point must be at least radius + actorRadius away.
		expect(d).toBeGreaterThanOrEqual(blocker.radius + 0.3 - 1e-6);
	});

	it("leaves the actor alone when outside every blocker", () => {
		const blocker = { position: { x: 0, y: 0 }, radius: 1 };
		const desired: Vec2 = { x: 10, y: 10 };
		const resolved = resolveCollisionAny(
			desired,
			farSector,
			{ portals: new Set(), blockers: [blocker] },
			0.3,
		);
		expect(resolved.x).toBeCloseTo(10);
		expect(resolved.y).toBeCloseTo(10);
	});

	it("absent blockers list is back-compatible (no extra pushout)", () => {
		const desired: Vec2 = { x: 0.3, y: 0 };
		const resolved = resolveCollisionAny(desired, farSector, { portals: new Set() }, 0.3);
		expect(resolved.x).toBeCloseTo(0.3);
		expect(resolved.y).toBeCloseTo(0);
	});
});
