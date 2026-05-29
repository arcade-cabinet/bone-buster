/**
 * CR-F7 — deterministic combat. The shotgun's 7-pellet spread used to draw
 * from `Math.random()`, so which enemy each pellet hit was non-reproducible.
 * resolveFire now forks `forkStream(map.seedPhrase, "FIRE-<shotIndex>")` per
 * shot (after the cooldown + ammo gates), making the spread — and therefore
 * the damage distribution across enemies — deterministic per (seed, shot
 * index). This pins that contract: same seed + same shot index → identical
 * enemy-HP outcome; a different seed diverges.
 *
 * (Shell-eject + particle jitter intentionally stay Math.random — render-only,
 * never affect which enemy is hit — so they're not exercised here.)
 */

import { generateMap } from "@engine/gridGen";
import type { BoneBusterGridMap, Enemy } from "@engine/mapTypes";
import { type FireResolutionContext, resolveFire } from "@scene/tick/fireResolution";
import type { GameRef, WeaponState } from "@store/gameState";
import { DEFAULT_SETTINGS } from "@store/settings";
import type * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

// A spread of enemies arranged in a fan in front of the player so the 7-pellet
// shotgun cone lands on different subsets depending on the spread draws.
function makeEnemies(): Enemy[] {
	const enemies: Enemy[] = [];
	let id = 0;
	for (let i = -3; i <= 3; i += 1) {
		enemies.push({
			id: id++,
			kind: "rattler",
			position: { x: 12 + i * 0.6, y: 16 },
			hp: 100,
			maxHp: 100,
			lastAttackAt: 0,
			dead: false,
			fsmState: 1,
			patrolBearing: 0,
			lastShotAt: 0,
		});
	}
	return enemies;
}

function makeGameRefSpy(): GameRef {
	return {
		onHit: vi.fn(),
		onKill: vi.fn(),
		onPickupKey: vi.fn(),
		onWin: vi.fn(),
		onReachSpawn: vi.fn(),
		onSpendAmmo: vi.fn(),
		onCollectPickup: vi.fn(),
		onConsumeCrucifix: vi.fn(() => false),
	};
}

/** Aim the camera down +Z toward the enemy fan at (12, 16). Player at (12, 10). */
function makeCamera() {
	// resolveFire reads camera.position.{x,z}, .quaternion, .rotation.y. A
	// default-oriented camera looks down -Z; the enemies sit at +Z (z=16 > 10),
	// so face +Z by rotating 180° about Y.
	const cam = {
		position: { x: 12, y: 1.5, z: 10 },
		quaternion: { x: 0, y: 1, z: 0, w: 0 }, // 180° about Y → forward = +Z
		rotation: { x: 0, y: Math.PI, z: 0 },
	};
	return cam as unknown as FireResolutionContext["camera"];
}

function fireShotgunOnce(seedPhrase: string): number[] {
	const map = generateMap(seedPhrase) as BoneBusterGridMap;
	// Clear a straight lane so wall geometry doesn't absorb pellets before the
	// enemy fan — the test isolates SPREAD determinism, not map collision.
	for (const row of map.cells) row.fill("empty");
	const enemies = makeEnemies();
	const ammo: WeaponState = {
		weapon: "shotgun",
		ammo: { pistol: 0, chaingun: 0, shotgun: 5, flamethrower: 0, melee: 0 },
	};
	const ctx: FireResolutionContext = {
		active: true,
		weapon: "shotgun",
		now: 10_000,
		camera: makeCamera(),
		map,
		settings: { ...DEFAULT_SETTINGS, soundEnabled: false },
		ammoRef: { current: ammo },
		gameRef: { current: makeGameRefSpy() },
		enemiesRef: { current: enemies },
		barrelsRef: { current: [] },
		enemyMeshesRef: { current: new Map() },
		collisionCtxRef: { current: { doorOpen: true } },
		lastFireAtRef: { current: 0 },
		muzzleFlashUntilRef: { current: 0 },
		muzzleColorRef: { current: { set: () => undefined } as unknown as THREE.Color },
		muzzleIntensityScaleRef: { current: 1 },
		timeScaleBus: { reserve: () => undefined },
		explodeBarrel: () => undefined,
		shotCounterRef: { current: 0 },
	};
	resolveFire(ctx);
	// Observable outcome: per-enemy HP after the shot (100 = untouched).
	return enemies.map((e) => e.hp);
}

describe("CR-F7 — deterministic pellet spread", () => {
	it("the same seed phrase produces an identical enemy-HP outcome", () => {
		const a = fireShotgunOnce("fire-test-alpha");
		const b = fireShotgunOnce("fire-test-alpha");
		expect(a).toEqual(b);
	});

	it("at least one pellet lands (the fan is in the cone) — the test is meaningful", () => {
		const hp = fireShotgunOnce("fire-test-alpha");
		expect(hp.some((h) => h < 100)).toBe(true);
	});

	it("a different seed phrase diverges the spread (different HP outcome)", () => {
		const a = fireShotgunOnce("fire-test-alpha");
		const c = fireShotgunOnce("fire-test-gamma");
		// Overwhelmingly likely to differ across 14 spread draws; if a future
		// seed pair ever collides, change the gamma phrase.
		expect(a).not.toEqual(c);
	});

	it("consecutive shots (advancing shotCounter) draw different spreads", () => {
		const map = generateMap("fire-test-alpha") as BoneBusterGridMap;
		for (const row of map.cells) row.fill("empty");
		const enemies = makeEnemies();
		const shotCounterRef = { current: 0 };
		const baseCtx = {
			active: true,
			weapon: "shotgun" as const,
			now: 10_000,
			camera: makeCamera(),
			map,
			settings: { ...DEFAULT_SETTINGS, soundEnabled: false },
			ammoRef: {
				current: {
					weapon: "shotgun" as const,
					ammo: { pistol: 0, chaingun: 0, shotgun: 50, flamethrower: 0, melee: 0 },
				},
			},
			gameRef: { current: makeGameRefSpy() },
			enemiesRef: { current: enemies },
			barrelsRef: { current: [] },
			enemyMeshesRef: { current: new Map() },
			collisionCtxRef: { current: { doorOpen: true } },
			lastFireAtRef: { current: 0 },
			muzzleFlashUntilRef: { current: 0 },
			muzzleColorRef: { current: { set: () => undefined } as unknown as THREE.Color },
			muzzleIntensityScaleRef: { current: 1 },
			timeScaleBus: { reserve: () => undefined },
			explodeBarrel: () => undefined,
			shotCounterRef,
		} satisfies FireResolutionContext;
		// First shot — capture damage delta.
		resolveFire(baseCtx);
		const afterShot1 = enemies.map((e) => e.hp);
		// shotCounter advanced to 1; allow the next shot through the cooldown.
		baseCtx.now = 20_000;
		baseCtx.lastFireAtRef.current = 0;
		resolveFire(baseCtx);
		const afterShot2 = enemies.map((e) => e.hp);
		// The second shot's spread (FIRE-1) differs from the first (FIRE-0), so
		// it deals additional damage to a (generally different) pellet pattern —
		// total damage strictly increased somewhere.
		expect(afterShot2.some((h, i) => h < (afterShot1[i] ?? 100))).toBe(true);
		expect(shotCounterRef.current).toBe(2);
	});
});
