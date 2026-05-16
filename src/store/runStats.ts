import type { LevelChoice } from "@store/settings";

export type RunStats = Readonly<{
	runStartAt: number;
	runLevelsCleared: number;
	runTotalKills: number;
	runTotalDamageTaken: number;
	/**
	 * POL2 — total score accumulated across all cleared levels in this
	 * run. Each level contributes the player's score at the moment the
	 * level cleared (COV12 treasure-loot pickups grant +50; bottles +HP,
	 * books +ammo don't contribute). Surfaced on the win screen
	 * summary line.
	 */
	runTotalScore: number;
	/**
	 * POL4 — total secrets triggered across all levels in this run.
	 * Increments live on the `secretTriggered` event, survives
	 * `clearLevel`, resets on `start` / `reset`. Surfaced on the
	 * win-screen summary line and on the in-game HUD.
	 */
	runTotalSecrets: number;
}>;

export type RunAction =
	| { type: "start"; now: number }
	| {
			type: "clearLevel";
			killsThisLevel: number;
			damageThisLevel: number;
			scoreThisLevel: number;
	  }
	| { type: "secretFound" }
	| { type: "reset"; now: number };

export const RUN_LENGTH = 5;

export function makeInitialRunStats(now: number): RunStats {
	return {
		runStartAt: now,
		runLevelsCleared: 0,
		runTotalKills: 0,
		runTotalDamageTaken: 0,
		runTotalScore: 0,
		runTotalSecrets: 0,
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
				runTotalScore: state.runTotalScore + action.scoreThisLevel,
			};
		case "secretFound":
			return { ...state, runTotalSecrets: state.runTotalSecrets + 1 };
	}
}

/**
 * Given the current level, return the next level in the run, or `null`
 * when the run is complete. For procedural mode the level field stays
 * "procedural" — the runner is expected to re-roll the seed externally.
 */
export function advanceLevel(current: LevelChoice, clearedCount: number): LevelChoice | null {
	if (clearedCount + 1 >= RUN_LENGTH) return null;
	if (current === "procedural") return "procedural";
	const next = current + 1;
	if (next > 5) return null;
	return next as LevelChoice;
}

/**
 * PT1E — the level-transition handler in BoneBusterShell uses this to
 * decide whether `status` should flip to `"playing"` (start the next
 * level) or `"won"` (campaign complete). Extracted as a pure function
 * because the bug shipped before was a missing branch: when
 * `advanceLevel` returns `null` (no more levels), the handler used to
 * unconditionally set `"playing"`, leaving the player stuck on the
 * same map with `phase="going_back"` + `lastReachedSpawnAt=true`.
 * This codifies the contract so a regression is structurally
 * impossible.
 */
export function nextStatusAfterTransition(
	current: LevelChoice,
	clearedCount: number,
): "playing" | "won" {
	const next = advanceLevel(current, clearedCount);
	return next === null ? "won" : "playing";
}
