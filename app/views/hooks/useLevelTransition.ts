/**
 * CR-H1scene step-d / STRUCT1 — level-transition lifecycle extracted from
 * BoneBusterShell.
 *
 * When the gameReducer flips a cleared level to `status: "transitioning"`, this
 * hook holds for `TRANSITION_HOLD_MS` to let the win fade play, then advances
 * the DESCENT: it bumps the depth, pressure-picks the next biome, and resets the
 * per-level slice of GameState (HP/ammo/key/tools) while preserving run stats —
 * flipping back to `"playing"`. STRUCT1 made the run ENDLESS: a clear is ALWAYS
 * followed by another level; death is the only terminus, so there's no "won"
 * branch here anymore.
 *
 * The geometry forks off (phrase, depth) and the biome param drives the skin, so
 * the map remounts via its `key` (which includes depth + biome) when this hook
 * advances them. This hook only drives status + depth + biome + the per-level
 * reset; it owns no rendering.
 *
 * No flushSync: the reducer already settled `status: "transitioning"` before
 * this effect reads it (step-d dissolved the buffering), so the hold-then-reset
 * is a plain timeout.
 */

import { TRANSITION_HOLD_MS } from "@store/gameConstants";
import type { GameState } from "@store/gameState";
import { useEffect } from "react";

export type UseLevelTransitionArgs = Readonly<{
	status: GameState["status"];
	setState: React.Dispatch<React.SetStateAction<GameState>>;
	/** STRUCT1 — bump the descent depth by one (geometry forks per depth). */
	advanceDepth: () => void;
	/** STRUCT5 — pressure-pick + set the next biome (persists the pressure map). */
	advanceBiome: () => void;
	/** Fresh per-level state slice (HP/ammo/key/tools reset) merged over `prev`. */
	freshLevelSlice: () => Partial<GameState>;
}>;

export function useLevelTransition({
	status,
	setState,
	advanceDepth,
	advanceBiome,
	freshLevelSlice,
}: UseLevelTransitionArgs): void {
	useEffect(() => {
		if (status !== "transitioning") return;
		const timer = window.setTimeout(() => {
			// STRUCT1 — descend: next depth (new geometry) + next biome (pressure
			// pick). Endless — always back to "playing"; death is the only end.
			advanceDepth();
			advanceBiome();
			setState((prev) => ({ ...prev, status: "playing", ...freshLevelSlice() }));
		}, TRANSITION_HOLD_MS);
		return () => window.clearTimeout(timer);
	}, [status, setState, advanceDepth, advanceBiome, freshLevelSlice]);
}
