/**
 * CONV2 / CR-H1scene step-d — the `GameRef` adapter over the pure
 * `gameReducer`.
 *
 * Pre-CONV2 the GameRef was a ~190-LOC inline block in BoneBusterShell. CONV2
 * lifted it here; step-d hollows it further: every state transition now lives
 * in the PURE `gameReducer` (src/store/gameReducer.ts). This hook is the thin
 * React adapter — for each GameRef callback it builds a `GameAction`, runs the
 * reducer ONCE against the authoritative current state (`stateRef.current`),
 * threads the result back into the refs (so synchronous same-batch calls — the
 * `collectAllPickups` debug loop — accumulate correctly), commits with a plain
 * `setState(result.state)`, then drains the reducer's returned effects.
 *
 * The old `flushSync` wrappers are GONE: effects are returned DATA drained
 * AFTER `setState` returns (outside any updater), so there is no mid-render
 * dispatch and no "Cannot update a component while rendering a different
 * component" hazard. Running the reducer once (not inside an updater that React
 * may double-invoke) also keeps `ctx.acquired`'s dedup mutation exactly-once.
 *
 * Invariant: every GameRef callback fires from the Scene's rAF / event loop
 * (never during React render), so the value-form `setState` is always legal.
 */

import { playFlashlightClick, playHitSting, playPickup, playPlayerDeath } from "@audio/sfx";
import { dispatch } from "@engine/events";
import { cyrb128 } from "@engine/rng";
import {
	type GameAction,
	type GameEffect,
	type GameReducerResult,
	gameReducer,
} from "@store/gameReducer";
import type { BoneBusterSettings, DifficultyTuning, LevelChoice } from "@store/settings";
import type { FadeKind, GameRef, GameState } from "@views/Shell";
import { pickLootKind } from "@world/loot";
import { useRef } from "react";

export type UseGameRefDeps = Readonly<{
	setState: React.Dispatch<React.SetStateAction<GameState>>;
	/** Authoritative current state — Shell keeps `stateRef.current = state` every render. */
	stateRef: React.RefObject<GameState>;
	triggerFadeRef: React.RefObject<(kind: FadeKind, intensity?: number) => void>;
	settings: BoneBusterSettings;
	tuning: DifficultyTuning;
	seedPhrase: string;
	level: LevelChoice;
}>;

export function useGameRef(deps: UseGameRefDeps): React.RefObject<GameRef> {
	// Last accepted player-hit timestamp (POL i-frames). Threaded through the
	// reducer ctx + result so the window check stays correct across frames.
	const lastPlayerHitAt = useRef(0);
	// Re-point on every render so callbacks always see current deps.
	const depsRef = useRef(deps);
	depsRef.current = deps;
	// D3 — weapons that already emitted `weaponAcquired` this session. A React
	// batch can replay `prev.ownedWeapons`, so a stable ref-tracked set is the
	// correct dedup gate. Reset on mount (new map key → fresh useGameRef).
	const acquiredRef = useRef<Set<string>>(new Set());

	// Map a reducer GameEffect onto the React/audio/dispatch world. Runs AFTER
	// setState, outside any updater → no mid-render dispatch, no flushSync.
	const drain = (effects: readonly GameEffect[]) => {
		const { triggerFadeRef } = depsRef.current;
		for (const e of effects) {
			switch (e.kind) {
				case "dispatch":
					dispatch(e.event);
					break;
				case "fade":
					triggerFadeRef.current(e.fade as FadeKind, e.intensity);
					break;
				case "audio":
					switch (e.sound) {
						case "hitSting":
							playHitSting();
							break;
						case "playerDeath":
							playPlayerDeath();
							break;
						case "pickup":
							playPickup();
							break;
						case "flashlightClick":
							playFlashlightClick();
							break;
					}
					break;
			}
		}
	};

	// The single entry point every GameRef callback funnels through.
	const runAction = (action: GameAction): GameReducerResult => {
		const { stateRef, settings, tuning, seedPhrase } = depsRef.current;
		const result = gameReducer(stateRef.current, action, {
			now: performance.now(),
			tuning,
			settings: { soundEnabled: settings.soundEnabled, level: settings.level },
			// COV12 — loot kind is seed-derived; computed here (not in the pure
			// reducer) and passed via ctx so the reducer stays free of the RNG.
			seedLootKind: pickLootKind(cyrb128(seedPhrase)[2] >>> 0),
			iframeUntil: lastPlayerHitAt.current,
			acquired: acquiredRef.current,
		});
		// Thread results back into the refs BEFORE the next same-batch call
		// reads them — this is what makes the synchronous `collectAllPickups`
		// loop accumulate (two health pickups → +2 HP) without a functional
		// updater. React converges to the same final state.
		stateRef.current = result.state;
		lastPlayerHitAt.current = result.iframeUntil;
		depsRef.current.setState(result.state);
		drain(result.effects);
		return result;
	};

	const gameRef = useRef<GameRef>({
		onHit: (damage) => {
			runAction({ type: "hit", damage });
		},
		onKill: () => {
			runAction({ type: "kill" });
		},
		onPickupKey: () => {
			runAction({ type: "pickupKey" });
		},
		onWin: () => {
			runAction({ type: "win" });
		},
		onReachSpawn: () => {
			runAction({ type: "reachSpawn" });
		},
		onSpendAmmo: (weapon, amount) => {
			runAction({ type: "spendAmmo", weapon, amount });
		},
		// PC4 — the reducer's `consumed` flag tells the Scene whether the
		// placement should proceed (true) or no-op on an empty inventory.
		onConsumeCrucifix: () => runAction({ type: "consumeCrucifix" }).consumed,
		onCollectPickup: (kind) => {
			runAction({ type: "collectPickup", kind });
		},
	});

	return gameRef;
}
