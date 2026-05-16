/**
 * CONV2 — `GameRef` callback construction extracted from ObjexoomShell.
 *
 * Pre-CONV2 the 7-callback GameRef was inlined inside ObjexoomShell.tsx
 * as a ~190-LOC `useRef<GameRef>({...})` block. Every callback closed
 * over Shell-local refs (lastPlayerHitAt, triggerFadeRef) plus
 * Shell-local state (settings, tuning, seed) plus reducer/dispatch.
 *
 * The hook here takes those as input and returns a stable
 * `useRef<GameRef>` whose callback bodies read the LATEST values via
 * an internal deps-ref that the hook re-points on every render. That
 * gives us:
 *
 *  - One mount per Shell lifetime (consumer can pass the ref to Scene
 *    once and never re-bind).
 *  - Callback bodies that always see the CURRENT settings/tuning/seed
 *    even though the GameRef itself never changes identity.
 *  - All sfx + reducer + WEAPONS table coupling stays in the hook,
 *    not the Shell — Shell only declares the deps shape.
 *
 * Important: this hook does NOT itself own any React state. State
 * updates flow back to Shell via the `setState` setter in deps.
 */

import type { PickupKind } from "@engine/engine";
import { dispatch } from "@engine/events";
import { WEAPONS, type WeaponId } from "@shared/weapons";
import { useRef } from "react";
import { LOOT_BONUSES, pickLootKind } from "../../loot";
import type { FadeKind, GameRef, GameState } from "../../ObjexoomShell";
import { GOING_BACK_BUDGET_MS } from "../../ObjexoomShell";
import { advanceLevel, runStatsReducer } from "../../runStats";
import type { DifficultyTuning, LevelChoice, ObjexoomSettings } from "../../settings";
import { playFlashlightClick, playHitSting, playPickup, playPlayerDeath } from "../../sfx";

/**
 * Per-pickup-kind action table. Lives in this module rather than in
 * Shell because the only consumer is `onCollectPickup` inside the
 * GameRef. Adding a new PickupKind = update this table + the
 * branches inside the callback.
 */
const AMMO_INCREMENT: Record<
	PickupKind,
	{ weapon: WeaponId; amount: number } | "health" | "flashlight" | "loot"
> = {
	health: "health",
	chaingunAmmo: { weapon: "chaingun", amount: WEAPONS.chaingun.pickupAmmo },
	shotgunAmmo: { weapon: "shotgun", amount: WEAPONS.shotgun.pickupAmmo },
	flashlight: "flashlight",
	loot: "loot",
};

export type UseGameRefDeps = Readonly<{
	setState: React.Dispatch<React.SetStateAction<GameState>>;
	triggerFadeRef: React.MutableRefObject<(kind: FadeKind, intensity?: number) => void>;
	settings: ObjexoomSettings;
	tuning: DifficultyTuning;
	seed: number;
	level: LevelChoice;
}>;

