/**
 * COV8 step-2 — trap scatter + tick-damage contract.
 */

import type { BoneBusterSectorMap, Vec2 } from "@engine/engine";
import {
	disarmSector,
	spawnTraps,
	TRAP_OVERLAP_RADIUS,
	TRIGGER_OVERLAP_RADIUS,
	trapAt,
	triggerAt,
} from "@world/scatter/trapScatter";
import { describe, expect, it } from "vitest";

function bigSquare(cx: number, cy: number, size: number): readonly Vec2[] {
	return [
		{ x: cx - size, y: cy - size },
		{ x: cx + size, y: cy - size },
		{ x: cx + size, y: cy + size },
		{ x: cx - size, y: cy + size },
	];
}

const SECTOR_FIXTURE: BoneBusterSectorMap = {
	kind: "sectors",
	seed: 1, // % 5 = 1 → arena (heavier trap density)
	archetype: "arena",
	sectors: [
		{ id: 0, vertices: bigSquare(0, 0, 10), floorHeight: 0, ceilingHeight: 10 },
		{ id: 1, vertices: bigSquare(30, 0, 10), floorHeight: 0, ceilingHeight: 10 },
		{ id: 2, vertices: bigSquare(0, 30, 10), floorHeight: 0, ceilingHeight: 10 },
	],
	playerSpawn: { x: 0, y: 0 },
	playerYaw: 0,
	enemySpawns: [],
	pickupSpawns: [],
	keyPosition: { x: 30, y: 0 },
	exitPosition: { x: 30, y: 9 },
	bounds: { minX: -10, minY: -10, maxX: 40, maxY: 40 },
};

function reseed(seed: number): BoneBusterSectorMap {
	return { ...SECTOR_FIXTURE, seed };
}

describe("COV8 step-2 — spawnTraps determinism", () => {
	it("same seed → byte-identical scatter", () => {
		const a = spawnTraps(reseed(42));
		const b = spawnTraps(reseed(42));
		expect(a.length).toBe(b.length);
		for (let i = 0; i < a.length; i += 1) {
			expect(a[i].id).toBe(b[i].id);
			expect(a[i].position.x).toBe(b[i].position.x);
			expect(a[i].position.y).toBe(b[i].position.y);
			expect(a[i].def.id).toBe(b[i].def.id);
		}
	});

	it("returns [] for grid maps", () => {
		const grid = { ...SECTOR_FIXTURE, kind: "grid" } as unknown as BoneBusterSectorMap;
		expect(spawnTraps(grid as unknown as BoneBusterSectorMap)).toEqual([]);
	});

	it("places at least one trap on arena-archetype maps (heavy density)", () => {
		const arena = reseed(1); // arena archetype
		const out = spawnTraps(arena);
		expect(out.length).toBeGreaterThan(0);
	});

	it("respects skip-radius from spawn/exit/key (≥3 tiles)", () => {
		const map = reseed(7);
		const anchors = [map.playerSpawn, map.exitPosition, map.keyPosition];
		for (const t of spawnTraps(map)) {
			for (const a of anchors) {
				const d = Math.hypot(a.x - t.position.x, a.y - t.position.y);
				expect(d).toBeGreaterThanOrEqual(3);
			}
		}
	});

	it("yaw is finite + in [0, 2π)", () => {
		for (const t of spawnTraps(reseed(11))) {
			expect(Number.isFinite(t.yaw)).toBe(true);
			expect(t.yaw).toBeGreaterThanOrEqual(0);
			expect(t.yaw).toBeLessThan(Math.PI * 2);
		}
	});

	it("ids are unique per map", () => {
		const out = spawnTraps(reseed(99));
		const ids = new Set(out.map((t) => t.id));
		expect(ids.size).toBe(out.length);
	});

	it("disarmed flag starts false on every instance", () => {
		for (const t of spawnTraps(reseed(3))) {
			expect(t.disarmed).toBe(false);
		}
	});
});

describe("COV8 step-2 — disarmSector + triggerAt + trapAt", () => {
	it("disarmSector flips every trap in the matching sector", () => {
		const traps = spawnTraps(reseed(1));
		const sectorIds = new Set(traps.map((t) => t.sectorId));
		const targetSector = [...sectorIds][0];
		const targetCount = traps.filter((t) => t.sectorId === targetSector).length;

		const disarmed = disarmSector(traps, targetSector);
		expect(disarmed).toBe(targetCount);
		for (const t of traps) {
			if (t.sectorId === targetSector) expect(t.disarmed).toBe(true);
			else expect(t.disarmed).toBe(false);
		}
	});

	it("disarmSector returns 0 when called twice on the same sector", () => {
		const traps = spawnTraps(reseed(1));
		if (traps.length === 0) return; // trivially pass
		const sid = traps[0].sectorId;
		disarmSector(traps, sid);
		expect(disarmSector(traps, sid)).toBe(0);
	});

	it("trapAt finds hazards within radius and ignores disarmed/trigger entries", () => {
		const traps = spawnTraps(reseed(1));
		const hazard = traps.find((t) => t.def.kind !== "trigger");
		if (!hazard) return;
		expect(trapAt(traps, hazard.position, TRAP_OVERLAP_RADIUS)).toBe(hazard);
		hazard.disarmed = true;
		expect(trapAt(traps, hazard.position, TRAP_OVERLAP_RADIUS)).toBeNull();
	});

	it("triggerAt only matches trigger-kind entries", () => {
		const traps = spawnTraps(reseed(1));
		const trigger = traps.find((t) => t.def.kind === "trigger");
		const hazard = traps.find((t) => t.def.kind !== "trigger");
		if (!trigger || !hazard) return;
		expect(triggerAt(traps, trigger.position, TRIGGER_OVERLAP_RADIUS)).toBe(trigger);
		expect(triggerAt(traps, hazard.position, TRIGGER_OVERLAP_RADIUS)).toBeNull();
	});

	it("trapAt returns null when no overlap", () => {
		const traps = spawnTraps(reseed(1));
		expect(trapAt(traps, { x: 9999, y: 9999 }, TRAP_OVERLAP_RADIUS)).toBeNull();
	});
});
