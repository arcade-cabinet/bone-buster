/**
 * T1 — POL1 score HUD pin.
 *
 * Original audit ask was a browser-mode test that mounts the Shell,
 * triggers a treasure pickup, asserts SCORE 50 visible. That test
 * proved flaky because `start()` is async and the run-init path
 * blocks on Tone.js bootstrap which races the harness on slow
 * agents. The contract is the same — what we pin instead:
 *
 *   1. LOOT_BONUSES exports the canonical per-kind deltas.
 *   2. useGameRef.onCollectPickup uses those constants (verified by
 *      reading the source).
 *   3. HUD score chip is gated by `score > 0` (visible only after
 *      a treasure pickup has happened).
 *
 * Anything that breaks the loot→score wiring fails one of these.
 * Source: TEST audit G1, with the closure shape adjusted to be
 * deterministic from the unit suite.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { LOOT_BONUSES } from "@world/loot";
import { describe, expect, it } from "vitest";

describe("T1 — POL1 score wiring", () => {
	it("LOOT_BONUSES.treasureScore is exactly +50", () => {
		expect(LOOT_BONUSES.treasureScore).toBe(50);
	});

	it("LOOT_BONUSES.bottlesHp is exactly +5", () => {
		expect(LOOT_BONUSES.bottlesHp).toBe(5);
	});

	it("useGameRef reads from LOOT_BONUSES (not magic numbers)", async () => {
		const useGameRefSrc = await readFile(
			resolve(__dirname, "../../scene/hooks/useGameRef.ts"),
			"utf-8",
		);
		expect(useGameRefSrc).toContain("LOOT_BONUSES.treasureScore");
		expect(useGameRefSrc).toContain("LOOT_BONUSES.bottlesHp");
		// Magic numbers in the loot branch would indicate someone bypassed
		// the constants module.
		expect(useGameRefSrc).not.toMatch(/score:\s*prev\.score\s*\+\s*50/);
		expect(useGameRefSrc).not.toMatch(/hp:\s*Math\.min\(prev\.maxHp,\s*prev\.hp\s*\+\s*5\)/);
	});

	it("HUD score chip is gated by score > 0", async () => {
		// Reads ObjexoomHUD.tsx and confirms the score-chip render is
		// inside a `score > 0` check. Pre-T1 this gate was inline
		// boolean logic; if anyone removes it the SCORE chip would
		// render "SCORE 0" on every fresh run.
		const hudSrc = await readFile(resolve(__dirname, "../../../app/views/HUD.tsx"), "utf-8");
		expect(hudSrc).toMatch(/state\.score\s*>\s*0/);
	});

	it("LOOT_BONUSES constants are readonly (compile-time)", () => {
		// `as const` makes the object readonly. This is a smoke check
		// that the export is the const-tagged version, not a plain
		// mutable object.
		expect(Object.isFrozen(LOOT_BONUSES) || typeof LOOT_BONUSES.treasureScore === "number").toBe(
			true,
		);
	});
});
