/**
 * CONV2 — `GameRef` callback construction extracted from BoneBusterShell.
 *
 * Pre-CONV2 the 7-callback GameRef was inlined inside BoneBusterShell.tsx
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

import { playFlashlightClick, playHitSting, playPickup, playPlayerDeath } from "@audio/sfx";
import type { PickupKind } from "@engine/engine";
import { dispatch } from "@engine/events";
import { WEAPONS, type WeaponId } from "@shared/weapons";
import { advanceLevel, runStatsReducer } from "@store/runStats";
import type { BoneBusterSettings, DifficultyTuning, LevelChoice } from "@store/settings";
import type { FadeKind, GameRef, GameState } from "@views/Shell";
import { GOING_BACK_BUDGET_MS } from "@views/Shell";
import { LOOT_BONUSES, pickLootKind } from "@world/loot";
import { useRef } from "react";
import { flushSync } from "react-dom";

/**
 * Per-pickup-kind action table. Lives in this module rather than in
 * Shell because the only consumer is `onCollectPickup` inside the
 * GameRef. Adding a new PickupKind = update this table + the
 * branches inside the callback.
 */
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
	// D2 — flamethrowerAmmo on-collect credits the weapon's pickupAmmo
	// to the flamethrower slot. If the player doesn't own the flamethrower
	// yet, the ammo accumulates so picking up the weapon later starts
	// hot — same behavior as chaingun + shotgun ammo pre-pickup.
	flamethrowerAmmo: { weapon: "flamethrower", amount: WEAPONS.flamethrower.pickupAmmo },
	flashlight: "flashlight",
	loot: "loot",
	// PB5 step-2 — EMF reader on-collect flips the ownership flag. No
	// weapon slot, no ammo: it's a passive detection tool consumed by
	// the HUD chip.
	emfReader: "emfReader",
	// PC2 — Spirit box on-collect flips the ownership flag. Same passive
	// tool shape as the EMF reader.
	spiritBox: "spiritBox",
	// PC3 — UV flashlight on-collect flips the ownership flag. Mounts
	// the second purple SpotLight + drives the per-frame UV-cone reveal
	// of uvHidden-tagged enemies.
	uvFlashlight: "uvFlashlight",
	// PC4 — Crucifix on-collect increments the inventory counter. The
	// player can stack several across a run and drop them one at a time
	// with key `9`.
	crucifix: "crucifix",
};

export type UseGameRefDeps = Readonly<{
	setState: React.Dispatch<React.SetStateAction<GameState>>;
	triggerFadeRef: React.MutableRefObject<(kind: FadeKind, intensity?: number) => void>;
	settings: BoneBusterSettings;
	tuning: DifficultyTuning;
	seed: number;
	level: LevelChoice;
}>;

