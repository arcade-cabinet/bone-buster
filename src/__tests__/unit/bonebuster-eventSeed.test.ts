import { advanceEventSeed, createEventPrng } from "@engine/rng";
import { describe, expect, it } from "vitest";

// SEED4 — the persistence wrapper is thin (Preferences I/O); the determinism
// contract that matters is the advance logic in rng.ts. Pin that advancing a
// seed is deterministic + yields a different seed (so each New Game's event
// stream differs but replays from its committed seed).
describe("SEED4 — event seed advance", () => {
	it("advance is deterministic per source seed", () => {
		expect(advanceEventSeed(createEventPrng("evt-a"))).toBe(
			advanceEventSeed(createEventPrng("evt-a")),
		);
	});
	it("advancing yields a different seed", () => {
		expect(advanceEventSeed(createEventPrng("evt-a"))).not.toBe("evt-a");
	});
	it("different source seeds advance to different successors", () => {
		expect(advanceEventSeed(createEventPrng("evt-a"))).not.toBe(
			advanceEventSeed(createEventPrng("evt-b")),
		);
	});
});
