/**
 * CR-H1scene step-d / CR-F8 — the pure GameState reducer.
 *
 * Pre-this, every GameState transition lived inside `useGameRef`'s 8 callbacks
 * as a `setState((prev) => ...)` updater that ALSO fired side-effects
 * (dispatch / audio / fade) — three of them wrapped in `flushSync` purely to
 * order those side-effects after the state commit. That coupling is dissolved
 * here: `gameReducer(state, action, ctx)` is PURE — it returns the next state
 * plus a typed list of `GameEffect`s as DATA. `useGameRef` runs the effects
 * after `setState` returns, so there's no mid-render dispatch to force-order
 * and flushSync is gone (see docs/specs/97-scene-decomposition.md §step-d).
 *
 * Keeping the reducer pure (no React, no dispatch, no audio, no
 * `performance.now()`) makes every transition unit-testable in isolation —
 * time + the iframe / weapon-acquired dedup that depend on mutable refs are
 * passed in via `ctx`.
 */

import type { BoneBusterEvent } from "@engine/events";
import type { PickupKind } from "@engine/mapTypes";
import { WEAPONS, type WeaponId } from "@shared/weapons";
import { GOING_BACK_BUDGET_MS } from "@store/gameConstants";
import { advanceLevel, runStatsReducer } from "@store/runStats";
import type { DifficultyTuning, LevelChoice } from "@store/settings";
import type { GameState } from "@views/Shell";
import { LOOT_BONUSES } from "@world/loot";

/** Fade overlay kinds (mirror of Shell's FadeKind without importing the React side). */
export type FadeEffectKind = "damage" | "key" | "win" | "flash";

/**
 * A side-effect the reducer wants run AFTER the state commit. Returned as data
 * so the reducer stays pure; `useGameRef` interprets each one (dispatch a typed
 * event, play a sound, trigger a fade). `sound` is a stable key the adapter
 * maps to the concrete `@audio/sfx` call.
 */
export type GameEffect =
	| { kind: "dispatch"; event: BoneBusterEvent }
	| { kind: "audio"; sound: "hitSting" | "playerDeath" | "pickup" | "flashlightClick" }
	| { kind: "fade"; fade: FadeEffectKind; intensity?: number };

export type GameAction =
	| { type: "hit"; damage: number }
	| { type: "kill" }
	| { type: "pickupKey" }
	| { type: "win" }
	| { type: "reachSpawn" }
	| { type: "spendAmmo"; weapon: WeaponId; amount: number }
	| { type: "consumeCrucifix" }
	| { type: "collectPickup"; kind: PickupKind };

/**
 * Per-tick context the reducer can't derive from `state` alone — the wall
 * clock, difficulty tuning, the seed (loot kind), and the two mutable dedup
 * sets the adapter owns across React batches:
 *   - `iframeUntil` — the timestamp before which `hit` is ignored (POL i-frames).
 *   - `acquired` — weapons that already fired `weaponAcquired` this session.
 * Both are read AND written here (the reducer mutates `acquired` + returns the
 * new `iframeUntil` via the result) so the adapter's refs stay the single
 * source of truth without the reducer touching React.
 */
export type GameReducerCtx = Readonly<{
	now: number;
	tuning: DifficultyTuning;
	settings: { soundEnabled: boolean; level: LevelChoice };
	seedLootKind: "bottles" | "books" | "treasure";
	iframeUntil: number;
	acquired: Set<string>;
}>;

export type GameReducerResult = Readonly<{
	state: GameState;
	effects: readonly GameEffect[];
	/** Updated player-iframe deadline (only changes on an accepted `hit`). */
	iframeUntil: number;
	/** PC4 — true when a `consumeCrucifix` action actually decremented inventory. */
	consumed: boolean;
}>;

const AMMO_INCREMENT: Record<
	PickupKind,
	| { weapon: WeaponId; amount: number }
	| "health"
	| "flashlight"
	| "loot"
	| "emfReader"
	| "spiritBox"
	| "uvFlashlight"
	| "crucifix"
> = {
	health: "health",
	chaingunAmmo: { weapon: "chaingun", amount: WEAPONS.chaingun.pickupAmmo },
	shotgunAmmo: { weapon: "shotgun", amount: WEAPONS.shotgun.pickupAmmo },
	flamethrowerAmmo: { weapon: "flamethrower", amount: WEAPONS.flamethrower.pickupAmmo },
	flashlight: "flashlight",
	loot: "loot",
	emfReader: "emfReader",
	spiritBox: "spiritBox",
	uvFlashlight: "uvFlashlight",
	crucifix: "crucifix",
};

const noChange = (state: GameState, iframeUntil: number): GameReducerResult => ({
	state,
	effects: [],
	iframeUntil,
	consumed: false,
});

