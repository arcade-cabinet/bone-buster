/**
 * CR-H1scene step-c — pins the observable contract of `runSceneTick`, the
 * per-frame MAIN tick lifted out of BoneBusterScene. The useFrame registration
 * stays in the component (frame-order invariant); this test exercises the pure
 * body directly with a fake camera + spy GameRef + the refs it mutates, so any
 * behavior drift in the relocated tick turns a unit test red.
 *
 * Covered behaviors: pickup collection (onCollectPickup + mark collected),
 * lava-damage cadence (600 ms throttle), and the phase-aware win condition
 * (phase "out" + at-exit + key + all-bosses-dead → onWin once).
 */

import type { BoneBusterGridMap, Cell, Pickup } from "@engine/mapTypes";
import { runSceneTick, type SceneTickDeps } from "@scene/tick/sceneTick";
import { createTimeScaleBus } from "@scene/tick/timeScaleBus";
import type { GameRef } from "@store/gameState";
import { DEFAULT_SETTINGS } from "@store/settings";
import { beforeEach, describe, expect, it, vi } from "vitest";

function makeGameRefSpy() {
	return {
		onHit: vi.fn(),
		onKill: vi.fn(),
		onPickupKey: vi.fn(),
		onWin: vi.fn(),
		onReachSpawn: vi.fn(),
		onSpendAmmo: vi.fn(),
		onCollectPickup: vi.fn(),
		onConsumeCrucifix: vi.fn(() => false),
	} satisfies GameRef;
}

/** Minimal camera stub — runSceneTick reads only `.position.{x,z}`. */
function makeCamera(x: number, z: number) {
	return { position: { x, y: 0, z } } as unknown as SceneTickDeps["camera"];
}

/** A tiny all-empty grid map with a single lava cell at (1,1). */
function makeGridMap(): BoneBusterGridMap {
	const cells: Cell[][] = Array.from({ length: 8 }, () => new Array<Cell>(8).fill("empty"));
	const lavaRow = cells[1];
	if (lavaRow) lavaRow[1] = "lava";
	return {
		kind: "grid",
		seedPhrase: "tick-test-phrase",
		archetype: "corridor",
		width: 8,
		height: 8,
		cells,
		playerSpawn: { x: 3.5, y: 3.5 },
		playerYaw: 0,
		enemySpawns: [],
		pickupSpawns: [],
		keyPosition: { x: 6.5, y: 6.5 },
		exitPosition: { x: 6.5, y: 0.5 },
		doorCell: { gx: 6, gy: 0 },
		rooms: [],
	};
}

function baseDeps(
	over: Partial<SceneTickDeps> & { camera: SceneTickDeps["camera"] },
): SceneTickDeps {
	return {
		deltaSeconds: 1 / 60,
		map: makeGridMap(),
		settings: DEFAULT_SETTINGS,
		hasKey: false,
		lightPalette: { ambientMul: 1, directionalMul: 1 },
		gameRef: { current: makeGameRefSpy() },
		prevPlayerPosRef: { current: null },
		playerVelocityRef: { current: { x: 0, y: 0 } },
		phaseRef: { current: "out" },
		allBossesDead: true,
		setAllBossesDead: vi.fn(),
		lastWonAtRef: { current: false },
		lastReachedSpawnAtRef: { current: false },
		strobeFrameRef: { current: 0 },
		ambientLightRef: { current: null },
		directionalLightRef: { current: null },
		lastLavaTickAtRef: { current: 0 },
		trapsRef: { current: [] },
		lastTrapTickAtRef: { current: new Map() },
		bumpTrapsDisarmedVersion: vi.fn(),
		pickupsRef: { current: [] },
		pickupMeshesRef: { current: new Map() },
		enemiesRef: { current: [] },
		enemyMeshesRef: { current: new Map() },
		yukaEntitiesRef: { current: new Map() },
		lastSeenRef: { current: new Map() },
		aggroFiredRef: { current: new Set() },
		bossSpottedFiredRef: { current: new Set() },
		collisionCtxRef: { current: { doorOpen: false } },
		timeScaleBusRef: { current: createTimeScaleBus() },
		crucifixesRef: { current: [] },
		bulletsRef: { current: [] },
		nextBulletIdRef: { current: 1 },
		bulletMeshesRef: { current: new Map() },
		tickYuka: vi.fn(),
		playPortal: vi.fn(),
		playHurt: vi.fn(),
		playPickup: vi.fn(),
		...over,
	};
}

