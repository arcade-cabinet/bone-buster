import { describe, expect, it } from "vitest";
import {
	advanceLevel,
	makeInitialRunStats,
	nextStatusAfterTransition,
	RUN_LENGTH,
	runStatsReducer,
} from "@/runStats";

describe("objexoom runStatsReducer (B2)", () => {
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

describe("objexoom advanceLevel (B1/B4)", () => {
	it("ref levels advance 1→2→3→4 (cleared 0..3)", () => {
		expect(advanceLevel(1, 0)).toBe(2);
		expect(advanceLevel(2, 1)).toBe(3);
		expect(advanceLevel(3, 2)).toBe(4);
		expect(advanceLevel(4, 3)).toBe(5);
	});

	it("returns null when the run is complete (5 cleared)", () => {
		expect(advanceLevel(5, 4)).toBeNull();
	});

	it("procedural mode keeps `procedural` until the run is complete", () => {
		expect(advanceLevel("procedural", 0)).toBe("procedural");
		expect(advanceLevel("procedural", 1)).toBe("procedural");
		expect(advanceLevel("procedural", 3)).toBe("procedural");
		expect(advanceLevel("procedural", 4)).toBeNull();
	});

	it("RUN_LENGTH is 5", () => {
		expect(RUN_LENGTH).toBe(5);
	});
});

describe("objexoom nextStatusAfterTransition (PT1E)", () => {
	it("returns 'playing' when there's a next level in the campaign", () => {
		expect(nextStatusAfterTransition(1, 0)).toBe("playing");
		expect(nextStatusAfterTransition(2, 1)).toBe("playing");
		expect(nextStatusAfterTransition(3, 2)).toBe("playing");
		expect(nextStatusAfterTransition(4, 3)).toBe("playing");
	});

	it("returns 'won' when the final refLevel is cleared", () => {
		// settings.level=5 (E1M5) with cleared=4 → advanceLevel
		// returns null → status must be 'won' (not bounced back to
		// 'playing' which would leave the player frozen on the same
		// map with phase=going_back + lastReachedSpawnAt=true).
		expect(nextStatusAfterTransition(5, 4)).toBe("won");
	});

	it("returns 'won' for procedural mode after RUN_LENGTH clears", () => {
		expect(nextStatusAfterTransition("procedural", 4)).toBe("won");
	});

	it("returns 'playing' for procedural mode mid-run", () => {
		expect(nextStatusAfterTransition("procedural", 0)).toBe("playing");
		expect(nextStatusAfterTransition("procedural", 3)).toBe("playing");
	});
});
