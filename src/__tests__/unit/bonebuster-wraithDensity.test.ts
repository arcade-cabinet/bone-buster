import { ENEMY_MIX_WEIGHTS, remapEnemyMix } from "@ai/enemyMix";
import type { EnemySpawn } from "@engine/engine";
import { describe, expect, it } from "vitest";

/**
 * POL42 — per-archetype phaser density. Tests pin both the static
 * weight-table contract (corridor preserved, sewer phaser-heavy,
 * arena phaser-light) AND the runtime distribution (remapping a
 * large batch with seed=0 produces archetype-aligned phaser counts).
 */

describe("POL42 phaser density bias", () => {
	it("corridor still uses PASS_THROUGH (canonical preserved)", () => {
		expect(ENEMY_MIX_WEIGHTS.corridor).toEqual([0, 0, 0]);
	});

	it("sewer is phaser-dominant (bias 1.5× lifts phaser weight to 8)", () => {
		// Base [2, 5, 2] × phaser 1.5 = [2, 8, 2]
		expect(ENEMY_MIX_WEIGHTS.sewer[1]).toBe(8);
		// Phaser weight is the largest of the three
		const [skel, phaser, bouncer] = ENEMY_MIX_WEIGHTS.sewer;
		expect(phaser).toBeGreaterThan(skel);
		expect(phaser).toBeGreaterThan(bouncer);
	});

	it("library is phaser-heavier than its base 4 (bias 1.4× lifts to 6)", () => {
		// Base [4, 4, 1] × phaser 1.4 = [4, 6, 1]
		expect(ENEMY_MIX_WEIGHTS.library[1]).toBe(6);
		expect(ENEMY_MIX_WEIGHTS.library[1]).toBeGreaterThan(ENEMY_MIX_WEIGHTS.library[0]);
	});

	it("arena keeps a minimum-of-1 phaser floor (bias 0.7×, max(1, round(0.7))=1)", () => {
		// Base [3, 1, 5] × phaser 0.7 → round(0.7) = 1, but max(1, …) = 1
		expect(ENEMY_MIX_WEIGHTS.arena[1]).toBe(1);
	});

	it("courtyard is unbiased (1.0× preserves base phaser weight 3)", () => {
		expect(ENEMY_MIX_WEIGHTS.courtyard).toEqual([4, 3, 2]);
	});

	it("non-phaser weights (rattler + bouncer) are NOT touched by the bias", () => {
		// Verify rattler and bouncer positions equal their base values
		// (only index 1 phaser is biased)
		expect(ENEMY_MIX_WEIGHTS.arena[0]).toBe(3);
		expect(ENEMY_MIX_WEIGHTS.arena[2]).toBe(5);
		expect(ENEMY_MIX_WEIGHTS.sewer[0]).toBe(2);
		expect(ENEMY_MIX_WEIGHTS.sewer[2]).toBe(2);
		expect(ENEMY_MIX_WEIGHTS.library[0]).toBe(4);
		expect(ENEMY_MIX_WEIGHTS.library[2]).toBe(1);
	});

	it("runtime remap: sewer produces more wraiths than arena for the same spawn batch + seed", () => {
		const batch: EnemySpawn[] = Array.from({ length: 200 }, () => ({
			kind: "rattler",
			position: { x: 0, y: 0 },
		}));
		const sewerRemap = remapEnemyMix(batch, "sewer", 42);
		const arenaRemap = remapEnemyMix(batch, "arena", 42);
		const sewerWraiths = sewerRemap.filter((s) => s.kind === "phaser").length;
		const arenaWraiths = arenaRemap.filter((s) => s.kind === "phaser").length;
		expect(sewerWraiths).toBeGreaterThan(arenaWraiths);
	});

	it("runtime remap: corridor passes through unchanged (refLevel 0 byte-stable)", () => {
		const batch: EnemySpawn[] = [
			{ kind: "rattler", position: { x: 0, y: 0 } },
			{ kind: "bouncer", position: { x: 0, y: 0 } },
			{ kind: "phaser", position: { x: 0, y: 0 } },
		];
		const remap = remapEnemyMix(batch, "corridor", 12345);
		// PASS_THROUGH returns the same reference
		expect(remap).toBe(batch);
		expect(remap.map((s) => s.kind)).toEqual(["rattler", "bouncer", "phaser"]);
	});
});
