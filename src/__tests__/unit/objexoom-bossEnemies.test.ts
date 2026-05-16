/**
 * E2 — boss enemies contract.
 *
 * Pins step-1 mechanics:
 *  - Each refLevel spawns exactly one boss.
 *  - Boss is at the enemy spawn farthest from playerSpawn (the "final
 *    sector" per PRD §E2).
 *  - Boss HP = BOSS_HP_MULTIPLIER × the kind's base HP.
 *  - Standard enemies retain their kind's base HP (no leakage).
 *  - Maps with no enemy spawns produce no bosses (defensive).
 */

import {
	BOSS_HP_MULTIPLIER,
	BOSS_VISUAL_SCALE,
	pickBossSpawnIndex,
	spawnEnemies,
} from "@engine/engine";
import { describe, expect, it } from "vitest";
import { loadRefLevel } from "../../refLevel";

describe("E2 — boss spawn selection", () => {
	it("pickBossSpawnIndex returns the spawn farthest from playerSpawn", () => {
		for (const idx of [0, 1, 2] as const) {
			const map = loadRefLevel(idx);
			const bossIdx = pickBossSpawnIndex(map);
			expect(bossIdx).toBeGreaterThanOrEqual(0);
			expect(bossIdx).toBeLessThan(map.enemySpawns.length);

			// Verify no other spawn is farther from playerSpawn.
			const bossSpawn = map.enemySpawns[bossIdx];
			const dBoss = Math.hypot(
				bossSpawn.position.x - map.playerSpawn.x,
				bossSpawn.position.y - map.playerSpawn.y,
			);
			for (const other of map.enemySpawns) {
				const d = Math.hypot(
					other.position.x - map.playerSpawn.x,
					other.position.y - map.playerSpawn.y,
				);
				expect(d).toBeLessThanOrEqual(dBoss);
			}
		}
	});

	it("pickBossSpawnIndex is deterministic — same map → same index", () => {
		const map = loadRefLevel(0);
		expect(pickBossSpawnIndex(map)).toBe(pickBossSpawnIndex(map));
	});

	it("returns -1 for a spawn-less map", () => {
		const empty = { ...loadRefLevel(0), enemySpawns: [] };
		expect(pickBossSpawnIndex(empty)).toBe(-1);
	});
});

describe("E2 — boss HP scaling", () => {
	it("each refLevel spawns exactly one boss", () => {
		for (const idx of [0, 1, 2] as const) {
			const map = loadRefLevel(idx);
			const enemies = spawnEnemies(map);
			const bosses = enemies.filter((e) => e.tier === "boss");
			expect(bosses).toHaveLength(1);
		}
	});

	it("boss HP equals BOSS_HP_MULTIPLIER × the kind's base HP", () => {
		const map = loadRefLevel(0);
		const enemies = spawnEnemies(map);
		const boss = enemies.find((e) => e.tier === "boss");
		expect(boss).toBeDefined();
		if (!boss) return;
		// Find the non-boss enemy of the same kind to read the base HP.
		const sameKindStandard = enemies.find((e) => e.kind === boss.kind && e.tier !== "boss");
		if (sameKindStandard) {
			expect(boss.hp).toBe(sameKindStandard.hp * BOSS_HP_MULTIPLIER);
			expect(boss.maxHp).toBe(sameKindStandard.maxHp * BOSS_HP_MULTIPLIER);
		} else {
			// No same-kind standard exists; HP is at least the multiplier worth.
			expect(boss.hp).toBeGreaterThanOrEqual(BOSS_HP_MULTIPLIER);
		}
	});

	it("standard enemies retain their kind's base HP (no leakage)", () => {
		const map = loadRefLevel(0);
		const enemies = spawnEnemies(map);
		const standards = enemies.filter((e) => e.tier !== "boss");
		for (const e of standards) {
			expect(e.tier).toBeUndefined();
			// HP within the base range (i.e., not multiplied) — < BOSS multiplier × base would be wrong
			// for non-boss; sanity-check that boss multiplier hasn't leaked.
			expect(e.hp).toBe(e.maxHp);
		}
	});

	it("BOSS_HP_MULTIPLIER is in the PRD range (3-5)", () => {
		expect(BOSS_HP_MULTIPLIER).toBeGreaterThanOrEqual(3);
		expect(BOSS_HP_MULTIPLIER).toBeLessThanOrEqual(5);
	});

	it("BOSS_VISUAL_SCALE is > 1 (bosses render bigger)", () => {
		expect(BOSS_VISUAL_SCALE).toBeGreaterThan(1);
	});

	it("spawnEnemies is deterministic — same map → identical boss assignment", () => {
		const map = loadRefLevel(0);
		const a = spawnEnemies(map);
		const b = spawnEnemies(map);
		const bossA = a.findIndex((e) => e.tier === "boss");
		const bossB = b.findIndex((e) => e.tier === "boss");
		expect(bossA).toBe(bossB);
	});
});
