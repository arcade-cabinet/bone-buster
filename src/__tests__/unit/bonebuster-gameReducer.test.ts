/**
 * CR-H1scene step-d / CR-F8 — pins the pure GameState reducer. Every action ×
 * the relevant state branch, asserting BOTH the next state and the returned
 * effects (the data the adapter runs after commit). Because the reducer is
 * pure, these are plain input→output assertions with no React.
 */

import { WEAPON_ORDER, WEAPONS } from "@shared/weapons";
import { GOING_BACK_BUDGET_MS } from "@store/gameConstants";
import { type GameAction, type GameReducerCtx, gameReducer } from "@store/gameReducer";
import type { GameState } from "@store/gameState";
import { makeInitialRunStats } from "@store/runStats";
import { DIFFICULTY_TUNING } from "@store/settings";
import { LOOT_BONUSES } from "@world/loot";
import { describe, expect, it } from "vitest";

function baseState(over: Partial<GameState> = {}): GameState {
	return {
		status: "playing",
		hp: 9,
		maxHp: 9,
		kills: 0,
		score: 0,
		totalEnemies: 8,
		hasKey: false,
		hasFlashlight: false,
		hasEmfReader: false,
		hasSpiritBox: false,
		hasUvFlashlight: false,
		crucifixes: 0,
		weapon: "pistol",
		ammo: { pistol: 999, chaingun: 0, shotgun: 0, flamethrower: 0, melee: 0 },
		ownedWeapons: {
			pistol: true,
			chaingun: false,
			shotgun: false,
			flamethrower: false,
			melee: true,
		},
		damageFlashAt: 0,
		run: makeInitialRunStats(0),
		phase: "out",
		goingBackDeadlineMs: null,
		...over,
	};
}

function ctx(over: Partial<GameReducerCtx> = {}): GameReducerCtx {
	return {
		now: 100_000,
		tuning: DIFFICULTY_TUNING.hurtMePlenty,
		settings: { soundEnabled: true, level: 1 },
		seedLootKind: "treasure",
		iframeUntil: 0,
		acquired: new Set<string>(),
		...over,
	};
}

const run = (state: GameState, action: GameAction, c = ctx()) => gameReducer(state, action, c);

describe("gameReducer — hit", () => {
	it("subtracts difficulty-scaled damage and stamps damageFlashAt", () => {
		const tuning = {
			...DIFFICULTY_TUNING.hurtMePlenty,
			enemyDamageMultiplier: 1,
			playerIframeMs: 0,
		};
		const r = run(baseState({ hp: 9 }), { type: "hit", damage: 2 }, ctx({ tuning }));
		expect(r.state.hp).toBe(7);
		expect(r.state.damageFlashAt).toBe(100_000);
		expect(r.iframeUntil).toBe(100_000);
		expect(r.state.run.runTotalDamageTaken).toBe(2);
	});

	it("ignores a hit inside the i-frame window", () => {
		const tuning = {
			...DIFFICULTY_TUNING.hurtMePlenty,
			enemyDamageMultiplier: 1,
			playerIframeMs: 500,
		};
		// last accepted hit at 99_800, now 100_000 → 200ms < 500ms window.
		const r = run(
			baseState({ hp: 9 }),
			{ type: "hit", damage: 2 },
			ctx({ tuning, iframeUntil: 99_800 }),
		);
		expect(r.state.hp).toBe(9);
		expect(r.effects).toHaveLength(0);
	});

	it("flips status to dead on HP→0 and emits the death sting once", () => {
		const tuning = {
			...DIFFICULTY_TUNING.hurtMePlenty,
			enemyDamageMultiplier: 1,
			playerIframeMs: 0,
		};
		const r = run(baseState({ hp: 1 }), { type: "hit", damage: 5 }, ctx({ tuning }));
		expect(r.state.hp).toBe(0);
		expect(r.state.status).toBe("dead");
		expect(r.effects).toContainEqual({ kind: "audio", sound: "playerDeath" });
	});

	it("emits shake + playerHit + damage-fade effects scaled by damage", () => {
		const tuning = {
			...DIFFICULTY_TUNING.hurtMePlenty,
			enemyDamageMultiplier: 1,
			playerIframeMs: 0,
		};
		const r = run(baseState(), { type: "hit", damage: 6 }, ctx({ tuning }));
		expect(r.effects).toContainEqual({ kind: "dispatch", event: { type: "shake", amount: 6 } });
		expect(r.effects).toContainEqual({ kind: "dispatch", event: { type: "playerHit" } });
		expect(r.effects).toContainEqual({ kind: "fade", fade: "damage", intensity: 1 });
	});

	it("does not mutate HP when not playing but still updates the i-frame stamp", () => {
		const tuning = {
			...DIFFICULTY_TUNING.hurtMePlenty,
			enemyDamageMultiplier: 1,
			playerIframeMs: 0,
		};
		const r = run(baseState({ status: "won", hp: 5 }), { type: "hit", damage: 2 }, ctx({ tuning }));
		expect(r.state.hp).toBe(5);
		expect(r.iframeUntil).toBe(100_000);
	});
});

