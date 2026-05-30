/**
 * Core game-state domain types. PREP-C1 (OVERHAUL2 review): moved out of the
 * UI god-component `app/views/Shell.tsx` into `src/store/` to fix the layer
 * inversion — the pure store/scene/sim layers (gameReducer, sceneTick,
 * fireResolution, useGameRef, fadeTriggers) imported these type contracts UP
 * from the view layer. They depend only on other `src/` types (WeaponId,
 * PickupKind, RunStats), so this is their correct home; everything else imports
 * DOWN/sideways. Unblocks STRUCT4 (weapon-upgrade) pure unit tests that no
 * longer drag React in via `@views/Shell`.
 */

import type { PickupKind } from "@engine/mapTypes";
import type { WeaponId } from "@shared/weapons";
import type { RunStats } from "@store/runStats";

export type GameStatus = "landing" | "playing" | "paused" | "dead" | "transitioning" | "won";

// H8 — `phase` tracks where the player is within a single level.
//   "out"          — heading toward the goal, normal level flow.
//   "going_back"   — goal collected; all enemies aggro; player must
//                    fight back to the original spawn to clear the level.
export type LevelPhase = "out" | "going_back";

// J3 — full-screen fade overlay. Each trigger renders a colored quad
// with an opacity envelope (peak 200 ms, fade 400 ms). Distinct triggers:
//   damage   — red, intensity scaled by damage amount (replaces D-flash)
//   key      — green, on key pickup
//   flash    — gray, on flashlight pickup
//   win      — white, on level-clear
export type FadeKind = "damage" | "key" | "flash" | "win";
export type FadeTrigger = Readonly<{
	id: number;
	kind: FadeKind;
	color: string;
	peak: number; // 0..1 opacity peak
}>;

export type GameState = {
	status: GameStatus;
	hp: number;
	maxHp: number;
	kills: number;
	/**
	 * POL1 — running score across the current level. Earned from
	 * COV12 treasure-loot pickups (+50 each) and reset on level
	 * advance / death. Surfaced on the HUD next to KILLS.
	 */
	score: number;
	totalEnemies: number;
	hasKey: boolean;
	// J1 (retired-reveal) — flashlight ownership flag. Post-VIS1 the flood lights
	// the scene regardless; the pickup + cone are cosmetic. Flips true on pickup.
	hasFlashlight: boolean;
	// PB5 step-2 — EMF reader ownership flag. When true, the HUD shows
	// the EMF chip with a 1-5 stepwise readout of nearest-enemy
	// proximity. Off by default; flips true on pickup.
	hasEmfReader: boolean;
	// PC2 — Spirit box ownership flag. When true, the SpiritBoxBubble
	// HUD overlay listens for the `spiritBoxResponse` event and renders
	// the deterministic phoneme for ~1s. Off by default; flips true on
	// pickup.
	hasSpiritBox: boolean;
	// PC3 — UV flashlight ownership flag. When true, BoneBusterScene
	// mounts the UvFlashlight component (purple SpotLight) and EnemyMesh
	// runs the per-frame UV-cone reveal for uvHidden enemies. Off by
	// default; flips true on pickup.
	hasUvFlashlight: boolean;
	// PC4 — Crucifix inventory counter. Increments on pickup, decrements
	// when the player drops one via key `9`. Each placed crucifix
	// suppresses enemy aggression in a fixed radius for
	// CRUCIFIX_LIFETIME_MS. Resets to 0 on level transition.
	crucifixes: number;
	weapon: WeaponId;
	ammo: Record<WeaponId, number>;
	ownedWeapons: Record<WeaponId, boolean>;
	/**
	 * STRUCT4 — per-weapon upgrade tier (0 = base). Each upgrade pickup
	 * increments the tier of the owned weapon it targets; `effectiveWeaponSpec`
	 * applies the log-scaled fire-rate / damage / multi-shot / spread bonuses.
	 * Reset to all-0 on a fresh run.
	 */
	weaponTiers: Record<WeaponId, number>;
	damageFlashAt: number;
	run: RunStats;
	phase: LevelPhase;
	/**
	 * POL37 — going-back countdown deadline. Set on `out → going_back`
	 * transition to `performance.now() + GOING_BACK_BUDGET_MS`; cleared
	 * (null) on `reachSpawn` and on every fresh level/run.
	 *
	 * When the deadline elapses without reaching spawn, the level dies
	 * via the existing hp→0 path so engine.ts's death handling carries
	 * the rest (no new state branch). HUD surfaces a monospace red
	 * countdown under GoingBackOverlay's "RETURN TO SPAWN" card.
	 */
	goingBackDeadlineMs: number | null;
};

export type WeaponState = {
	weapon: WeaponId;
	ammo: Record<WeaponId, number>;
};

export type GameRef = {
	onHit(damage: number): void;
	onKill(): void;
	onPickupKey(): void;
	onWin(): void;
	onReachSpawn(): void;
	onSpendAmmo(weapon: WeaponId, amount: number): void;
	onCollectPickup(kind: PickupKind): void;
	/** STRUCT4 — bump the upgrade tier of an owned weapon (upgrade pickup). */
	onUpgradeWeapon(weapon: WeaponId): void;
	/**
	 * PC4 — Consume one crucifix from inventory. Returns `true` if
	 * the inventory had ≥1 (the Scene proceeds with the placement)
	 * and `false` if the inventory was empty (the Scene no-ops the
	 * keypress so a player slapping `9` with zero inventory doesn't
	 * accidentally place a phantom crucifix at the origin).
	 */
	onConsumeCrucifix(): boolean;
};
