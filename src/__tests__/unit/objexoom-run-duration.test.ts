/**
 * POL32 — pins the run-duration formatter used by the landing-page
 * BestRunChip. The exact formatting is part of the HUD visual contract
 * (DESIGN.md §typography) so future changes to the m:ss / h:mm:ss
 * split surface here before a player sees a regression.
 */

import { formatRunDuration } from "@store/runHistory";
import { describe, expect, it } from "vitest";

describe("POL32 — formatRunDuration", () => {
	it("formats sub-minute runs as 0:SS", () => {
		expect(formatRunDuration(0)).toBe("0:00");
		expect(formatRunDuration(999)).toBe("0:00");
		expect(formatRunDuration(1000)).toBe("0:01");
		expect(formatRunDuration(45_000)).toBe("0:45");
	});

	it("formats minute-range runs as M:SS", () => {
		expect(formatRunDuration(60_000)).toBe("1:00");
		expect(formatRunDuration(60_000 + 30_000)).toBe("1:30");
		expect(formatRunDuration(3 * 60_000 + 42_000)).toBe("3:42");
		expect(formatRunDuration(59 * 60_000 + 59_000)).toBe("59:59");
	});

	it("formats hour-range runs as H:MM:SS", () => {
		expect(formatRunDuration(60 * 60_000)).toBe("1:00:00");
		expect(formatRunDuration(60 * 60_000 + 30 * 60_000 + 7_000)).toBe("1:30:07");
		expect(formatRunDuration(2 * 60 * 60_000 + 5 * 60_000 + 9_000)).toBe("2:05:09");
	});

	it("clamps negative and non-finite inputs to 0:00", () => {
		expect(formatRunDuration(-1)).toBe("0:00");
		expect(formatRunDuration(-999_999)).toBe("0:00");
		expect(formatRunDuration(Number.NaN)).toBe("0:00");
		expect(formatRunDuration(Number.POSITIVE_INFINITY)).toBe("0:00");
		expect(formatRunDuration(Number.NEGATIVE_INFINITY)).toBe("0:00");
	});

	it("zero-pads seconds correctly", () => {
		expect(formatRunDuration(60_000 + 5_000)).toBe("1:05");
		expect(formatRunDuration(60 * 60_000 + 1_000)).toBe("1:00:01");
	});

	it("zero-pads minutes in h:mm:ss but not in m:ss", () => {
		expect(formatRunDuration(60 * 60_000 + 5 * 60_000)).toBe("1:05:00");
		expect(formatRunDuration(5 * 60_000)).toBe("5:00");
	});
});