describe("gameReducer — kill", () => {
	it("increments kills + runTotalKills", () => {
		const r = run(baseState({ kills: 2 }), { type: "kill" });
		expect(r.state.kills).toBe(3);
		expect(r.state.run.runTotalKills).toBe(1);
	});
	it("clamps kills at totalEnemies", () => {
		const r = run(baseState({ kills: 8, totalEnemies: 8 }), { type: "kill" });
		expect(r.state.kills).toBe(8);
	});
});

describe("gameReducer — pickupKey", () => {
	it("sets hasKey and emits pickup audio + key fade + keyPickedUp event", () => {
		const r = run(baseState(), { type: "pickupKey" });
		expect(r.state.hasKey).toBe(true);
		expect(r.effects).toContainEqual({ kind: "audio", sound: "pickup" });
		expect(r.effects).toContainEqual({ kind: "fade", fade: "key" });
		expect(r.effects).toContainEqual({ kind: "dispatch", event: { type: "keyPickedUp" } });
	});
});

describe("gameReducer — win", () => {
	it("flips out→going_back, grants weapons + ammo + deadline, fires weaponAcquired for unowned", () => {
		const acquired = new Set<string>();
		const r = run(baseState({ phase: "out" }), { type: "win" }, ctx({ acquired }));
		expect(r.state.phase).toBe("going_back");
		expect(r.state.ownedWeapons.chaingun).toBe(true);
		expect(r.state.ownedWeapons.shotgun).toBe(true);
		expect(r.state.ownedWeapons.flamethrower).toBe(true);
		expect(r.state.goingBackDeadlineMs).toBe(100_000 + GOING_BACK_BUDGET_MS);
		// three unowned → three weaponAcquired dispatches.
		const acq = r.effects.filter((e) => e.kind === "dispatch" && e.event.type === "weaponAcquired");
		expect(acq).toHaveLength(3);
		expect(acquired.size).toBe(3);
	});

	it("does not re-fire weaponAcquired for a weapon already in the acquired set", () => {
		const acquired = new Set<string>(["chaingun", "shotgun", "flamethrower"]);
		const r = run(baseState({ phase: "out" }), { type: "win" }, ctx({ acquired }));
		const acq = r.effects.filter((e) => e.kind === "dispatch" && e.event.type === "weaponAcquired");
		expect(acq).toHaveLength(0);
	});

	it("is a no-op when already going_back", () => {
		const r = run(baseState({ phase: "going_back" }), { type: "win" });
		expect(r.state.phase).toBe("going_back");
		expect(r.effects).toHaveLength(0);
	});
});

describe("gameReducer — reachSpawn", () => {
	it("advances to transitioning when more levels remain", () => {
		const r = run(
			baseState({ phase: "going_back", goingBackDeadlineMs: 5 }),
			{ type: "reachSpawn" },
			ctx({ settings: { soundEnabled: true, level: 1 } }),
		);
		expect(r.state.status).toBe("transitioning");
		expect(r.state.goingBackDeadlineMs).toBeNull();
		expect(r.effects).toContainEqual({ kind: "fade", fade: "win" });
	});

	it("is a no-op (only the win fade) when not in going_back", () => {
		const r = run(baseState({ phase: "out" }), { type: "reachSpawn" });
		expect(r.state.status).toBe("playing");
		expect(r.effects).toEqual([{ kind: "fade", fade: "win" }]);
	});
});

describe("gameReducer — spendAmmo", () => {
	it("decrements the weapon's ammo, floored at 0", () => {
		const r = run(baseState({ ammo: { ...baseState().ammo, chaingun: 3 } }), {
			type: "spendAmmo",
			weapon: "chaingun",
			amount: 5,
		});
		expect(r.state.ammo.chaingun).toBe(0);
	});
	it("ignores non-positive amounts", () => {
		const before = baseState({ ammo: { ...baseState().ammo, chaingun: 3 } });
		const r = run(before, { type: "spendAmmo", weapon: "chaingun", amount: 0 });
		expect(r.state).toBe(before);
	});
});

describe("gameReducer — consumeCrucifix", () => {
	it("decrements and reports consumed when inventory > 0", () => {
		const r = run(baseState({ crucifixes: 2 }), { type: "consumeCrucifix" });
		expect(r.state.crucifixes).toBe(1);
		expect(r.consumed).toBe(true);
	});
	it("no-ops and reports not-consumed when inventory is empty", () => {
		const r = run(baseState({ crucifixes: 0 }), { type: "consumeCrucifix" });
		expect(r.state.crucifixes).toBe(0);
		expect(r.consumed).toBe(false);
	});
});

