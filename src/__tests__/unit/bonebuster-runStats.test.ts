import {
	makeInitialRunStats,
	PRESTIGE_INTERVAL,
	prestigeTier,
	runStatsReducer,
} from "@store/runStats";
import { describe, expect, it } from "vitest";

describe("bonebuster runStatsReducer (B2)", () => {
	it("makeInitialRunStats starts at zero", () => {
		const stats = makeInitialRunStats(1000);
		expect(stats.runStartAt).toBe(1000);
		expect(stats.runLevelsCleared).toBe(0);
		expect(stats.runTotalKills).toBe(0);
		expect(stats.runTotalDamageTaken).toBe(0);
		expect(stats.runTotalScore).toBe(0);
		expect(stats.runTotalSecrets).toBe(0);
	});

	it("start action initializes a fresh stats record", () => {
		const prev = {
			runStartAt: 1,
			runLevelsCleared: 3,
			runTotalKills: 42,
			runTotalDamageTaken: 99,
			runTotalScore: 200,
			runTotalSecrets: 2,
		} as const;
		const next = runStatsReducer(prev, { type: "start", now: 5000 });
		expect(next.runStartAt).toBe(5000);
		expect(next.runLevelsCleared).toBe(0);
		expect(next.runTotalKills).toBe(0);
		expect(next.runTotalDamageTaken).toBe(0);
		expect(next.runTotalScore).toBe(0);
		expect(next.runTotalSecrets).toBe(0);
	});

	it("secretFound action increments runTotalSecrets without affecting other fields", () => {
		const stats = makeInitialRunStats(0);
		const after = runStatsReducer(stats, { type: "secretFound" });
		expect(after.runTotalSecrets).toBe(1);
		expect(after.runLevelsCleared).toBe(0);
		expect(after.runTotalKills).toBe(0);
		const after2 = runStatsReducer(after, { type: "secretFound" });
		expect(after2.runTotalSecrets).toBe(2);
	});

	it("secrets survive clearLevel — only run start/reset clears them", () => {
		const stats = runStatsReducer(makeInitialRunStats(0), { type: "secretFound" });
		const afterLevel = runStatsReducer(stats, {
			type: "clearLevel",
			killsThisLevel: 3,
			damageThisLevel: 5,
			scoreThisLevel: 0,
		});
		expect(afterLevel.runTotalSecrets).toBe(1);
		const reset = runStatsReducer(afterLevel, { type: "reset", now: 100 });
		expect(reset.runTotalSecrets).toBe(0);
	});

	it("reset action also clears everything", () => {
		const stats = makeInitialRunStats(0);
		const used = runStatsReducer(stats, {
			type: "clearLevel",
			killsThisLevel: 5,
			damageThisLevel: 30,
			scoreThisLevel: 100,
		});
		const reset = runStatsReducer(used, { type: "reset", now: 9000 });
		expect(reset.runLevelsCleared).toBe(0);
		expect(reset.runTotalKills).toBe(0);
		expect(reset.runTotalScore).toBe(0);
		expect(reset.runStartAt).toBe(9000);
	});

	it("clearLevel accumulates kills + damage + score and bumps level counter", () => {
		const stats = makeInitialRunStats(0);
		const after1 = runStatsReducer(stats, {
			type: "clearLevel",
			killsThisLevel: 3,
			damageThisLevel: 12,
			scoreThisLevel: 50,
		});
		expect(after1.runLevelsCleared).toBe(1);
		expect(after1.runTotalKills).toBe(3);
		expect(after1.runTotalDamageTaken).toBe(12);
		expect(after1.runTotalScore).toBe(50);

		const after2 = runStatsReducer(after1, {
			type: "clearLevel",
			killsThisLevel: 7,
			damageThisLevel: 4,
			scoreThisLevel: 100,
		});
		expect(after2.runLevelsCleared).toBe(2);
		expect(after2.runTotalKills).toBe(10);
		expect(after2.runTotalDamageTaken).toBe(16);
		expect(after2.runTotalScore).toBe(150);
	});

	it("clearLevel with scoreThisLevel=0 leaves runTotalScore unchanged", () => {
		const stats = runStatsReducer(makeInitialRunStats(0), {
			type: "clearLevel",
			killsThisLevel: 5,
			damageThisLevel: 0,
			scoreThisLevel: 0,
		});
		expect(stats.runTotalScore).toBe(0);
	});
});

describe("bonebuster prestigeTier (STRUCT1 — endless + prestige)", () => {
	it("PRESTIGE_INTERVAL is 5", () => {
		expect(PRESTIGE_INTERVAL).toBe(5);
	});

	it("is tier 0 for the first interval of biomes", () => {
		expect(prestigeTier(0)).toBe(0);
		expect(prestigeTier(1)).toBe(0);
		expect(prestigeTier(4)).toBe(0);
	});

	it("bumps a tier every PRESTIGE_INTERVAL biomes cleared", () => {
		expect(prestigeTier(5)).toBe(1);
		expect(prestigeTier(9)).toBe(1);
		expect(prestigeTier(10)).toBe(2);
		expect(prestigeTier(27)).toBe(5);
	});

	it("is monotonic non-decreasing in depth", () => {
		let prev = 0;
		for (let depth = 0; depth < 60; depth += 1) {
			const tier = prestigeTier(depth);
			expect(tier).toBeGreaterThanOrEqual(prev);
			prev = tier;
		}
	});
});