describe("runSceneTick (CR-H1scene step-c)", () => {
	beforeEach(() => {
		// Anchor performance.now so the lava-cadence throttle is deterministic.
		vi.spyOn(performance, "now").mockReturnValue(10_000);
	});

	it("collects a pickup the player overlaps and credits it once", () => {
		const pickup: Pickup = {
			id: 0,
			kind: "health",
			position: { x: 3.5, y: 3.5 },
			collected: false,
		};
		const game = makeGameRefSpy();
		const deps = baseDeps({
			camera: makeCamera(3.5, 3.5),
			gameRef: { current: game },
			pickupsRef: { current: [pickup] },
		});
		runSceneTick(deps);
		expect(pickup.collected).toBe(true);
		expect(game.onCollectPickup).toHaveBeenCalledExactlyOnceWith("health");
		// Second tick: already collected → no double-credit.
		runSceneTick(deps);
		expect(game.onCollectPickup).toHaveBeenCalledTimes(1);
	});

	it("does not collect a pickup that is out of range", () => {
		const pickup: Pickup = {
			id: 0,
			kind: "health",
			position: { x: 6.5, y: 6.5 },
			collected: false,
		};
		const game = makeGameRefSpy();
		runSceneTick(
			baseDeps({
				camera: makeCamera(3.5, 3.5),
				gameRef: { current: game },
				pickupsRef: { current: [pickup] },
			}),
		);
		expect(pickup.collected).toBe(false);
		expect(game.onCollectPickup).not.toHaveBeenCalled();
	});

	it("ticks lava damage when standing on a lava cell, throttled to 600 ms", () => {
		const game = makeGameRefSpy();
		// TILE=4, so grid cell (1,1) spans world [4,8). Player at world (5,5)
		// → floor(5/4)=1 → grid (1,1), the lava cell.
		const deps = baseDeps({
			camera: makeCamera(5, 5),
			gameRef: { current: game },
			lastLavaTickAtRef: { current: 0 },
		});
		runSceneTick(deps);
		expect(game.onHit).toHaveBeenCalledExactlyOnceWith(8);
		// Same frame-time again (mock fixed at 10_000) → inside the 600 ms
		// window since lastLavaTickAt was set to 10_000 → no second tick.
		runSceneTick(deps);
		expect(game.onHit).toHaveBeenCalledTimes(1);
	});

	it("fires onWin once when phase=out, at the exit, with key + all bosses dead", () => {
		const game = makeGameRefSpy();
		const map = makeGridMap();
		const deps = baseDeps({
			camera: makeCamera(map.exitPosition.x, map.exitPosition.y),
			map,
			gameRef: { current: game },
			hasKey: true,
			allBossesDead: true,
			phaseRef: { current: "out" },
		});
		runSceneTick(deps);
		expect(game.onWin).toHaveBeenCalledTimes(1);
		expect(game.onReachSpawn).not.toHaveBeenCalled();
		// Latched — a second tick at the exit doesn't re-fire onWin.
		runSceneTick(deps);
		expect(game.onWin).toHaveBeenCalledTimes(1);
	});

	it("does not win at the exit without the key", () => {
		const game = makeGameRefSpy();
		const map = makeGridMap();
		runSceneTick(
			baseDeps({
				camera: makeCamera(map.exitPosition.x, map.exitPosition.y),
				map,
				gameRef: { current: game },
				hasKey: false,
				phaseRef: { current: "out" },
			}),
		);
		expect(game.onWin).not.toHaveBeenCalled();
	});

	it("fires onReachSpawn once when phase=going_back and player is at the spawn", () => {
		const game = makeGameRefSpy();
		const map = makeGridMap();
		const deps = baseDeps({
			camera: makeCamera(map.playerSpawn.x, map.playerSpawn.y),
			map,
			gameRef: { current: game },
			phaseRef: { current: "going_back" },
			lastReachedSpawnAtRef: { current: false },
		});
		runSceneTick(deps);
		expect(game.onReachSpawn).toHaveBeenCalledTimes(1);
		runSceneTick(deps);
		expect(game.onReachSpawn).toHaveBeenCalledTimes(1);
	});

	it("advances the going_back light strobe frame counter", () => {
		const strobeFrameRef = { current: 0 };
		const deps = baseDeps({
			camera: makeCamera(0, 0),
			phaseRef: { current: "going_back" },
			strobeFrameRef,
		});
		runSceneTick(deps);
		expect(strobeFrameRef.current).toBe(1);
	});

	it("invokes the injected yuka tick exactly once per frame", () => {
		const tickYuka = vi.fn();
		runSceneTick(baseDeps({ camera: makeCamera(0, 0), tickYuka }));
		expect(tickYuka).toHaveBeenCalledTimes(1);
	});
});
