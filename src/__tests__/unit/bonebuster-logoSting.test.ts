/**
 * R6 — logo sting dedup contract.
 *
 * The sting must fire exactly once per session even if the landing
 * mount runs multiple times (which it does on a soft-navigate back
 * to the menu). Module-level `played` flag in src/audio/logoSting.ts
 * provides the dedup.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@audio/howlerBus", () => ({
	play: vi.fn(),
}));

const { play } = await import("@audio/howlerBus");
const { playLogoSting, resetLogoStingForTesting } = await import("@audio/logoSting");

describe("R6 — logo sting", () => {
	beforeEach(() => {
		resetLogoStingForTesting();
		(play as unknown as { mockClear: () => void }).mockClear();
	});

	it("fires the mission-complete slot on first call", () => {
		playLogoSting();
		expect(play).toHaveBeenCalledTimes(1);
		expect(play).toHaveBeenCalledWith("system/mission-complete");
	});

	it("dedupes across subsequent calls (module-level flag)", () => {
		playLogoSting();
		playLogoSting();
		playLogoSting();
		expect(play).toHaveBeenCalledTimes(1);
	});

	it("resets cleanly via resetLogoStingForTesting", () => {
		playLogoSting();
		resetLogoStingForTesting();
		playLogoSting();
		expect(play).toHaveBeenCalledTimes(2);
	});
});
