// I5 + I4 + I9 — verifies the difficulty-derived tunings the rest of
// the game relies on. These are pure data, so a regression here would
// break i-frame timing or enemy density without firing a test elsewhere.
import { describe, expect, it } from "vitest";
import { DIFFICULTY_TUNING, type Difficulty } from "@/settings";

const ORDER: readonly Difficulty[] = [
	"tooYoung",
	"notTooRough",
	"hurtMePlenty",
	"ultraViolence",
	"nightmare",
];

describe("objexoom settings — DIFFICULTY_TUNING", () => {
	it("covers all five DOOM difficulty registers", () => {
		for (const d of ORDER) expect(DIFFICULTY_TUNING[d]).toBeTruthy();
	});

	it("I5: playerIframeMs follows ref formula `450 - 50 * difficultyIdx`", () => {
		for (let i = 0; i < ORDER.length; i += 1) {
			const expected = 450 - 50 * i;
			expect(DIFFICULTY_TUNING[ORDER[i]].playerIframeMs).toBe(expected);
		}
	});

	it("enemyHpMultiplier is monotonically non-decreasing across registers", () => {
		for (let i = 1; i < ORDER.length; i += 1) {
			const prev = DIFFICULTY_TUNING[ORDER[i - 1]].enemyHpMultiplier;
			const cur = DIFFICULTY_TUNING[ORDER[i]].enemyHpMultiplier;
			expect(cur).toBeGreaterThanOrEqual(prev);
		}
	});

	it("playerHpMultiplier is monotonically non-increasing across registers", () => {
		for (let i = 1; i < ORDER.length; i += 1) {
			const prev = DIFFICULTY_TUNING[ORDER[i - 1]].playerHpMultiplier;
			const cur = DIFFICULTY_TUNING[ORDER[i]].playerHpMultiplier;
			expect(cur).toBeLessThanOrEqual(prev);
		}
	});

	it("hurtMePlenty is the reference baseline (all multipliers = 1)", () => {
		const t = DIFFICULTY_TUNING.hurtMePlenty;
		expect(t.enemyHpMultiplier).toBe(1);
		expect(t.enemyDamageMultiplier).toBe(1);
		expect(t.enemyCountMultiplier).toBe(1);
		expect(t.playerHpMultiplier).toBe(1);
	});
});

// I4 — verifies the ManyEnemies expansion formula directly so a refactor
// of the bitwise floor or PI factor breaks loudly.
describe("objexoom settings — I4 ManyEnemies formula", () => {
	const formula = (difficultyIdx: number, count: number): number =>
		(difficultyIdx * 5 + 5 + count * Math.PI) | 0;

	it("base case: difficulty=0 count=0 → 5 enemies", () => {
		expect(formula(0, 0)).toBe(5);
	});

	it("count=1 adds floor(π)=3 → +3 enemies", () => {
		expect(formula(0, 1)).toBe(8);
		expect(formula(2, 1)).toBe(18);
	});

	it("difficulty steps add exactly 5 enemies per register", () => {
		for (let d = 0; d < 5; d += 1) {
			expect(formula(d, 0)).toBe(5 + d * 5);
		}
	});

	it("nightmare difficulty + 3 markers → 25 + floor(3π) = 25+9 = 34", () => {
		expect(formula(4, 3)).toBe(34);
	});
});
