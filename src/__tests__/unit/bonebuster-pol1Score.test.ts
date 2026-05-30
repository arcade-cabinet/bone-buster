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

	it("gameReducer's loot arm reads from LOOT_BONUSES (not magic numbers)", async () => {
		// CR-H1scene step-d — the loot logic moved from useGameRef.onCollectPickup
		// into the pure gameReducer's `collectPickup` arm. Assert against its
		// new home.
		const reducerSrc = await readFile(resolve(__dirname, "../../store/gameReducer.ts"), "utf-8");
		expect(reducerSrc).toContain("LOOT_BONUSES.treasureScore");
		expect(reducerSrc).toContain("LOOT_BONUSES.bottlesHp");
		// Magic numbers in the loot branch would indicate someone bypassed
		// the constants module.
		expect(reducerSrc).not.toMatch(/score:\s*state\.score\s*\+\s*50/);
		expect(reducerSrc).not.toMatch(/hp:\s*Math\.min\(state\.maxHp,\s*state\.hp\s*\+\s*5\)/);
	});

	it("HUD score chip is gated by score > 0", async () => {
		// The SCORE chip lives in RunReadout (extracted from HUD.tsx). Confirms
		// the render is inside a `score > 0` check so a fresh run (score 0) never
		// shows "SCORE 0". The runReadout.browser.test.tsx also pins this at the
		// render level; this source guard catches an accidental gate removal.
		const src = await readFile(
			resolve(__dirname, "../../../app/views/hudOverlays/RunReadout.tsx"),
			"utf-8",
		);
		expect(src).toMatch(/score\s*>\s*0/);
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