export function gameReducer(
	state: GameState,
	action: GameAction,
	ctx: GameReducerCtx,
): GameReducerResult {
	switch (action.type) {
		case "hit":
			return reduceHit(state, action.damage, ctx);
		case "kill":
			return {
				// Clamp per-level kill counter at totalEnemies. Debug paths can
				// re-trigger on already-dead enemies; HUD reads kills/totalEnemies
				// so an unclamped counter renders nonsense.
				state: {
					...state,
					kills: Math.min(state.kills + 1, state.totalEnemies),
					run: { ...state.run, runTotalKills: state.run.runTotalKills + 1 },
				},
				effects: [],
				iframeUntil: ctx.iframeUntil,
				consumed: false,
			};
		case "pickupKey":
			return {
				state: { ...state, hasKey: true },
				effects: [
					{ kind: "audio", sound: "pickup" },
					{ kind: "fade", fade: "key" },
					// POL22 — typed event consumed by KeyPickupCeremony HUD overlay.
					{ kind: "dispatch", event: { type: "keyPickedUp" } },
				],
				iframeUntil: ctx.iframeUntil,
				consumed: false,
			};
		case "win":
			return reduceWin(state, ctx);
		case "reachSpawn":
			return reduceReachSpawn(state, ctx);
		case "spendAmmo":
			return reduceSpendAmmo(state, action.weapon, action.amount, ctx);
		case "consumeCrucifix":
			if (state.crucifixes <= 0) return noChange(state, ctx.iframeUntil);
			return {
				state: { ...state, crucifixes: state.crucifixes - 1 },
				effects: [],
				iframeUntil: ctx.iframeUntil,
				consumed: true,
			};
		case "collectPickup":
			return reduceCollectPickup(state, action.kind, ctx);
	}
}

function reduceHit(state: GameState, damage: number, ctx: GameReducerCtx): GameReducerResult {
	// POL i-frames — `ctx.iframeUntil` carries the LAST ACCEPTED hit time
	// (the adapter's `lastPlayerHitAt` ref). Ignore hits inside the window.
	if (ctx.now - ctx.iframeUntil < ctx.tuning.playerIframeMs) {
		return noChange(state, ctx.iframeUntil);
	}
	const effects: GameEffect[] = [
		// I6 — camera shake scales with raw incoming damage.
		{ kind: "dispatch", event: { type: "shake", amount: damage } },
		// I2 — player-position burst on every successful enemy hit.
		{ kind: "dispatch", event: { type: "playerHit" } },
		// J3 — red fade overlay scaled by damage.
		{ kind: "fade", fade: "damage", intensity: Math.min(1, damage / 3) },
	];
	// K2 — sharp hit sting (distinct from ambient playHurt).
	if (ctx.settings.soundEnabled) effects.push({ kind: "audio", sound: "hitSting" });

	if (state.status !== "playing") {
		return { state, effects, iframeUntil: ctx.now, consumed: false };
	}
	const finalDamage = Math.round(damage * ctx.tuning.enemyDamageMultiplier);
	const hp = Math.max(0, state.hp - finalDamage);
	// POL9 — player-death sting on HP→0 transition (single fire via hp>0 gate).
	if (state.hp > 0 && hp === 0 && ctx.settings.soundEnabled) {
		effects.push({ kind: "audio", sound: "playerDeath" });
	}
	return {
		state: {
			...state,
			hp,
			status: hp <= 0 ? "dead" : state.status,
			damageFlashAt: ctx.now,
			run: { ...state.run, runTotalDamageTaken: state.run.runTotalDamageTaken + finalDamage },
		},
		effects,
		iframeUntil: ctx.now,
		consumed: false,
	};
}

function reduceWin(state: GameState, ctx: GameReducerCtx): GameReducerResult {
	if (state.status !== "playing" || state.phase === "going_back") {
		return noChange(state, ctx.iframeUntil);
	}
	const effects: GameEffect[] = [];
	// D3 — RealDoor drop grants chaingun + shotgun + flamethrower. Fire
	// weaponAcquired for any the player didn't already own, with the
	// `acquired` dedup gate (prev.ownedWeapons can lag across a React batch).
	for (const w of ["chaingun", "shotgun", "flamethrower"] as const) {
		if (!state.ownedWeapons[w] && !ctx.acquired.has(w)) {
			ctx.acquired.add(w);
			effects.push({ kind: "dispatch", event: { type: "weaponAcquired", weapon: w } });
		}
	}
	return {
		state: {
			...state,
			phase: "going_back",
			// POL37 — going-back deadline. Countdown overlay reads this.
			goingBackDeadlineMs: ctx.now + GOING_BACK_BUDGET_MS,
			ownedWeapons: { ...state.ownedWeapons, chaingun: true, shotgun: true, flamethrower: true },
			ammo: {
				...state.ammo,
				shotgun: Math.max(state.ammo.shotgun, WEAPONS.shotgun.pickupAmmo + 4),
				flamethrower: Math.max(state.ammo.flamethrower, WEAPONS.flamethrower.pickupAmmo + 10),
			},
		},
		effects,
		iframeUntil: ctx.iframeUntil,
		consumed: false,
	};
}

