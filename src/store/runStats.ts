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

/**
 * STRUCT1 (D23, endless + prestige) — a prestige milestone every N biomes
 * cleared. `prestigeTier(runLevelsCleared)` = floor(depth / N): tier 0 for the
 * first N biomes, tier 1 after N, and so on. The run never "ends" on a count;
 * death is the only terminator. The tier is a visible marker on the run.
 */
export const PRESTIGE_INTERVAL = 5;

export function prestigeTier(runLevelsCleared: number): number {
	return Math.floor(runLevelsCleared / PRESTIGE_INTERVAL);
}

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
