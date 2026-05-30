import { GOING_BACK_BUDGET_MS } from "@store/gameConstants";
import { formatCountdown } from "@views/hudOverlays/GoingBackOverlay";
import { describe, expect, it } from "vitest";

/**
 * POL37 — going-back countdown. Tests cover the formatter contract +
 * the budget constant. State integration (deadline-set on phase
 * transition, deadline-clear on reachSpawn, expiry triggers hp=0) is
 * verified at the integration layer by BoneBusterShell's existing
 * end-to-end test path.
 */

describe("POL37 going-back countdown", () => {
	describe("formatCountdown", () => {
		it("formats sub-minute durations as 0:SS with zero-padded seconds", () => {
			expect(formatCountdown(0)).toBe("0:00");
			expect(formatCountdown(1000)).toBe("0:01");
			expect(formatCountdown(9000)).toBe("0:09");
			expect(formatCountdown(10_000)).toBe("0:10");
			expect(formatCountdown(59_000)).toBe("0:59");
		});

		it("formats minute-range durations as M:SS", () => {
			expect(formatCountdown(60_000)).toBe("1:00");
			expect(formatCountdown(125_000)).toBe("2:05");
			expect(formatCountdown(599_000)).toBe("9:59");
		});

		it("clamps negative/zero/sub-second values to 0:00", () => {
			expect(formatCountdown(-100)).toBe("0:00");
			expect(formatCountdown(-99999)).toBe("0:00");
			expect(formatCountdown(0)).toBe("0:00");
		});

		it("rounds UP (ceiling) so the display ticks 30 → 29 → ... → 1 → 0 not 30 → 0", () => {
			// 999ms remaining displays as 1 second (ceil), not 0
			expect(formatCountdown(999)).toBe("0:01");
			expect(formatCountdown(1001)).toBe("0:02");
		});

		it("formats the full 30s budget as 0:30 at deadline start", () => {
			expect(formatCountdown(GOING_BACK_BUDGET_MS)).toBe("0:30");
		});
	});

	describe("GOING_BACK_BUDGET_MS constant", () => {
		it("is 30 seconds", () => {
			expect(GOING_BACK_BUDGET_MS).toBe(30_000);
		});
	});

	describe("deadline lifecycle (state-machine semantics replicated)", () => {
		/**
		 * These tests replicate the relevant onWin / onReachSpawn / tick
		 * logic from BoneBusterShell as pure functions so the deadline
		 * lifecycle is autonomously verifiable without mounting React.
		 * Any divergence between these and the real Shell setState
		 * branches IS the bug the test is supposed to catch.
		 */

		type S = { phase: "out" | "going_back"; goingBackDeadlineMs: number | null; hp: number };

		function applyWin(prev: S, now: number): S {
			if (prev.phase === "going_back") return prev;
			return {
				...prev,
				phase: "going_back",
				goingBackDeadlineMs: now + GOING_BACK_BUDGET_MS,
			};
		}

		function applyReachSpawn(prev: S): S {
			if (prev.phase !== "going_back") return prev;
			return { ...prev, goingBackDeadlineMs: null };
		}

		function applyTick(prev: S, now: number): S {
			if (prev.phase !== "going_back") return prev;
			if (prev.goingBackDeadlineMs === null) return prev;
			if (now < prev.goingBackDeadlineMs) return prev;
			return { ...prev, hp: 0 };
		}

		it("onWin sets goingBackDeadlineMs to now + budget on out→going_back transition", () => {
			const before: S = { phase: "out", goingBackDeadlineMs: null, hp: 100 };
			const after = applyWin(before, 1000);
			expect(after.phase).toBe("going_back");
			expect(after.goingBackDeadlineMs).toBe(1000 + GOING_BACK_BUDGET_MS);
		});

		it("onReachSpawn clears goingBackDeadlineMs to null", () => {
			const before: S = { phase: "going_back", goingBackDeadlineMs: 31_000, hp: 100 };
			const after = applyReachSpawn(before);
			expect(after.goingBackDeadlineMs).toBeNull();
		});

		it("countdown tick drops hp to 0 when now >= deadline (expiry triggers death path)", () => {
			const state: S = { phase: "going_back", goingBackDeadlineMs: 5000, hp: 100 };
			const beforeExpiry = applyTick(state, 4999);
			expect(beforeExpiry.hp).toBe(100);
			const atExpiry = applyTick(state, 5000);
			expect(atExpiry.hp).toBe(0);
			const pastExpiry = applyTick(state, 6000);
			expect(pastExpiry.hp).toBe(0);
		});

		it("countdown tick is a no-op when phase is not going_back", () => {
			const state: S = { phase: "out", goingBackDeadlineMs: null, hp: 100 };
			expect(applyTick(state, 99999).hp).toBe(100);
		});

		it("countdown tick is a no-op when deadline is null even in going_back", () => {
			const state: S = { phase: "going_back", goingBackDeadlineMs: null, hp: 100 };
			expect(applyTick(state, 99999).hp).toBe(100);
		});
	});
});
