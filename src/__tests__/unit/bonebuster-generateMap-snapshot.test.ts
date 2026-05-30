/**
 * STRUCT1 guard — byte-snapshot of generateMap's full output for fixed seeds.
 *
 * The MazeGenerator-core extraction (STRUCT1) moves the topology code out of
 * generateMap into src/engine/maze/. That refactor MUST be byte-identical — the
 * RNG draw order can't shift or every seeded map (and the canonical screenshots)
 * changes. This pins a stable JSON snapshot of the generated map across a few
 * representative phrases so any determinism drift during the extraction turns
 * this test red immediately.
 *
 * Snapshot includes: cells (the carved grid), playerSpawn, exit/key/door cells,
 * enemySpawns, pickupSpawns, archetype. If a deliberate generation change lands
 * later, re-bless with `--update-snapshots` (and expect canonical screenshots to
 * re-bless too).
 */

import { generateMap } from "@engine/gridGen";
import { describe, expect, it } from "vitest";

const PHRASES = ["marrowed-vile-sepulcher", "grim-hollow-ossuary", "test-1", "test-0"];

describe("STRUCT1 guard — generateMap byte-stability", () => {
	for (const phrase of PHRASES) {
		it(`is byte-stable for "${phrase}"`, () => {
			const map = generateMap(phrase);
			// Stable, fully-serialised fingerprint of the generated map.
			const snapshot = JSON.stringify({
				archetype: map.archetype,
				width: map.width,
				height: map.height,
				cells: map.cells,
				playerSpawn: map.playerSpawn,
				keyPosition: map.keyPosition,
				exitPosition: map.exitPosition,
				doorCell: map.doorCell,
				enemySpawns: map.enemySpawns,
				pickupSpawns: map.pickupSpawns,
			});
			expect(snapshot).toMatchSnapshot();
		});
	}

	it("is identical across two calls (same phrase → same map)", () => {
		const a = generateMap("marrowed-vile-sepulcher");
		const b = generateMap("marrowed-vile-sepulcher");
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});

	// STRUCT1/STRUCT3 — depth>0 forks a fresh per-depth maze stream
	// (forkStream(phrase, "MAZE-<depth>")) and scales difficulty. The depth-0
	// snapshots above can't catch a regression in the deep-gen path, so pin a
	// couple of representative deeper levels too (review T-4).
	for (const depth of [1, 2, 5] as const) {
		it(`is byte-stable at depth ${depth} for the canonical phrase`, () => {
			const map = generateMap("marrowed-vile-sepulcher", { depth, biome: "corridor" });
			const snapshot = JSON.stringify({
				archetype: map.archetype,
				width: map.width,
				height: map.height,
				cells: map.cells,
				playerSpawn: map.playerSpawn,
				keyPosition: map.keyPosition,
				exitPosition: map.exitPosition,
				doorCell: map.doorCell,
				enemySpawns: map.enemySpawns,
				pickupSpawns: map.pickupSpawns,
			});
			expect(snapshot).toMatchSnapshot();
		});
	}

	it("depth>0 is deterministic (same phrase+depth → same map)", () => {
		const a = generateMap("grim-hollow-ossuary", { depth: 3, biome: "sewer" });
		const b = generateMap("grim-hollow-ossuary", { depth: 3, biome: "sewer" });
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});

	it("different depths yield different geometry (the descent forks per depth)", () => {
		const d1 = generateMap("grim-hollow-ossuary", { depth: 1, biome: "sewer" });
		const d2 = generateMap("grim-hollow-ossuary", { depth: 2, biome: "sewer" });
		expect(JSON.stringify(d1.cells)).not.toBe(JSON.stringify(d2.cells));
	});
});