export function useGameRef(deps: UseGameRefDeps): React.MutableRefObject<GameRef> {
	const lastPlayerHitAt = useRef(0);
	// Re-point on every render so callbacks always see current deps.
	const depsRef = useRef(deps);
	depsRef.current = deps;

	const gameRef = useRef<GameRef>({
		onHit: (damage) => {
			const { setState, triggerFadeRef, settings, tuning } = depsRef.current;
			const now = performance.now();
			if (now - lastPlayerHitAt.current < tuning.playerIframeMs) return;
			lastPlayerHitAt.current = now;
			// I6 — camera shake scales with raw incoming damage.
			dispatch({ type: "shake", amount: damage });
			// I2 — player-position burst on every successful enemy hit (Scene resolves position).
			dispatch({ type: "playerHit" });
			// J3 — red fade overlay scaled by damage.
			triggerFadeRef.current("damage", Math.min(1, damage / 3));
			// K2 — sharp hit sting (distinct from ambient playHurt).
			if (settings.soundEnabled) playHitSting();
			setState((prev) => {
				if (prev.status !== "playing") return prev;
				const finalDamage = Math.round(damage * tuning.enemyDamageMultiplier);
				const hp = Math.max(0, prev.hp - finalDamage);
				// POL9 — player-death sting on HP→0 transition (single fire via prev.hp>0 gate).
				if (prev.hp > 0 && hp === 0 && settings.soundEnabled) {
					playPlayerDeath();
				}
				return {
					...prev,
					hp,
					status: hp <= 0 ? "dead" : prev.status,
					damageFlashAt: now,
					run: {
						...prev.run,
						runTotalDamageTaken: prev.run.runTotalDamageTaken + finalDamage,
					},
				};
			});
		},
		onKill: () => {
			const { setState } = depsRef.current;
			// Clamp per-level kill counter at totalEnemies. Debug paths can
			// re-trigger on already-dead enemies; HUD reads kills/totalEnemies
			// so an unclamped counter renders nonsense.
			setState((prev) => ({
				...prev,
				kills: Math.min(prev.kills + 1, prev.totalEnemies),
				run: {
					...prev.run,
					runTotalKills: prev.run.runTotalKills + 1,
				},
			}));
		},
		onPickupKey: () => {
			const { setState, triggerFadeRef } = depsRef.current;
			playPickup();
			triggerFadeRef.current("key");
			setState((prev) => ({ ...prev, hasKey: true }));
			// POL22 — typed event consumed by KeyPickupCeremony HUD overlay.
			dispatch({ type: "keyPickedUp" });
		},
		onWin: () => {
			const { setState } = depsRef.current;
			// H8 — first win trigger (player crossed RealDoor) flips phase to
			// "going_back". Every enemy re-aggros; the player must fight back
			// to the original spawn. Level-clear fires on `onReachSpawn`.
			// L2 — goal-collect drops chaingun + shotgun + flamethrower so the
			// going-back fight has firepower (ref's "RealDoor drop" pattern).
			setState((prev) => {
				if (prev.status !== "playing") return prev;
				if (prev.phase === "going_back") return prev;
				return {
					...prev,
					phase: "going_back",
					// POL37 — going-back deadline. Countdown overlay reads this.
					goingBackDeadlineMs: performance.now() + GOING_BACK_BUDGET_MS,
					ownedWeapons: {
						...prev.ownedWeapons,
						chaingun: true,
						shotgun: true,
						flamethrower: true,
					},
					ammo: {
						...prev.ammo,
						shotgun: Math.max(prev.ammo.shotgun, WEAPONS.shotgun.pickupAmmo + 4),
						flamethrower: Math.max(prev.ammo.flamethrower, WEAPONS.flamethrower.pickupAmmo + 10),
					},
				};
			});
		},
		onReachSpawn: () => {
			const { setState, triggerFadeRef, settings } = depsRef.current;
			triggerFadeRef.current("win");
			setState((prev) => {
				if (prev.status !== "playing") return prev;
				if (prev.phase !== "going_back") return prev;
				const advanced = advanceLevel(settings.level, prev.run.runLevelsCleared);
				const clearedRun = runStatsReducer(prev.run, {
					type: "clearLevel",
					killsThisLevel: 0,
					damageThisLevel: 0,
					scoreThisLevel: prev.score,
				});
				return {
					...prev,
					run: clearedRun,
					status: advanced === null ? "won" : "transitioning",
					// POL37 — clear the deadline; countdown hides.
					goingBackDeadlineMs: null,
				};
			});
		},
		onSpendAmmo: (weapon, amount) => {
			if (amount <= 0) return;
			const { setState } = depsRef.current;
			setState((prev) => ({
				...prev,
				ammo: {
					...prev.ammo,
					[weapon]: Math.max(0, prev.ammo[weapon] - amount),
				},
			}));
		},
		onCollectPickup: (kind) => {
			const { setState, triggerFadeRef, seed } = depsRef.current;
			// POL30 — fire pickup-collected event for PickupChip HUD overlay.
			// Key pickups don't route here — they have onPickupKey + POL22.
			dispatch({ type: "pickupCollected", kind });
			const action = AMMO_INCREMENT[kind];
			setState((prev) => {
				if (action === "health") {
					// L1 — +1 HP per pickup on the 0-9 scale.
					return { ...prev, hp: Math.min(prev.maxHp, prev.hp + 1) };
				}
				if (action === "flashlight") {
					triggerFadeRef.current("flash");
					// POL28 — flashlight click-on sting (distinct from pickup chime).
					playFlashlightClick();
					dispatch({ type: "flashlightAcquired" });
					return { ...prev, hasFlashlight: true };
				}
				if (action === "loot") {
					// COV12 step-2 — kind-specific bonus from pickLootKind(seed).
					const lootKind = pickLootKind(seed);
					if (lootKind === "bottles") {
						// +LOOT_BONUSES.bottlesHp (potion stash) — clamp to maxHp.
						return {
							...prev,
							hp: Math.min(prev.maxHp, prev.hp + LOOT_BONUSES.bottlesHp),
						};
					}
					if (lootKind === "books") {
						// Knowledge → bonus ammo across both ranged weapons.
						return {
							...prev,
							ammo: {
								...prev.ammo,
								chaingun: prev.ammo.chaingun + WEAPONS.chaingun.pickupAmmo,
								shotgun: prev.ammo.shotgun + WEAPONS.shotgun.pickupAmmo,
							},
						};
					}
					return { ...prev, score: prev.score + LOOT_BONUSES.treasureScore };
				}
				return {
					...prev,
					ammo: {
						...prev.ammo,
						[action.weapon]: prev.ammo[action.weapon] + action.amount,
					},
					ownedWeapons: { ...prev.ownedWeapons, [action.weapon]: true },
					weapon: prev.weapon === "pistol" ? action.weapon : prev.weapon,
				};
			});
		},
	});

	return gameRef;
}
