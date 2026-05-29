/**
 * COV2 step-2 — anchor-piece scatter contract.
 */

import type { BoneBusterSectorMap, Vec2 } from "@engine/mapTypes";
import { LARGE_PROPS } from "@world/largeProps";
import { loadRefLevel } from "@world/refLevel";
import { blockerCirclesOf, spawnLargeProps } from "@world/scatter/largePropScatter";
import { describe, expect, it } from "vitest";

function reseed(map: BoneBusterSectorMap, seedPhrase: string): BoneBusterSectorMap {
	return { ...map, seedPhrase };
}

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
	seedPhrase: "fixture-0",
	archetype: "corridor",
	sectors: [
		{ id: 0, vertices: bigSquare(0, 0, 10), floorHeight: 0, ceilingHeight: 10 },
		{ id: 1, vertices: bigSquare(30, 0, 10), floorHeight: 0, ceilingHeight: 10 },
	],
	playerSpawn: { x: 0, y: 0 },
	playerYaw: 0,
	enemySpawns: [],
	pickupSpawns: [],
	keyPosition: { x: 30, y: 0 },
	exitPosition: { x: 30, y: 9 },
	bounds: { minX: -10, minY: -10, maxX: 40, maxY: 10 },
};

describe("COV2 — spawnLargeProps determinism", () => {
	it("is deterministic across reloads", () => {
		const map = reseed(SECTOR_FIXTURE, "lp-12345");
		const a = spawnLargeProps(map);
		const b = spawnLargeProps(map);
		expect(a.length).toBe(b.length);
		for (let i = 0; i < a.length; i += 1) {
			const ai = a[i];
			const bi = b[i];
			if (!ai || !bi) throw new Error(`scatter missing element at index ${i}`);
			expect(ai.id).toBe(bi.id);
			expect(ai.position.x).toBe(bi.position.x);
			expect(ai.position.y).toBe(bi.position.y);
			expect(ai.yaw).toBe(bi.yaw);
			expect(ai.def.id).toBe(bi.def.id);
		}
	});

	it("different seeds produce different layouts", () => {
		const a = spawnLargeProps(reseed(SECTOR_FIXTURE, "lp-1"));
		const b = spawnLargeProps(reseed(SECTOR_FIXTURE, "lp-2"));
		// Compare positions and ids — likelihood of identical scatter at
		// two random seeds across 2 sectors with mulberry32 is effectively 0.
		const aSig = a.map((i) => `${i.id}:${i.position.x.toFixed(3)}:${i.def.id}`).join("|");
		const bSig = b.map((i) => `${i.id}:${i.position.x.toFixed(3)}:${i.def.id}`).join("|");
		expect(aSig).not.toBe(bSig);
	});
});

describe("COV2 — large-prop scatter shape", () => {
	it("places ≤2 anchors per sector (sparser than props/debris)", () => {
		const map = reseed(SECTOR_FIXTURE, "lp-99");
		const out = spawnLargeProps(map);
		const perSector = new Map<number, number>();
		for (const inst of out) {
			const sectorId = Math.floor(inst.id / 100);
			perSector.set(sectorId, (perSector.get(sectorId) ?? 0) + 1);
		}
		for (const count of perSector.values()) {
			expect(count).toBeLessThanOrEqual(2);
			expect(count).toBeGreaterThanOrEqual(1);
		}
	});

	it("ids are unique per map", () => {
		const out = spawnLargeProps(reseed(SECTOR_FIXTURE, "lp-7"));
		const ids = new Set(out.map((i) => i.id));
		expect(ids.size).toBe(out.length);
	});

	it("every def is a LARGE_PROPS entry", () => {
		const out = spawnLargeProps(reseed(SECTOR_FIXTURE, "lp-11"));
		for (const inst of out) {
			expect(LARGE_PROPS).toContain(inst.def);
		}
	});

	it("yaw is finite and in [0, 2π)", () => {
		const out = spawnLargeProps(reseed(SECTOR_FIXTURE, "lp-13"));
		for (const inst of out) {
			expect(Number.isFinite(inst.yaw)).toBe(true);
			expect(inst.yaw).toBeGreaterThanOrEqual(0);
			expect(inst.yaw).toBeLessThan(Math.PI * 2);
		}
	});

	it("respects 5-tile skip-radius from playerSpawn / exit / key", () => {
		const map = reseed(SECTOR_FIXTURE, "lp-21");
		const anchors = [map.playerSpawn, map.exitPosition, map.keyPosition];
		for (const inst of spawnLargeProps(map)) {
			for (const a of anchors) {
				const d = Math.hypot(a.x - inst.position.x, a.y - inst.position.y);
				expect(d).toBeGreaterThanOrEqual(5);
			}
		}
	});

	it("works on a real ref level (loadRefLevel(0))", () => {
		const ref = loadRefLevel(0);
		const out = spawnLargeProps(ref);
		expect(out.length).toBeGreaterThan(0);
		for (const inst of out) {
			expect(LARGE_PROPS).toContain(inst.def);
		}
	});
});

describe("COV2 — blockerCirclesOf", () => {
	it("filters down to blocking entries only", () => {
		const map = reseed(SECTOR_FIXTURE, "lp-5");
		const all = spawnLargeProps(map);
		const blockers = blockerCirclesOf(all);
		for (const b of blockers) {
			expect(b.radius).toBeGreaterThan(0);
		}
		const blockingCount = all.filter((i) => i.def.blocking).length;
		expect(blockers.length).toBe(blockingCount);
	});

	it("empty list → empty blockers", () => {
		expect(blockerCirclesOf([])).toEqual([]);
	});

	it("non-blocking entries produce zero blockers", () => {
		const fakeAll = LARGE_PROPS.filter((p) => !p.blocking).map((def, i) => ({
			id: i,
			position: { x: 0, y: 0 },
			yaw: 0,
			def,
		}));
		expect(blockerCirclesOf(fakeAll)).toEqual([]);
	});
});