function reduceReachSpawn(state: GameState, ctx: GameReducerCtx): GameReducerResult {
	const fade: GameEffect = { kind: "fade", fade: "win" };
	if (state.status !== "playing" || state.phase !== "going_back") {
		// The fade still fires in the original (triggerFade is called before the
		// status guard), so preserve that ordering.
		return { state, effects: [fade], iframeUntil: ctx.iframeUntil, consumed: false };
	}
	const advanced = advanceLevel(ctx.settings.level, state.run.runLevelsCleared);
	const clearedRun = runStatsReducer(state.run, {
		type: "clearLevel",
		killsThisLevel: 0,
		damageThisLevel: 0,
		scoreThisLevel: state.score,
	});
	return {
		state: {
			...state,
			run: clearedRun,
			status: advanced === null ? "won" : "transitioning",
			// POL37 — clear the deadline; countdown hides.
			goingBackDeadlineMs: null,
		},
		effects: [fade],
		iframeUntil: ctx.iframeUntil,
		consumed: false,
	};
}

function reduceSpendAmmo(
	state: GameState,
	weapon: WeaponId,
	amount: number,
	ctx: GameReducerCtx,
): GameReducerResult {
	if (amount <= 0) return noChange(state, ctx.iframeUntil);
	return {
		state: {
			...state,
			ammo: { ...state.ammo, [weapon]: Math.max(0, state.ammo[weapon] - amount) },
		},
		effects: [],
		iframeUntil: ctx.iframeUntil,
		consumed: false,
	};
}

/**
 * CR-F8 — table-driven pickup collection. Each PickupKind maps (via
 * AMMO_INCREMENT) to one of the arms below; the arm returns the next state +
 * its effects. The POL30 `pickupCollected` dispatch is common to every kind.
 */
function reduceCollectPickup(
	state: GameState,
	kind: PickupKind,
	ctx: GameReducerCtx,
): GameReducerResult {
	const effects: GameEffect[] = [
		// POL30 — pickup-collected event for the PickupChip HUD overlay.
		{ kind: "dispatch", event: { type: "pickupCollected", kind } },
	];
	const action = AMMO_INCREMENT[kind];

	if (action === "health") {
		// L1 — +1 HP per pickup on the 0-9 scale.
		return ok({ ...state, hp: Math.min(state.maxHp, state.hp + 1) });
	}
	if (action === "flashlight") {
		// POL28 — flashlight click-on sting + J-flash fade + acquired event.
		effects.push({ kind: "fade", fade: "flash" });
		effects.push({ kind: "audio", sound: "flashlightClick" });
		effects.push({ kind: "dispatch", event: { type: "flashlightAcquired" } });
		return ok({ ...state, hasFlashlight: true });
	}
	if (action === "emfReader") return ok({ ...state, hasEmfReader: true });
	if (action === "spiritBox") return ok({ ...state, hasSpiritBox: true });
	if (action === "uvFlashlight") return ok({ ...state, hasUvFlashlight: true });
	if (action === "crucifix") return ok({ ...state, crucifixes: state.crucifixes + 1 });
	if (action === "loot") {
		// COV12 step-2 — kind-specific bonus from the seed-derived loot kind.
		if (ctx.seedLootKind === "bottles") {
			return ok({ ...state, hp: Math.min(state.maxHp, state.hp + LOOT_BONUSES.bottlesHp) });
		}
		if (ctx.seedLootKind === "books") {
			return ok({
				...state,
				ammo: {
					...state.ammo,
					chaingun: state.ammo.chaingun + WEAPONS.chaingun.pickupAmmo,
					shotgun: state.ammo.shotgun + WEAPONS.shotgun.pickupAmmo,
				},
			});
		}
		return ok({ ...state, score: state.score + LOOT_BONUSES.treasureScore });
	}
	// Weapon-ammo arm. D3 — first-time acquisition fires weaponAcquired with
	// the `acquired` dedup gate (ownedWeapons lags across a React batch).
	if (!ctx.acquired.has(action.weapon)) {
		ctx.acquired.add(action.weapon);
		effects.push({ kind: "dispatch", event: { type: "weaponAcquired", weapon: action.weapon } });
	}
	return ok({
		...state,
		ammo: { ...state.ammo, [action.weapon]: state.ammo[action.weapon] + action.amount },
		ownedWeapons: { ...state.ownedWeapons, [action.weapon]: true },
		weapon: state.weapon === "pistol" ? action.weapon : state.weapon,
	});

	function ok(next: GameState): GameReducerResult {
		return { state: next, effects, iframeUntil: ctx.iframeUntil, consumed: false };
	}
}
