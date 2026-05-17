/**
 * D5 — per-archetype enemy mix contract (24-kind expansion).
 *
 * Supersedes the E13-step-3 3-tuple contract. Each archetype carries a
 * Record<EnemyKind, number> whose values sum to 1.0; remapEnemyMix
 * draws each spawn's kind from that distribution.
 *
 * Pins:
 *   - Total spawn count + position + order preserved.
 *   - Each archetype's table sums to 1.0 (PRD §D5 acceptance).
 *   - Determinism: same seed → same kind sequence.
 *   - Different seeds produce different mixes.
 *   - Per-archetype headline kinds dominate over a large sample.
 *   - `devil` (boss-tier) never appears in any regular spawn.
 *   - Empty spawn list passes through.
 */

import { ENEMY_MIX_TABLES, remapEnemyMix } from "@ai/enemyMix";
import type { EnemyKind, EnemySpawn } from "@engine/engine";
import { ARCHETYPE_NAMES } from "@world/archetype";
import { describe, expect, it } from "vitest";

function makeSpawns(count: number, kind: EnemyKind = "rattler"): EnemySpawn[] {
	return Array.from({ length: count }, (_, i) => ({
		kind,
		position: { x: i, y: 0 },
	}));
}

describe("D5 — remapEnemyMix", () => {
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

	it("each archetype's distribution sums to 1.0 (PRD §D5 acceptance)", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			const table = ENEMY_MIX_TABLES[archetype];
			let total = 0;
			for (const v of Object.values(table)) total += v;
			expect(total).toBeCloseTo(1.0, 6);
		}
	});

	it("determinism — same seed yields same kind sequence", () => {
		const spawns = makeSpawns(30);
		for (const archetype of ARCHETYPE_NAMES) {
			const a = remapEnemyMix(spawns, archetype, 4242);
			const b = remapEnemyMix(spawns, archetype, 4242);
			expect(a.map((s) => s.kind)).toEqual(b.map((s) => s.kind));
		}
	});

	it("different seeds produce different mixes", () => {
		const spawns = makeSpawns(40);
		for (const archetype of ARCHETYPE_NAMES) {
			const a = remapEnemyMix(spawns, archetype, 1)
				.map((s) => s.kind)
				.join(",");
			const b = remapEnemyMix(spawns, archetype, 99999)
				.map((s) => s.kind)
				.join(",");
			expect(a).not.toBe(b);
		}
	});

	it("corridor headline kinds dominate over a large sample", () => {
		const spawns = makeSpawns(500);
		const out = remapEnemyMix(spawns, "corridor", 1234);
		const rattler = out.filter((s) => s.kind === "rattler").length;
		const bouncer = out.filter((s) => s.kind === "bouncer").length;
		// Corridor table puts rattler at weight 6 (largest); rattler
		// should be the most frequent kind by a clear margin.
		expect(rattler).toBeGreaterThan(bouncer);
		expect(rattler).toBeGreaterThan(150);
	});

	it("arena headline kinds dominate — bighoss + goliath > phaser-class spawns", () => {
		const spawns = makeSpawns(500);
		const out = remapEnemyMix(spawns, "arena", 1234);
		const heavyTanks =
			out.filter((s) => s.kind === "bighoss").length +
			out.filter((s) => s.kind === "goliath").length;
		// Arena puts bighoss+goliath at combined weight 7; should be
		// the heaviest cluster.
		expect(heavyTanks).toBeGreaterThan(150);
	});

	it("library headline kinds dominate — plaguebeak + gawker + reverend > all others", () => {
		const spawns = makeSpawns(500);
		const out = remapEnemyMix(spawns, "library", 1234);
		const headlines =
			out.filter((s) => s.kind === "plaguebeak").length +
			out.filter((s) => s.kind === "gawker").length +
			out.filter((s) => s.kind === "reverend").length;
		// Library puts these 3 at combined weight 9 of 12 total — they
		// should account for ≥60% of spawns.
		expect(headlines).toBeGreaterThan(300);
	});

	it("devil (boss-tier) never appears in any archetype's regular mix", () => {
		const spawns = makeSpawns(1000);
		for (const archetype of ARCHETYPE_NAMES) {
			const out = remapEnemyMix(spawns, archetype, 7777);
			const devilCount = out.filter((s) => s.kind === "devil").length;
			expect(devilCount).toBe(0);
		}
	});

	it("output kinds are always members of the 25-kind union", () => {
		const valid: ReadonlySet<EnemyKind> = new Set([
			"rattler",
			"phaser",
			"bouncer",
			"plaguebeak",
			"jester",
			"reverend",
			"stagged",
			"grub",
			"signal",
			"heap",
			"heap2",
			"gorehead",
			"bighoss",
			"stomper",
			"butcher",
			"bloodphaser",
			"devil",
			"dolly",
			"gawker",
			"oneye",
			"goliath",
			"swiney",
			"mrZ",
			"lupin",
			// PF2 — 25th kind added (bigfoot).
			"bigfoot",
		]);
		const spawns = makeSpawns(50);
		for (const archetype of ARCHETYPE_NAMES) {
			for (const s of remapEnemyMix(spawns, archetype, 3)) {
				expect(valid.has(s.kind)).toBe(true);
			}
		}
	});

	it("D5 + PF3 acceptance — 22 of 25 non-devil kinds reachable across 100 seeds × 5 archetypes", () => {
		// PF3 added `bigfoot` (kind #25) with arena + courtyard weights;
		// reachable count rises from 21 to 22. Three kinds remain
		// unreachable by procedural remap:
		//   - `devil` — boss-room gated (intentional)
		//   - `bloodphaser` — reserved for future archetype placement
		//   - `oneye` — reserved for future archetype placement
		// 100 seeds × 5 archetypes × 50 spawns = 25,000 draws is
		// plenty for every weighted kind to land at least once.
		const spawns = makeSpawns(50);
		const reached = new Set<EnemyKind>();
		for (let seed = 1; seed <= 100; seed += 1) {
			for (const archetype of ARCHETYPE_NAMES) {
				for (const s of remapEnemyMix(spawns, archetype, seed)) {
					reached.add(s.kind);
				}
			}
		}
		for (const k of ["devil", "bloodphaser", "oneye"] as const) reached.delete(k);
		expect(reached.size).toBe(22);
	});

	it("empty spawn list passes through without error for every archetype", () => {
		for (const archetype of ARCHETYPE_NAMES) {
			expect(remapEnemyMix([], archetype, 0)).toEqual([]);
		}
	});
});
