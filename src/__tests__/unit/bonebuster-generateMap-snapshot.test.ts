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
});
