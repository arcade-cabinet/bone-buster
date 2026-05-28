/**
 * CR-H1scene step-c — the per-frame MAIN simulation tick, lifted out of
 * BoneBusterScene's `useFrame` body into a pure function. The `useFrame`
 * REGISTRATION stays in BoneBusterScene (so frame-callback ordering relative
 * to the auxiliary loops + the priority-pinned muzzle block is byte-identical —
 * see docs/specs/97-scene-decomposition.md); the body — yuka tick, phase-aware
 * win condition, going-back light strobe, lava damage, trap tick/disarm,
 * pickup collection, the enemy AI loop, and bullet integration — moves here.
 *
 * Matches the established frame-loop idiom (`tickEnemyLoop`, `resolveFire`):
 * Scene's `useFrame` shrinks to a single `runSceneTick({...})` call passing the
 * refs/values it owns. Behavior is byte-identical; this is a pure relocation.
 */

import { dispatch } from "@engine/events";
import type { BoneBusterMap, CollisionContext, Enemy, Pickup } from "@engine/mapTypes";
import { ENEMY_BULLET_DAMAGE, type EnemyBullet, stepEnemyBullet } from "@engine/projectiles";
import { polygonContains } from "@engine/sectors";
import { TILE } from "@shared/constants";
import type { BoneBusterSettings } from "@store/settings";
import type { GameRef, LevelPhase } from "@views/Shell";
import type { CrucifixInstance } from "@world/ghostHunting";
import {
	disarmSector,
	TRAP_OVERLAP_RADIUS,
	TRAP_TICK_COOLDOWN_MS,
	TRAP_TICK_DAMAGE,
	TRIGGER_OVERLAP_RADIUS,
	type TrapInstance,
	trapAt,
	triggerAt,
} from "@world/scatter/trapScatter";
import type * as THREE from "three";
import type * as Yuka from "yuka";
import { tickEnemyLoop } from "./enemyTickLoop";
import type { TimeScaleBus } from "./timeScaleBus";

type CollisionCtxRef = { current: CollisionContext };

/** Light palette fields the going-back strobe reads (subset of the archetype palette). */
type StrobePalette = Readonly<{ ambientMul: number; directionalMul: number }>;

export type SceneTickDeps = Readonly<{
	deltaSeconds: number;
	camera: THREE.Camera;
	map: BoneBusterMap;
	settings: BoneBusterSettings;
	hasKey: boolean;
	lightPalette: StrobePalette;
	gameRef: { current: GameRef };
	// player-motion derivation
	prevPlayerPosRef: { current: { x: number; y: number } | null };
	playerVelocityRef: { current: { x: number; y: number } };
	// phase + win-condition latches
	phaseRef: { current: LevelPhase };
	allBossesDead: boolean;
	setAllBossesDead: (next: boolean) => void;
	lastWonAtRef: { current: boolean };
	lastReachedSpawnAtRef: { current: boolean };
	// going-back strobe
	strobeFrameRef: { current: number };
	ambientLightRef: { current: THREE.AmbientLight | null };
	directionalLightRef: { current: THREE.DirectionalLight | null };
	// lava
	lastLavaTickAtRef: { current: number };
	// traps
	trapsRef: { current: TrapInstance[] };
	lastTrapTickAtRef: { current: Map<number, number> };
	bumpTrapsDisarmedVersion: () => void;
	// pickups
	pickupsRef: { current: Pickup[] };
	pickupMeshesRef: { current: Map<number, THREE.Group> };
	// enemy AI loop deps
	enemiesRef: { current: Enemy[] };
	enemyMeshesRef: { current: Map<number, THREE.Group> };
	yukaEntitiesRef: { current: Map<number, Yuka.GameEntity> };
	lastSeenRef: { current: Map<number, number> };
	aggroFiredRef: { current: Set<number> };
	bossSpottedFiredRef: { current: Set<number> };
	collisionCtxRef: CollisionCtxRef;
	timeScaleBusRef: { current: TimeScaleBus };
	crucifixesRef: { current: readonly CrucifixInstance[] };
	// bullets
	bulletsRef: { current: EnemyBullet[] };
	nextBulletIdRef: { current: number };
	bulletMeshesRef: { current: Map<number, THREE.Group> };
	// audio + scheduler callbacks (injected so this stays free of direct
	// SFX/yuka imports the Scene already owns and so tests can stub them)
	tickYuka: (dt: number) => void;
	playPortal: () => void;
	playHurt: () => void;
	playPickup: () => void;
}>;