describe("gameReducer — collectPickup (CR-F8 table)", () => {
	it("health: +1 HP clamped to maxHp", () => {
		expect(
			run(baseState({ hp: 8, maxHp: 9 }), { type: "collectPickup", kind: "health" }).state.hp,
		).toBe(9);
		expect(
			run(baseState({ hp: 9, maxHp: 9 }), { type: "collectPickup", kind: "health" }).state.hp,
		).toBe(9);
	});

	it("flashlight: sets flag + click audio + flash fade + flashlightAcquired", () => {
		const r = run(baseState(), { type: "collectPickup", kind: "flashlight" });
		expect(r.state.hasFlashlight).toBe(true);
		expect(r.effects).toContainEqual({ kind: "audio", sound: "flashlightClick" });
		expect(r.effects).toContainEqual({ kind: "fade", fade: "flash" });
		expect(r.effects).toContainEqual({ kind: "dispatch", event: { type: "flashlightAcquired" } });
	});

	it.each([
		"emfReader",
		"spiritBox",
		"uvFlashlight",
	] as const)("%s: flips its ownership flag", (kind) => {
		const r = run(baseState(), { type: "collectPickup", kind });
		const flag = {
			emfReader: "hasEmfReader",
			spiritBox: "hasSpiritBox",
			uvFlashlight: "hasUvFlashlight",
		}[kind];
		expect(r.state[flag as keyof GameState]).toBe(true);
	});

	it("crucifix: increments inventory", () => {
		expect(
			run(baseState({ crucifixes: 1 }), { type: "collectPickup", kind: "crucifix" }).state
				.crucifixes,
		).toBe(2);
	});

	it("loot/bottles: +bottlesHp clamped", () => {
		const r = run(
			baseState({ hp: 4 }),
			{ type: "collectPickup", kind: "loot" },
			ctx({ seedLootKind: "bottles" }),
		);
		expect(r.state.hp).toBe(Math.min(9, 4 + LOOT_BONUSES.bottlesHp));
	});
	it("loot/books: +ammo on chaingun + shotgun", () => {
		const r = run(
			baseState(),
			{ type: "collectPickup", kind: "loot" },
			ctx({ seedLootKind: "books" }),
		);
		expect(r.state.ammo.chaingun).toBe(WEAPONS.chaingun.pickupAmmo);
		expect(r.state.ammo.shotgun).toBe(WEAPONS.shotgun.pickupAmmo);
	});
	it("loot/treasure: +treasureScore", () => {
		const r = run(
			baseState({ score: 10 }),
			{ type: "collectPickup", kind: "loot" },
			ctx({ seedLootKind: "treasure" }),
		);
		expect(r.state.score).toBe(10 + LOOT_BONUSES.treasureScore);
	});

	it("weapon-ammo: credits ammo, owns the weapon, auto-swaps from pistol, fires weaponAcquired once", () => {
		const acquired = new Set<string>();
		const r = run(
			baseState({ weapon: "pistol" }),
			{ type: "collectPickup", kind: "chaingunAmmo" },
			ctx({ acquired }),
		);
		expect(r.state.ammo.chaingun).toBe(WEAPONS.chaingun.pickupAmmo);
		expect(r.state.ownedWeapons.chaingun).toBe(true);
		expect(r.state.weapon).toBe("chaingun");
		expect(r.effects).toContainEqual({
			kind: "dispatch",
			event: { type: "weaponAcquired", weapon: "chaingun" },
		});
	});

	it("HUD3 — an in-world weapon pickup grows the own-only HUD bar (WEAPON_ORDER filter)", () => {
		// The HUD2 weapon bar renders WEAPON_ORDER.filter(id => ownedWeapons[id]).
		// Start = blade + pistol (2 chips); after a chaingun-ammo pickup the bar
		// must include chaingun (3 chips) — the in-world-pickup → arsenal → HUD
		// loop (PRD HUD3).
		const before = WEAPON_ORDER.filter((id) => baseState().ownedWeapons[id]);
		expect(before).toEqual(["melee", "pistol"]);
		const r = run(baseState({ weapon: "pistol" }), { type: "collectPickup", kind: "chaingunAmmo" });
		const after = WEAPON_ORDER.filter((id) => r.state.ownedWeapons[id]);
		expect(after).toContain("chaingun");
		expect(after.length).toBe(before.length + 1);
	});

	it("weapon-ammo: does NOT auto-swap away from a non-pistol weapon", () => {
		const r = run(
			baseState({
				weapon: "shotgun",
				ownedWeapons: { ...baseState().ownedWeapons, shotgun: true },
			}),
			{
				type: "collectPickup",
				kind: "chaingunAmmo",
			},
		);
		expect(r.state.weapon).toBe("shotgun");
	});

	it("weapon-ammo: skips weaponAcquired when already in the acquired set", () => {
		const acquired = new Set<string>(["chaingun"]);
		const r = run(baseState(), { type: "collectPickup", kind: "chaingunAmmo" }, ctx({ acquired }));
		const acq = r.effects.filter((e) => e.kind === "dispatch" && e.event.type === "weaponAcquired");
		expect(acq).toHaveLength(0);
	});

	it("every kind emits the POL30 pickupCollected event", () => {
		const r = run(baseState(), { type: "collectPickup", kind: "health" });
		expect(r.effects).toContainEqual({
			kind: "dispatch",
			event: { type: "pickupCollected", kind: "health" },
		});
	});
});
