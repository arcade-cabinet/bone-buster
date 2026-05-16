// Y4/Y5/Y6 — pure helpers in yukaIntegration.ts that don't touch the
// yuka entity manager. EntityManager + GameEntity interaction is
// covered by the e2e gate (Y10).

import {
	buildNavmeshFromSectors,
	yukaAvoidObstacles,
	yukaProjectileStep,
	yukaStepToward,
	yukaWanderTarget,
} from "@ai/yukaIntegration";
import { describe, expect, it } from "vitest";
import { loadRefLevel } from "@/refLevel";

describe("yukaStepToward (Y1/Y3)", () => {
	it("returns origin unchanged when from === to", () => {
		const r = yukaStepToward({ x: 5, y: 5 }, { x: 5, y: 5 }, 2, 0.016);
		expect(r.x).toBeCloseTo(5, 5);
		expect(r.y).toBeCloseTo(5, 5);
	});

	it("steps toward target at speed * dt and never overshoots", () => {
		const r = yukaStepToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 5, 0.5);
		expect(r.x).toBeCloseTo(2.5, 5);
		expect(r.y).toBeCloseTo(0, 5);
	});

	it("clamps to the target when the would-be step exceeds the distance", () => {
		const r = yukaStepToward({ x: 0, y: 0 }, { x: 1, y: 0 }, 100, 1);
		expect(r.x).toBeCloseTo(1, 5);
	});

	it("steps in the correct diagonal direction", () => {
		const r = yukaStepToward({ x: 0, y: 0 }, { x: 3, y: 4 }, 5, 1);
		// 3-4-5 triangle: full distance is 5; speed*dt = 5 → arrives at (3, 4).
		expect(r.x).toBeCloseTo(3, 5);
		expect(r.y).toBeCloseTo(4, 5);
	});
});

describe("yukaWanderTarget (Y2)", () => {
	it("projects target onto a circle of the given radius", () => {
		const r = yukaWanderTarget({ x: 0, y: 0 }, 0, 1);
		expect(r.x).toBeCloseTo(1, 5);
		expect(r.y).toBeCloseTo(0, 5);
	});

	it("rotates with the bearing", () => {
		const r = yukaWanderTarget({ x: 0, y: 0 }, Math.PI / 2, 2);
		expect(r.x).toBeCloseTo(0, 5);
		expect(r.y).toBeCloseTo(2, 5);
	});
});

describe("yukaProjectileStep (Y5)", () => {
	it("advances by velocity * dt", () => {
		const r = yukaProjectileStep({ x: 0, y: 0 }, { x: 3, y: -4 }, 0.5);
		expect(r.x).toBeCloseTo(1.5, 5);
		expect(r.y).toBeCloseTo(-2, 5);
	});

	it("zero velocity yields zero motion", () => {
		const r = yukaProjectileStep({ x: 1, y: 2 }, { x: 0, y: 0 }, 5);
		expect(r.x).toBe(1);
		expect(r.y).toBe(2);
	});
});

describe("yukaAvoidObstacles (Y4)", () => {
	it("returns the original target when no obstacle is hit", () => {
		const r = yukaAvoidObstacles({ x: 0, y: 0 }, { x: 5, y: 0 }, 2, () => false);
		expect(r.x).toBe(5);
		expect(r.y).toBe(0);
	});

	it("deflects to a clear side when the direct probe collides", () => {
		const r = yukaAvoidObstacles(
			{ x: 0, y: 0 },
			{ x: 5, y: 0 },
			2,
			// Wall only on the +y deflect side; -y deflect is clear.
			(p) => p.y >= 0,
		);
		expect(r.y).toBeLessThan(0);
	});

	it("returns the original target when BOTH deflects collide too", () => {
		const r = yukaAvoidObstacles({ x: 0, y: 0 }, { x: 5, y: 0 }, 2, () => true);
		// Hopeless case — return the original target so the caller can
		// resolve through the normal collision dispatcher.
		expect(r.x).toBe(5);
		expect(r.y).toBe(0);
	});
});

describe("buildNavmeshFromSectors (Y6)", () => {
	it("produces a non-empty navmesh for E1M1", () => {
		const map = loadRefLevel(0);
		const navmesh = buildNavmeshFromSectors(map);
		expect(navmesh.regions.length).toBeGreaterThan(0);
		expect(navmesh.bounds.minX).toBeLessThan(navmesh.bounds.maxX);
		expect(navmesh.bounds.minY).toBeLessThan(navmesh.bounds.maxY);
	});

	it("region ids match the source sector ids 1:1", () => {
		const map = loadRefLevel(2);
		const navmesh = buildNavmeshFromSectors(map);
		const navIds = navmesh.regions.map((r) => r.id).sort();
		const sectorIds = map.sectors.map((s) => s.id).sort();
		expect(navIds).toEqual(sectorIds);
	});

	it("floorHeight is preserved per region", () => {
		const map = loadRefLevel(0);
		const navmesh = buildNavmeshFromSectors(map);
		for (let i = 0; i < navmesh.regions.length; i += 1) {
			expect(navmesh.regions[i].floorHeight).toBe(map.sectors[i].floorHeight);
		}
	});
});
