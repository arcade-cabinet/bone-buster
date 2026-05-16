/**
 * E13 step-3 — per-archetype enemy mix contract.
 */

import { ENEMY_MIX_WEIGHTS, remapEnemyMix } from "@ai/enemyMix";
import type { EnemyKind, EnemySpawn } from "@engine/engine";
import { ARCHETYPE_NAMES } from "@world/archetype";
import { describe, expect, it } from "vitest";

function makeSpawns(count: number, kind: EnemyKind = "skeleton"): EnemySpawn[] {
	return Array.from({ length: count }, (_, i) => ({
		kind,
		position: { x: i, y: 0 },
	}));
}

describe("E13 step-3 — remapEnemyMix", () => {
	it("preserves total spawn count for every archetype", () => {
		const spawns = makeSpawns(20);
		for (const archetype of ARCHETYPE_NAMES) {
			const out = remapEnemyMix(spawns, archetype, 12345);
			expect(out.length).toBe(spawns.length);
		}
	});

	it("preserves position + order (only `kind` may change)", () => {
		const spawns = makeSpawns(15);
		for (const archetype of ARCHETYPE_NAMES) {
			const out = remapEnemyMix(spawns, archetype, 7);
			for (let i = 0; i < spawns.length; i += 1) {
				expect(out[i].position.x).toBe(spawns[i].position.x);
				expect(out[i].position.y).toBe(spawns[i].position.y);
			}
		}
	});

	it("corridor is pass-through (preserves pre-step-3 baseline byte-for-byte)", () => {
		const spawns = makeSpawns(10, "skeleton");
		const out = remapEnemyMix(spawns, "corridor", 99999);
		expect(out).toBe(spawns); // same reference — explicit pass-through.
	});

	it("non-corridor archetypes produce determinism — same seed yields same kinds", () => {
		const spawns = makeSpawns(30);
		for (const archetype of ARCHETYPE_NAMES) {
			if (archetype === "corridor") continue;
			const a = remapEnemyMix(spawns, archetype, 4242);
			const b = remapEnemyMix(spawns, archetype, 4242);
			expect(a.map((s) => s.kind)).toEqual(b.map((s) => s.kind));
		}
	});

	it("different seeds produce different (or at minimum: not always identical) mixes", () => {
		const spawns = makeSpawns(40);
		for (const archetype of ARCHETYPE_NAMES) {
			if (archetype === "corridor") continue;
			const a = remapEnemyMix(spawns, archetype, 1)
				.map((s) => s.kind)
				.join(",");
			const b = remapEnemyMix(spawns, archetype, 99999)
				.map((s) => s.kind)
				.join(",");
			expect(a).not.toBe(b);
		}
	});

	it("output kinds are always one of skeleton/wraith/imp", () => {
		const valid: ReadonlySet<EnemyKind> = new Set(["skeleton", "wraith", "imp"]);
		const spawns = makeSpawns(50);
		for (const archetype of ARCHETYPE_NAMES) {
			for (const s of remapEnemyMix(spawns, archetype, 3)) {
				expect(valid.has(s.kind)).toBe(true);
			}
		}
	});

	it("respects per-archetype weight tilt — sewer leans wraith over a large sample", () => {
		const spawns = makeSpawns(500);
		const out = remapEnemyMix(spawns, "sewer", 1234);
		const wraithCount = out.filter((s) => s.kind === "wraith").length;
		const skeletonCount = out.filter((s) => s.kind === "skeleton").length;
		// Sewer weight tuple is [2, 5, 2] — wraith should dominate.
		expect(wraithCount).toBeGreaterThan(skeletonCount);
	});

	it("respects per-archetype weight tilt — arena leans imp over a large sample", () => {
		const spawns = makeSpawns(500);
		const out = remapEnemyMix(spawns, "arena", 1234);
		const impCount = out.filter((s) => s.kind === "imp").length;
		const wraithCount = out.filter((s) => s.kind === "wraith").length;
		// Arena weight tuple is [3, 1, 5] — imp dominates, wraith is rare.
		expect(impCount).toBeGreaterThan(wraithCount);
	});

	it("every archetype has a weight tuple of length 3", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			expect(ENEMY_MIX_WEIGHTS[archetype].length).toBe(3);
		}
	});

	it("empty spawn list passes through without error for every archetype", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			expect(remapEnemyMix([], archetype, 0)).toEqual([]);
		}
	});
});
