/**
 * AUDIO1 — audio bus contract tests.
 *
 * The bus exists to prevent the "Start time must be strictly greater
 * than previous start time" Tone.js collision that surfaced repeatedly
 * (POL8 + POL21 + POL28 fix-forwards). Tests pin the minimum guarantee:
 * consecutive fires on the same channel produce strictly increasing
 * `t` values, and the schedule callback receives that `t`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fire, resetForTest } from "../../audioBus";

// Tone.now() is a thin wrapper over Tone.js's AudioContext time. In
// jsdom there's no audio context, so Tone.now() returns 0 — predictable
// for testing. We use that 0 baseline.
vi.mock("tone", () => ({
	now: () => 0,
}));

describe("AUDIO1 — audio bus", () => {
	beforeEach(() => {
		resetForTest();
	});

	it("first fire on a channel passes a non-negative t to the schedule callback", () => {
		let captured: number | null = null;
		fire("pickup", (t) => {
			captured = t;
		});
		expect(captured).not.toBeNull();
		expect(captured as unknown as number).toBeGreaterThanOrEqual(0);
	});

	it("second fire on the same channel produces a strictly greater t", () => {
		let first: number | null = null;
		let second: number | null = null;
		fire("pickup", (t) => {
			first = t;
		});
		fire("pickup", (t) => {
			second = t;
		});
		expect(second as unknown as number).toBeGreaterThan(first as unknown as number);
	});

	it("third fire continues strictly increasing", () => {
		const ts: number[] = [];
		fire("pickup", (t) => ts.push(t));
		fire("pickup", (t) => ts.push(t));
		fire("pickup", (t) => ts.push(t));
		expect(ts[1]).toBeGreaterThan(ts[0]);
		expect(ts[2]).toBeGreaterThan(ts[1]);
	});

	it("channels are independent — firing one doesn't bump another", () => {
		let pickupT: number | null = null;
		let bossT: number | null = null;
		fire("pickup", (t) => {
			pickupT = t;
		});
		fire("pickup", (t) => {
			pickupT = t;
		});
		fire("pickup", (t) => {
			pickupT = t;
		});
		fire("death", (t) => {
			bossT = t;
		});
		// pickup advanced 3 times; death fired once after, but its
		// timer should be independent — starts from 0 (Tone.now mock),
		// not from pickup's 0.003.
		expect(bossT as unknown as number).toBe(0);
		expect(pickupT as unknown as number).toBeGreaterThan(bossT as unknown as number);
	});

	it("resetForTest clears all channel timers", () => {
		const tsBefore: number[] = [];
		fire("pickup", (t) => tsBefore.push(t));
		fire("pickup", (t) => tsBefore.push(t));
		expect(tsBefore[1]).toBeGreaterThan(tsBefore[0]);
		resetForTest();
		const tsAfter: number[] = [];
		fire("pickup", (t) => tsAfter.push(t));
		// After reset, the next pickup fire starts back at the Tone.now() baseline.
		expect(tsAfter[0]).toBe(0);
	});

	it("schedule callback is always invoked exactly once per fire", () => {
		let calls = 0;
		fire("pickup", () => {
			calls += 1;
		});
		expect(calls).toBe(1);
		fire("pickup", () => {
			calls += 1;
		});
		expect(calls).toBe(2);
	});
});
