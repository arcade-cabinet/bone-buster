/**
 * E5 — destructible barrel registry unit tests.
 *
 * The barrel module is pure-sim (no THREE / React) so it tests in
 * jsdom without any harness — exactly what the engine.ts tests look
 * like. Coverage:
 *
 *  - spawnBarrels: deterministic + reasonable count
 *  - pickRayBarrel: forward-only, perpendicular cutoff, closest-wins
 *  - resolveExplosion: AoE radius enforcement, chain detection,
 *    player-included
 */

import type { BoneBusterMap } from "@engine/engine";
import {
	BARREL_AOE_DAMAGE,
	BARREL_AOE_RADIUS,
	BARREL_HP,
	BARREL_PLAYER_AOE_DAMAGE,
	type Barrel,
	pickRayBarrel,
	resolveExplosion,
	spawnBarrels,
} from "@world/barrels";
import { describe, expect, it } from "vitest";

function makeMap(pickupCount: number, seed = 1): BoneBusterMap {
	return {
		kind: "grid",
		seed,
		width: 10,
		height: 10,
		cells: [],
		playerSpawn: { x: 1, y: 1 },
		playerYaw: 0,
		keyPosition: { x: 5, y: 5 },
		exitPosition: { x: 9, y: 9 },
		enemySpawns: [],
		pickupSpawns: Array.from({ length: pickupCount }, (_, i) => ({
			kind: "health" as const,
			position: { x: i + 1, y: i + 1 },
		})),
	} as unknown as BoneBusterMap;
}

describe("spawnBarrels", () => {
	it("is deterministic across runs with the same seed", () => {
		const a = spawnBarrels(makeMap(6, 42));
		const b = spawnBarrels(makeMap(6, 42));
		expect(a).toEqual(b);
	});

	it("produces nothing when there are no pickup anchors", () => {
		expect(spawnBarrels(makeMap(0))).toEqual([]);
	});

	it("caps at 3 even with abundant anchors", () => {
		expect(spawnBarrels(makeMap(20)).length).toBeLessThanOrEqual(3);
	});

	it("every spawned barrel has BARREL_HP and exploded=false", () => {
		for (const b of spawnBarrels(makeMap(6))) {
			expect(b.hp).toBe(BARREL_HP);
			expect(b.exploded).toBe(false);
		}
	});
});

describe("pickRayBarrel", () => {
	const barrels: Barrel[] = [
		{ id: 0, position: { x: 3, y: 0 }, hp: 3, exploded: false },
		{ id: 1, position: { x: 6, y: 0 }, hp: 3, exploded: false },
	];

	it("returns the closer barrel along a forward ray", () => {
		const hit = pickRayBarrel({ x: 0, y: 0 }, { x: 1, y: 0 }, barrels, 10);
		expect(hit?.barrel.id).toBe(0);
		expect(hit?.dist).toBeCloseTo(3, 5);
	});

	it("respects maxDist", () => {
		expect(pickRayBarrel({ x: 0, y: 0 }, { x: 1, y: 0 }, barrels, 2)).toBeNull();
	});

	it("ignores exploded barrels", () => {
		const b0 = barrels[0];
		const b1 = barrels[1];
		if (!b0 || !b1) throw new RangeError("barrels fixture missing expected elements");
		const withExploded: Barrel[] = [{ ...b0, exploded: true }, b1];
		const hit = pickRayBarrel({ x: 0, y: 0 }, { x: 1, y: 0 }, withExploded, 10);
		expect(hit?.barrel.id).toBe(1);
	});

	it("rejects perpendicular hits beyond BARREL_HIT_RADIUS", () => {
		const offAxis: Barrel[] = [{ id: 0, position: { x: 3, y: 2 }, hp: 3, exploded: false }];
		expect(pickRayBarrel({ x: 0, y: 0 }, { x: 1, y: 0 }, offAxis, 10)).toBeNull();
	});

	it("rejects backward hits", () => {
		const behind: Barrel[] = [{ id: 0, position: { x: -3, y: 0 }, hp: 3, exploded: false }];
		expect(pickRayBarrel({ x: 0, y: 0 }, { x: 1, y: 0 }, behind, 10)).toBeNull();
	});

	it("normalizes a non-unit-length dir so unit-mismatched callers stay correct", () => {
		const inLine: Barrel[] = [{ id: 0, position: { x: 5, y: 0 }, hp: 3, exploded: false }];
		// A dir vector of length 4 (instead of 1) would, pre-normalization,
		// scale the projected forward distance to 20 — falsely beyond the
		// 10-tile maxDist. After normalization the hit lands at t=5.
		const hit = pickRayBarrel({ x: 0, y: 0 }, { x: 4, y: 0 }, inLine, 10);
		expect(hit?.barrel.id).toBe(0);
		expect(hit?.dist).toBeCloseTo(5, 5);
	});

	it("returns null when dir is a zero vector", () => {
		const any: Barrel[] = [{ id: 0, position: { x: 5, y: 0 }, hp: 3, exploded: false }];
		expect(pickRayBarrel({ x: 0, y: 0 }, { x: 0, y: 0 }, any, 10)).toBeNull();
	});
});

describe("resolveExplosion", () => {
	const center: Barrel = { id: 0, position: { x: 5, y: 5 }, hp: 0, exploded: false };

	it("includes enemies within BARREL_AOE_RADIUS", () => {
		const enemies = [
			{ id: 100, position: { x: 5, y: 6 }, dead: false }, // inside
			{ id: 101, position: { x: 5 + BARREL_AOE_RADIUS + 0.5, y: 5 }, dead: false }, // outside
			{ id: 102, position: { x: 5, y: 5 }, dead: true }, // dead, skip
		];
		const result = resolveExplosion(center, enemies, [], { x: 100, y: 100 });
		expect(result.affectedEnemyIds).toEqual([100]);
		expect(result.enemyDamage).toBe(BARREL_AOE_DAMAGE);
	});

	it("flags chain barrels within radius and excludes the source + already-exploded", () => {
		const others: Barrel[] = [
			{ id: 1, position: { x: 5, y: 5 + 1 }, hp: 3, exploded: false }, // chain
			{ id: 2, position: { x: 5 + BARREL_AOE_RADIUS + 0.5, y: 5 }, hp: 3, exploded: false }, // out
			{ id: 3, position: { x: 5, y: 5 + 0.5 }, hp: 3, exploded: true }, // skip
		];
		const result = resolveExplosion(center, [], others, { x: 100, y: 100 });
		expect(result.chainBarrelIds).toEqual([1]);
	});

	it("hits the player when within radius and reports player damage", () => {
		const result = resolveExplosion(center, [], [], { x: 5, y: 5 + 1 });
		expect(result.hitsPlayer).toBe(true);
		expect(result.playerDamage).toBe(BARREL_PLAYER_AOE_DAMAGE);
	});

	it("does not hit the player when out of radius", () => {
		const result = resolveExplosion(center, [], [], {
			x: 5 + BARREL_AOE_RADIUS + 0.5,
			y: 5,
		});
		expect(result.hitsPlayer).toBe(false);
	});

	it("returns the exploding barrel's position so callers can spawn a burst at the right point", () => {
		const result = resolveExplosion(center, [], [], { x: 100, y: 100 });
		expect(result.position).toEqual({ x: 5, y: 5 });
	});
});