export function runSceneTick(deps: SceneTickDeps): void {
	const {
		deltaSeconds,
		camera,
		map,
		settings,
		hasKey,
		lightPalette,
		gameRef,
		prevPlayerPosRef,
		playerVelocityRef,
		phaseRef,
		allBossesDead,
		setAllBossesDead,
		lastWonAtRef,
		lastReachedSpawnAtRef,
		strobeFrameRef,
		ambientLightRef,
		directionalLightRef,
		lastLavaTickAtRef,
		trapsRef,
		lastTrapTickAtRef,
		bumpTrapsDisarmedVersion,
		pickupsRef,
		pickupMeshesRef,
		enemiesRef,
		enemyMeshesRef,
		yukaEntitiesRef,
		lastSeenRef,
		aggroFiredRef,
		bossSpottedFiredRef,
		collisionCtxRef,
		timeScaleBusRef,
		crucifixesRef,
		bulletsRef,
		nextBulletIdRef,
		bulletMeshesRef,
		tickYuka,
		playPortal,
		playHurt,
		playPickup,
	} = deps;

	const dt = Math.min(0.05, deltaSeconds);
	const now = performance.now();
	// Y7 — advance the yuka EntityManager once per frame. Today no
	// entities are registered (the FSM still drives behavior via the
	// existing loop below); the tick is wired so Y1-Y6 follow-ups
	// have a working scheduler the moment they register entities.
	tickYuka(dt);

	const px = camera.position.x;
	const py = camera.position.z;

	// Y3 — derive player XZ velocity from prev-frame position. Smooth
	// against a tiny floor so a stationary player gives the bouncer a
	// zero-lead (i.e. it just Seeks the current position).
	if (prevPlayerPosRef.current && dt > 1e-6) {
		playerVelocityRef.current = {
			x: (px - prevPlayerPosRef.current.x) / dt,
			y: (py - prevPlayerPosRef.current.y) / dt,
		};
	}
	prevPlayerPosRef.current = { x: px, y: py };

	// H8 — phase-aware win condition.
	//   phase === "out":         crossing the goal portal flips to "going_back".
	//   phase === "going_back":  reaching the original playerSpawn clears.
	const currentPhase = phaseRef.current;
	if (currentPhase === "out") {
		const dxExit = px - map.exitPosition.x;
		const dyExit = py - map.exitPosition.y;
		// E2 — portal stays locked until every boss enemy is dead, even
		// if the key has been collected. Sync the reactive flag on the
		// same tick so the visual portal/door reflects the gate state.
		const allBossesDeadNow = enemiesRef.current.every((e) => e.tier !== "boss" || e.dead);
		if (allBossesDeadNow !== allBossesDead) setAllBossesDead(allBossesDeadNow);
		if (hasKey && allBossesDeadNow && dxExit * dxExit + dyExit * dyExit < TILE * TILE * 0.4) {
			if (!lastWonAtRef.current) {
				lastWonAtRef.current = true;
				gameRef.current.onWin();
				playPortal();
			}
		}
	} else {
		const dxSpawn = px - map.playerSpawn.x;
		const dySpawn = py - map.playerSpawn.y;
		if (dxSpawn * dxSpawn + dySpawn * dySpawn < TILE * TILE * 0.4) {
			if (!lastReachedSpawnAtRef.current) {
				lastReachedSpawnAtRef.current = true;
				gameRef.current.onReachSpawn();
				playPortal();
			}
		}
	}

	// H8 — light strobe during going_back. 200-frame cycle, 10 frames bright.
	// POL27 — strobe levels respect per-archetype darkness multipliers
	// so a dark-sewer going_back still flickers proportionally to the
	// archetype's lighting baseline rather than blasting bright.
	if (currentPhase === "going_back") {
		strobeFrameRef.current = (strobeFrameRef.current + 1) % 200;
		const bright = strobeFrameRef.current < 10;
		if (ambientLightRef.current) {
			ambientLightRef.current.intensity = (bright ? 1.4 : 0.2) * lightPalette.ambientMul;
		}
		if (directionalLightRef.current) {
			directionalLightRef.current.intensity = (bright ? 2.0 : 0.35) * lightPalette.directionalMul;
		}
	}

	// H5 — Lava damage. Grid maps: cell type "lava". Sector maps: any
	// polygon whose floorHeight is negative (matches reference's pallet
	// trigger). Cadence: 600 ms, 8 HP per tick.
	let standingOnLava = false;
	if (map.kind === "grid") {
		const playerCell = {
			gx: Math.floor(px / TILE),
			gy: Math.floor(py / TILE),
		};
		const standingCell = map.cells[playerCell.gy]?.[playerCell.gx] ?? "wall";
		standingOnLava = standingCell === "lava";
	} else {
		// Sector map: floorHeight < 0 == lava (renderer's heuristic).
		for (const sector of map.sectors) {
			if (sector.floorHeight >= 0) continue;
			if (polygonContains({ x: px, y: py + 1e-6 }, sector.vertices)) {
				standingOnLava = true;
				break;
			}
		}
	}
	if (standingOnLava && now - lastLavaTickAtRef.current > 600) {
		lastLavaTickAtRef.current = now;
		gameRef.current.onHit(8);
		playHurt();
	}

	// COV8 step-2 — trap tick damage + lever-disarm-sector.
	// First check for trigger overlap (disarms the whole sector).
	const trigger = triggerAt(trapsRef.current, { x: px, y: py }, TRIGGER_OVERLAP_RADIUS);
	if (trigger) {
		trigger.disarmed = true;
		const count = disarmSector(trapsRef.current, trigger.sectorId);
		if (count > 1) playPickup();
		// PT1 — bump the version so TrapField re-memos the visible
		// filter and the disarmed hazards drop from the instanced
		// buffer this render cycle (not on whatever next ambient
		// render happens to fire).
		bumpTrapsDisarmedVersion();
	}
	// Then check for hazard overlap (per-trap ticked damage).
	const hazard = trapAt(trapsRef.current, { x: px, y: py }, TRAP_OVERLAP_RADIUS);
	if (hazard) {
		const lastTick = lastTrapTickAtRef.current.get(hazard.id) ?? 0;
		if (now - lastTick > TRAP_TICK_COOLDOWN_MS) {
			lastTrapTickAtRef.current.set(hazard.id, now);
			const kind = hazard.def.kind;
			const damage =
				kind === "spike" || kind === "blade" || kind === "rolling" ? TRAP_TICK_DAMAGE[kind] : 0;
			if (damage > 0) {
				gameRef.current.onHit(damage);
				playHurt();
			}
		}
	}

	// Pickup collection
	for (const pickup of pickupsRef.current) {
		if (pickup.collected) continue;
		const dx = px - pickup.position.x;
		const dy = py - pickup.position.y;
		if (dx * dx + dy * dy < 1.4 * 1.4) {
			pickup.collected = true;
			const mesh = pickupMeshesRef.current.get(pickup.id);
			if (mesh) mesh.visible = false;
			gameRef.current.onCollectPickup(pickup.kind);
			playPickup();
			dispatch({
				type: "burst",
				x: pickup.position.x,
				y: pickup.position.y,
				kind: "pickup",
			});
		}
	}

	// ARCH2a — per-frame enemy AI loop lives in src/scene/tick/enemyTickLoop.ts.
	// Behavior is byte-identical; this call site is a pure relocation.
	tickEnemyLoop({
		enemiesRef,
		yukaEntitiesRef,
		bulletsRef,
		nextBulletIdRef,
		enemyMeshesRef,
		lastSeenRef,
		aggroFiredRef,
		bossSpottedFiredRef,
		collisionCtxRef,
		gameRef,
		map,
		camera,
		settings,
		playerVelocity: playerVelocityRef.current,
		playerX: px,
		playerY: py,
		now,
		dt,
		timeScaleBus: timeScaleBusRef.current,
		crucifixesRef,
	});

	// Bullet integration — advance, check wall/player, retire dead bullets.
	const bullets = bulletsRef.current;
	const playerPos = { x: px, y: py };
	let writeIdx = 0;
	for (let i = 0; i < bullets.length; i += 1) {
		const bullet = bullets[i];
		// bullet is provably defined: i < bullets.length.
		if (bullet === undefined) continue;
		const step = stepEnemyBullet(bullet, dt, now, playerPos, map, collisionCtxRef.current);
		if (step.kind === "hitPlayer") {
			gameRef.current.onHit(ENEMY_BULLET_DAMAGE);
			playHurt();
			const bm = bulletMeshesRef.current.get(bullet.id);
			if (bm) bm.visible = false;
			continue;
		}
		if (step.kind === "hitWall" || step.kind === "expired") {
			const bm = bulletMeshesRef.current.get(bullet.id);
			if (bm) bm.visible = false;
			continue;
		}
		bullets[writeIdx++] = bullet;
	}
	bullets.length = writeIdx;
}
