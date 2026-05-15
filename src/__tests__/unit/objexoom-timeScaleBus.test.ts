import { describe, expect, it } from "vitest";
import { createTimeScaleBus } from "../../scene/tick/timeScaleBus";

describe("timeScaleBus (POL35)", () => {
	it("combines reservations via min — strictest scale wins", () => {
		const bus = createTimeScaleBus();
		const now = 1000;
		bus.reserve("hitstop", 0.05, now + 100);
		bus.reserve("key-acquire", 0.55, now + 200);
		expect(bus.getCombinedScale(now + 50)).toBe(0.05);
	});

	it("expires reservations at the until timestamp (strict inequality)", () => {
		const bus = createTimeScaleBus();
		bus.reserve("hitstop", 0.05, 200);
		expect(bus.getCombinedScale(199)).toBe(0.05);
		expect(bus.getCombinedScale(200)).toBe(1);
		expect(bus.getCombinedScale(500)).toBe(1);
	});

	it("returns 1 when no live reservations exist", () => {
		const bus = createTimeScaleBus();
		expect(bus.getCombinedScale(0)).toBe(1);
		expect(bus.getCombinedScale(99999)).toBe(1);
	});

	it("POL22 key-acquire (0.55, 220ms) + POL12 hitstop (0.05, 80ms) stack returns 0.05 while both live", () => {
		const bus = createTimeScaleBus();
		const t0 = 5000;
		bus.reserve("key-acquire", 0.55, t0 + 220);
		bus.reserve("hitstop", 0.05, t0 + 80);
		// Both live at t0+40: min = 0.05
		expect(bus.getCombinedScale(t0 + 40)).toBe(0.05);
		// Hitstop expired at t0+80: only key-acquire (0.55) remains
		expect(bus.getCombinedScale(t0 + 100)).toBe(0.55);
		// Key-acquire expired at t0+220: back to 1.0
		expect(bus.getCombinedScale(t0 + 250)).toBe(1);
	});

	it("release() drops a reservation immediately even before its until window", () => {
		const bus = createTimeScaleBus();
		bus.reserve("hitstop", 0.1, 1000);
		expect(bus.getCombinedScale(0)).toBe(0.1);
		bus.release("hitstop");
		expect(bus.getCombinedScale(0)).toBe(1);
	});

	it("reserve() replaces an existing reservation by id (last-write-wins per id)", () => {
		const bus = createTimeScaleBus();
		bus.reserve("hitstop", 0.5, 1000);
		bus.reserve("hitstop", 0.05, 1000);
		expect(bus.getCombinedScale(500)).toBe(0.05);
	});
});
