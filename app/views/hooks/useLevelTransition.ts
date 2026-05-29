/**
 * CR-H1scene step-d — level-transition lifecycle extracted from BoneBusterShell.
 *
 * When the gameReducer flips a cleared level to `status: "transitioning"`
 * (B1/B4 chained run), this hook holds for `TRANSITION_HOLD_MS` to let the win
 * fade play, then advances the level (or re-rolls the seed for procedural mode)
 * and resets the per-level slice of GameState (HP/ammo/key/tools) while
 * preserving run stats — flipping back to `"playing"` (or `"won"` on the final
 * level). The map remounts via its `key` when `settings.level` / `seedPhrase`
 * changes, so this hook only drives the status + reset; it owns no rendering.
 *
 * No flushSync: the reducer already settled `status: "transitioning"` before
 * this effect reads it (step-d dissolved the buffering), so the hold-then-reset
 * is a plain timeout.
 */

import { advanceLevel, nextStatusAfterTransition } from "@store/runStats";
import type { BoneBusterSettings } from "@store/settings";
import { TRANSITION_HOLD_MS } from "@views/gameConstants";
import type { GameState } from "@views/Shell";
import { useEffect } from "react";

export type UseLevelTransitionArgs = Readonly<{
	status: GameState["status"];
	runLevelsCleared: number;
	level: BoneBusterSettings["level"];
	setState: React.Dispatch<React.SetStateAction<GameState>>;
	setSettings: React.Dispatch<React.SetStateAction<BoneBusterSettings>>;
	/** Re-roll the seed phrase (procedural mode advances to a new map). */
	rollSeedPhrase: () => void;
	/** Fresh per-level state slice (HP/ammo/key/tools reset) merged over `prev`. */
	freshLevelSlice: () => Partial<GameState>;
}>;

export function useLevelTransition({
	status,
	runLevelsCleared,
	level,
	setState,
	setSettings,
	rollSeedPhrase,
	freshLevelSlice,
}: UseLevelTransitionArgs): void {
	useEffect(() => {
		if (status !== "transitioning") return;
		const timer = window.setTimeout(() => {
			if (level === "procedural") {
				rollSeedPhrase();
			} else {
				const next = advanceLevel(level, runLevelsCleared);
				if (next !== null && next !== "procedural") {
					setSettings((prev) => ({ ...prev, level: next }));
				}
			}
			// PT1E — pure function decides "playing" vs "won". Bug before:
			// unconditionally set "playing", leaving the player stuck at spawn
			// with phase=going_back + lastReachedSpawnAt=true on the final map
			// (no remount since level didn't advance, key didn't change).
			const nextStatus = nextStatusAfterTransition(level, runLevelsCleared);
			setState((prev) => ({ ...prev, status: nextStatus, ...freshLevelSlice() }));
		}, TRANSITION_HOLD_MS);
		return () => window.clearTimeout(timer);
	}, [status, runLevelsCleared, level, setState, setSettings, rollSeedPhrase, freshLevelSlice]);
}