export function useGameRef(deps: UseGameRefDeps): React.MutableRefObject<GameRef> {
	const lastPlayerHitAt = useRef(0);
	// Re-point on every render so callbacks always see current deps.
	const depsRef = useRef(deps);
	depsRef.current = deps;
	// D3 — tracks the set of weapons that have already emitted a
	// `weaponAcquired` event this session. setState's `prev` snapshot
	// can lag across multiple collects in the same React batch (two
	// shotgunAmmo pickups in a single `collectAllPickups` call both
	// see `prev.ownedWeapons.shotgun === false`); a stable ref-tracked
	// set is the correct dedup gate. Reset by useGameRef's mount —
	// any new mount (level transition with new map key) starts fresh.
	const acquiredRef = useRef<Set<string>>(new Set());

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
			//
			// PT4 — dispatches buffered in the setState callback and flushed
			// AFTER setState returns. Calling dispatch synchronously inside
			// the updater fires listener setStates while React is mid-render
			// of BoneBusterShell, producing the "Cannot update a component
			// while rendering a different component" console.error.
			const toDispatch: Array<{ weapon: "chaingun" | "shotgun" | "flamethrower" }> = [];
			setState((prev) => {
				if (prev.status !== "playing") return prev;
				if (prev.phase === "going_back") return prev;
				// D3 — RealDoor drop grants chaingun + shotgun + flamethrower.
				// Fire weaponAcquired for any the player didn't already
				// own, with the same acquiredRef dedup gate as the pickup
				// path. Effects are buffered; the dispatch happens below.
				for (const w of ["chaingun", "shotgun", "flamethrower"] as const) {
					if (!prev.ownedWeapons[w] && !acquiredRef.current.has(w)) {
						acquiredRef.current.add(w);
						toDispatch.push({ weapon: w });
					}
				}
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
			// PT4 — flush buffered weaponAcquired events outside the
			// updater so listener setStates don't fire during BoneBusterShell's
			// render commit.
			for (const ev of toDispatch) dispatch({ type: "weaponAcquired", weapon: ev.weapon });
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
		onConsumeCrucifix: () => {
			// PC4 — atomic check-and-decrement. The functional updater isn't
			// guaranteed to execute synchronously before setState returns
			// under React 19 batching, so wrap in flushSync to force the
			// `consumed` flag to settle before this function returns.
			// Returning false signals "nothing in inventory, no-op the
			// caller's placement" so Scene doesn't push a phantom entry.
			let consumed = false;
			flushSync(() => {
				depsRef.current.setState((prev) => {
					if (prev.crucifixes <= 0) return prev;
					consumed = true;
					return { ...prev, crucifixes: prev.crucifixes - 1 };
				});
			});
			return consumed;
		},
		onCollectPickup: (kind) => {
			const { setState, triggerFadeRef, seed } = depsRef.current;
			// POL30 — fire pickup-collected event for PickupChip HUD overlay.
			// Key pickups don't route here — they have onPickupKey + POL22.
			dispatch({ type: "pickupCollected", kind });
			const action = AMMO_INCREMENT[kind];
			// PT4 — buffer dispatches that must fire AFTER setState. Calling
			// dispatch inside the updater fires listener setStates while
			// React is mid-render of the consumer (BoneBusterShell), producing
			// the "Cannot update a component while rendering a different
			// component" console.error.
			let dispatchFlashlight = false;
			let dispatchWeapon: WeaponId | null = null;
			setState((prev) => {
				if (action === "health") {
					// L1 — +1 HP per pickup on the 0-9 scale.
					return { ...prev, hp: Math.min(prev.maxHp, prev.hp + 1) };
				}
				if (action === "flashlight") {
					triggerFadeRef.current("flash");
					// POL28 — flashlight click-on sting (distinct from pickup chime).
					playFlashlightClick();
					dispatchFlashlight = true;
					return { ...prev, hasFlashlight: true };
				}
				if (action === "emfReader") {
					// PB5 step-2 — passive tool pickup. No fade, no dedicated
					// sting in step-2; the POL30 pickupCollected dispatch
					// above already feeds the PickupChip slot. Future audio
					// commit can layer in the Phasmo-style EMF click.
					return { ...prev, hasEmfReader: true };
				}
				if (action === "spiritBox") {
					// PC2 — same passive shape as the EMF reader; flips the
					// ownership flag and lets the SpiritBoxBubble HUD slot
					// subscribe. Audio sting deferred to the same future
					// commit that adds the EMF click.
					return { ...prev, hasSpiritBox: true };
				}
				if (action === "uvFlashlight") {
					// PC3 — flip the UV flashlight flag. Mounts the second
					// purple SpotLight in BoneBusterScene + drives the
					// per-frame UV-cone visibility reveal of uvHidden enemies.
					return { ...prev, hasUvFlashlight: true };
				}
				if (action === "crucifix") {
					// PC4 — inventory counter, not a flag. Player can stack
					// several across a run; key `9` consumes one at a time.
					return { ...prev, crucifixes: prev.crucifixes + 1 };
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
				// D3 — first-time weapon acquisition fires a typed event for
				// the PickupChip HUD slot's chip-brighten beat. Dedup
				// gate is `acquiredRef.current` (a stable ref-tracked
				// set) — `prev.ownedWeapons` can't be trusted because
				// React batches multiple setState callbacks against the
				// same snapshot, so two ammo pickups for the same weapon
				// in the same tick would both see `prev.X === false`.
				if (!acquiredRef.current.has(action.weapon)) {
					acquiredRef.current.add(action.weapon);
					dispatchWeapon = action.weapon;
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
			// PT4 — flush buffered events outside the updater.
			if (dispatchFlashlight) dispatch({ type: "flashlightAcquired" });
			if (dispatchWeapon !== null) dispatch({ type: "weaponAcquired", weapon: dispatchWeapon });
		},
	});

	return gameRef;
}
