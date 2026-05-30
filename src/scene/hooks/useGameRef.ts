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
 * Call site: GameRef callbacks fire from the Scene's frame loop — which IS
 * r3f's `useFrame` (its own render/commit phase), NOT outside React entirely.
 * The value-form `setState` is still legal here because it runs in an r3f
 * commit, not Shell's render, and the effects drain as plain function calls
 * after `setState` returns (no updater body fires a sibling component's
 * setState mid-render). The starvation caveat — react-dom may defer the HUD
 * commit behind r3f's frame loop under a software GL backend — is a renderer
 * scheduling issue (see docs / the e2e ANGLE-GL backend), not a correctness
 * bug in this adapter.
 */

import { playFlashlightClick, playHitSting, playPickup, playPlayerDeath } from "@audio/sfx";
import { dispatch } from "@engine/events";
import { cyrb128 } from "@engine/rng";
import { assertNever } from "@shared/assertNever";
import {
	type GameAction,
	type GameEffect,
	type GameReducerResult,
	gameReducer,
} from "@store/gameReducer";
import type { FadeKind, GameRef, GameState } from "@store/gameState";
import type { BoneBusterSettings, DifficultyTuning } from "@store/settings";
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
						default:
							// PREP-BP2 — a new GameEffect audio sound without a case
							// is a compile error here.
							assertNever(e.sound, "GameEffect audio sound");
					}
					break;
				default:
					// PREP-BP2 — a new GameEffect kind without a case is a compile error.
					assertNever(e, "GameEffect");
			}
		}
	};

	// The single entry point every GameRef callback funnels through.
	const runAction = (action: GameAction): GameReducerResult => {
		const { stateRef, settings, tuning, seedPhrase } = depsRef.current;
		const result = gameReducer(stateRef.current, action, {
			now: performance.now(),
			tuning,
			settings: { soundEnabled: settings.soundEnabled },
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
		//
		// no-visual-impact: BP-3 is a comment-only constraint note on the existing stateRef threading; zero behavior or rendering change
		// BP-3 — CONSTRAINT: `stateRef.current` is the authoritative
		// same-batch state; the React `state` the HUD renders LAGS within a
		// synchronous batch (it reflects the LAST `setState` React has
		// committed, not intermediate same-tick mutations). So:
		//   - Game LOGIC that must see same-tick accumulation reads
		//     `stateRef.current` (here + the reducer ctx), never the rendered
		//     `state` prop.
		//   - HUD/render code reads the React `state` and may be one batch
		//     behind mid-burst — that's fine (it converges next commit) and
		//     MUST NOT be "fixed" by reading `stateRef.current` into render:
		//     a ref read during render is not reactive and would desync the
		//     displayed value from React's committed tree.
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
		onUpgradeWeapon: (weapon) => {
			runAction({ type: "upgradeWeapon", weapon });
		},
	});

	return gameRef;
}
