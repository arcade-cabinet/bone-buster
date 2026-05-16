import type { EnemySpawn } from "@engine/engine";
import { describe, expect, it } from "vitest";
import { ENEMY_MIX_WEIGHTS, remapEnemyMix } from "../../enemyMix";

/**
 * POL42 — per-archetype wraith density. Tests pin both the static
 * weight-table contract (corridor preserved, sewer wraith-heavy,
 * arena wraith-light) AND the runtime distribution (remapping a
 * large batch with seed=0 produces archetype-aligned wraith counts).
 */

describe("POL42 wraith density bias", () => {
	it("corridor still uses PASS_THROUGH (canonical preserved)", () => {
		expect(ENEMY_MIX_WEIGHTS.corridor).toEqual([0, 0, 0]);
	});

	it("sewer is wraith-dominant (bias 1.5× lifts wraith weight to 8)", () => {
		// Base [2, 5, 2] × wraith 1.5 = [2, 8, 2]
		expect(ENEMY_MIX_WEIGHTS.sewer[1]).toBe(8);
		// Wraith weight is the largest of the three
		const [skel, wraith, imp] = ENEMY_MIX_WEIGHTS.sewer;
		expect(wraith).toBeGreaterThan(skel);
		expect(wraith).toBeGreaterThan(imp);
	});

	it("library is wraith-heavier than its base 4 (bias 1.4× lifts to 6)", () => {
		// Base [4, 4, 1] × wraith 1.4 = [4, 6, 1]
		expect(ENEMY_MIX_WEIGHTS.library[1]).toBe(6);
		expect(ENEMY_MIX_WEIGHTS.library[1]).toBeGreaterThan(ENEMY_MIX_WEIGHTS.library[0]);
	});

	it("arena keeps a minimum-of-1 wraith floor (bias 0.7×, max(1, round(0.7))=1)", () => {
		// Base [3, 1, 5] × wraith 0.7 → round(0.7) = 1, but max(1, …) = 1
		expect(ENEMY_MIX_WEIGHTS.arena[1]).toBe(1);
	});

	it("courtyard is unbiased (1.0× preserves base wraith weight 3)", () => {
		expect(ENEMY_MIX_WEIGHTS.courtyard).toEqual([4, 3, 2]);
	});

	it("non-wraith weights (skeleton + imp) are NOT touched by the bias", () => {
		// Verify skeleton and imp positions equal their base values
		// (only index 1 wraith is biased)
		expect(ENEMY_MIX_WEIGHTS.arena[0]).toBe(3);
		expect(ENEMY_MIX_WEIGHTS.arena[2]).toBe(5);
		expect(ENEMY_MIX_WEIGHTS.sewer[0]).toBe(2);
		expect(ENEMY_MIX_WEIGHTS.sewer[2]).toBe(2);
		expect(ENEMY_MIX_WEIGHTS.library[0]).toBe(4);
		expect(ENEMY_MIX_WEIGHTS.library[2]).toBe(1);
	});

	it("runtime remap: sewer produces more wraiths than arena for the same spawn batch + seed", () => {
		const batch: EnemySpawn[] = Array.from({ length: 200 }, () => ({
			kind: "skeleton",
			position: { x: 0, y: 0 },
		}));
		const sewerRemap = remapEnemyMix(batch, "sewer", 42);
		const arenaRemap = remapEnemyMix(batch, "arena", 42);
		const sewerWraiths = sewerRemap.filter((s) => s.kind === "wraith").length;
		const arenaWraiths = arenaRemap.filter((s) => s.kind === "wraith").length;
		expect(sewerWraiths).toBeGreaterThan(arenaWraiths);
	});

	it("runtime remap: corridor passes through unchanged (refLevel 0 byte-stable)", () => {
		const batch: EnemySpawn[] = [
			{ kind: "skeleton", position: { x: 0, y: 0 } },
			{ kind: "imp", position: { x: 0, y: 0 } },
			{ kind: "wraith", position: { x: 0, y: 0 } },
		];
		const remap = remapEnemyMix(batch, "corridor", 12345);
		// PASS_THROUGH returns the same reference
		expect(remap).toBe(batch);
		expect(remap.map((s) => s.kind)).toEqual(["skeleton", "imp", "wraith"]);
	});
});
