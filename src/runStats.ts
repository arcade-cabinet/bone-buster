import type { LevelChoice } from "./settings";

export type RunStats = Readonly<{
	runStartAt: number;
	runLevelsCleared: number;
	runTotalKills: number;
	runTotalDamageTaken: number;
}>;

export type RunAction =
	| { type: "start"; now: number }
	| { type: "clearLevel"; killsThisLevel: number; damageThisLevel: number }
	| { type: "reset"; now: number };

export const RUN_LENGTH = 5;

export function makeInitialRunStats(now: number): RunStats {
	return {
		runStartAt: now,
		runLevelsCleared: 0,
		runTotalKills: 0,
		runTotalDamageTaken: 0,
	};
}

export function runStatsReducer(state: RunStats, action: RunAction): RunStats {
	switch (action.type) {
		case "start":
			return makeInitialRunStats(action.now);
		case "reset":
			return makeInitialRunStats(action.now);
		case "clearLevel":
			return {
				...state,
				runLevelsCleared: state.runLevelsCleared + 1,
				runTotalKills: state.runTotalKills + action.killsThisLevel,
				runTotalDamageTaken: state.runTotalDamageTaken + action.damageThisLevel,
			};
	}
}

/**
 * Given the current level, return the next level in the run, or `null`
 * when the run is complete. For procedural mode the level field stays
 * "procedural" — the runner is expected to re-roll the seed externally.
 */
export function advanceLevel(
	current: LevelChoice,
	clearedCount: number,
): LevelChoice | null {
	if (clearedCount + 1 >= RUN_LENGTH) return null;
	if (current === "procedural") return "procedural";
	const next = current + 1;
	if (next > 5) return null;
	return next as LevelChoice;
}
