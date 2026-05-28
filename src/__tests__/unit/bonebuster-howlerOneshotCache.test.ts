/**
 * CR-M1 — one-shot Howl caching. Repeated play() of a non-loop slug must
 * reuse a single cached Howl per variant FILE (not allocate a fresh Howl
 * each call), so rapid fire doesn't leak decoded buffers + Web-Audio nodes.
 * Concurrent shots layer via Howler's per-play() sound ids on that one Howl.
 *
 * We mock the `howler` package so we can count Howl constructions and
 * play()/unload() calls without a real AudioContext.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

let constructCount = 0;
const playSpy = vi.fn(() => 1);
const unloadSpy = vi.fn();

vi.mock("howler", () => ({
	Howl: class {
		// biome-ignore lint/suspicious/noExplicitAny: test mock accepts the Howl opts bag
		constructor(_opts: any) {
			constructCount += 1;
		}
		play = playSpy;
		stop = vi.fn();
		unload = unloadSpy;
		playing = () => false;
		volume = () => 1;
		fade = vi.fn();
		once = vi.fn();
	},
}));

const { play, resetForTesting } = await import("@audio/howlerBus");

describe("CR-M1 — one-shot Howl caching", () => {
	beforeEach(() => {
		resetForTesting();
		constructCount = 0;
		playSpy.mockClear();
		unloadSpy.mockClear();
	});

	it("caps Howl construction at the variant count regardless of play count", () => {
		// pistol/fire is a non-loop combat SFX with 3 variant files — the
		// canonical rapid-fire offender. Caching is per-variant-FILE, so 40
		// plays must construct at most 3 Howls (one per distinct variant the
		// PRNG happens to pick), NEVER one per play. Pre-CR-M1 this was 40
		// constructions + 40 leaked Howls.
		const PLAYS = 40;
		for (let i = 0; i < PLAYS; i++) play("weapon/pistol/fire");
		expect(constructCount).toBeLessThanOrEqual(3); // ≤ variant count
		expect(constructCount).toBeLessThan(PLAYS); // the leak is gone
		expect(playSpy).toHaveBeenCalledTimes(PLAYS); // every shot still plays
	});

	it("resetForTesting unloads the cached one-shot Howls", () => {
		play("weapon/pistol/fire");
		expect(constructCount).toBe(1);
		resetForTesting();
		expect(unloadSpy).toHaveBeenCalled();
		// After reset, the next play reconstructs (pool was cleared).
		constructCount = 0;
		play("weapon/pistol/fire");
		expect(constructCount).toBe(1);
	});
});
