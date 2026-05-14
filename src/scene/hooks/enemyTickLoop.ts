/**
 * ARCH2a — per-frame enemy AI tick, extracted from ObjexoomScene's
 * useFrame. Pure function over a context object so the call site in
 * the Scene remains a one-liner inside useFrame and the logic lives
 * in a focused, individually-testable module.
 *
 * Behavior is byte-identical to the prior inline block — every read
 * and write is preserved, every event channel still emits in the
 * same order. The only structural change is that the closure captures
 * are now explicit parameters.
 *
 * Inputs (`EnemyTickContext`):
 *   enemiesRef           — mutable enemy roster
 *   yukaEntitiesRef      — per-enemy yuka.GameEntity mirrors (Y1)
 *   bulletsRef           — enemy-bullet pool (C2/C3)
 *   nextBulletIdRef      — bullet id counter
 *   enemyMeshesRef       — Map<id, THREE.Group> for per-frame mesh sync
 *   lastSeenRef          — per-enemy "last had LOS at" timestamps
 *   aggroFiredRef        — Set<id> of enemies that already played alert
 *   collisionCtxRef      — collision helper context (built per Scene)
 *   gameRef              — Shell callbacks (onHit/onKill/...)
 *   map                  — current ObjexoomMap (sector or grid)
 *   camera               — three.js camera (for yaw on aggro pan)
 *   settings             — full ObjexoomSettings (for soundEnabled)
 *   playerVelocity       — XZ-frame player velocity (Y3)
 *   playerX / playerY    — camera.position.{x,z}
 *   now                  — performance.now() at the top of the tick
 *   dt                   — clamped delta seconds for the tick
 */

import type * as THREE from "three";
import type * as Yuka from "yuka";
import {
	SKELETON_ATTACK_COOLDOWN_MS,
	SKELETON_ATTACK_RANGE,
	SKELETON_DAMAGE,
} from "../../constants";
import { tickEnemyFsm } from "../../enemyAi";
import {
	type CollisionContext,
	type Enemy,
	type EnemyBullet,
	hasLineOfSightAny,
	makeEnemyBullet,
	type ObjexoomMap,
	resolveCollisionAny,
} from "../../engine";
import type { GameRef } from "../../ObjexoomShell";
import type { ObjexoomSettings } from "../../settings";
import { panForPosition, playAggroAlert, playHurt } from "../../sfx";
import { removeYukaEntity } from "../../yukaIntegration";

// CollisionContext is a private export of engine.ts; if not exported, we
// fall back to the structural type the helpers consume. The Scene
// already constructs and stores it as a ref so we just take it as-is.
type CollisionCtxRef = { current: CollisionContext };

export interface EnemyTickContext {
	enemiesRef: { current: Enemy[] };
	yukaEntitiesRef: { current: Map<number, Yuka.GameEntity> };
	bulletsRef: { current: EnemyBullet[] };
	nextBulletIdRef: { current: number };
	enemyMeshesRef: { current: Map<number, THREE.Group> };
	lastSeenRef: { current: Map<number, number> };
	aggroFiredRef: { current: Set<number> };
	collisionCtxRef: CollisionCtxRef;
	gameRef: { current: GameRef };
	map: ObjexoomMap;
	camera: THREE.Camera;
	settings: ObjexoomSettings;
	playerVelocity: { x: number; y: number };
	playerX: number;
	playerY: number;
	now: number;
	dt: number;
	/**
	 * POL12 — hitstop on enemy kills. When `now < hitstopUntil`, the
	 * effective dt for enemy AI/movement is scaled by HITSTOP_FACTOR
	 * (near-zero) so enemies appear to "freeze" for the duration —
	 * reads as a "weighty kill" punch from modernized DOOM. The player
	 * camera + bullet ticks + particle ticks are NOT affected; only
	 * this loop reads the ref. Optional so test contexts that don't
	 * care about hitstop can pass `undefined` (treated as never-active).
	 */
	hitstopUntilRef?: { current: number };
}

export function tickEnemyLoop(ctx: EnemyTickContext): void {
	const {
		enemiesRef,
		yukaEntitiesRef,
		bulletsRef,
		nextBulletIdRef,
		enemyMeshesRef,
		lastSeenRef,
		aggroFiredRef,
		collisionCtxRef,
		gameRef,
		map,
		camera,
		settings,
		playerVelocity,
		playerX: px,
		playerY: py,
		now,
		dt: rawDt,
		hitstopUntilRef,
	} = ctx;

	// POL12 — hitstop. While the kill-punch window is open, scale enemy
	// AI dt to 0.05 (5%) so enemies appear nearly frozen. 0 would cause
	// divide-by-zero in places that normalize velocity by dt; 5% gives
	// near-instant frame-coherence + a perceptual "frozen" read.
	const HITSTOP_FACTOR = 0.05;
	const hitstopActive = hitstopUntilRef !== undefined && now < hitstopUntilRef.current;
	const dt = hitstopActive ? rawDt * HITSTOP_FACTOR : rawDt;

	// Enemy AI — FSM driven (state 0=patrol, 1=chase, 3=shoot). Skeletons
	// also melee on contact via the legacy attack-range/cooldown path.
	const allEnemies = enemiesRef.current;
	// O(1) help-FSM lookup map — rebuild once per tick, then mutate by id.
	// Replaces the prior `allEnemies.find(e => e.id === helpId)` inner loop
	// which was O(N²) per tick across the get-help fan-out.
	const enemyById = new Map<number, (typeof allEnemies)[number]>();
	for (const e of allEnemies) enemyById.set(e.id, e);
	for (const enemy of allEnemies) {
		if (enemy.dead) {
			// Drop dead enemies from the yuka manager — this was unreachable
			// before the early-continue refactor because the cleanup block
			// at the bottom sat after the continue.
			const yukaEntity = yukaEntitiesRef.current.get(enemy.id);
			if (yukaEntity) {
				removeYukaEntity(yukaEntity);
				yukaEntitiesRef.current.delete(enemy.id);
			}
			continue;
		}
		const dxp = px - enemy.position.x;
		const dyp = py - enemy.position.y;
		const distToPlayer = Math.hypot(dxp, dyp);
		if (distToPlayer === 0) continue;

		const wraith = enemy.kind === "wraith";
		const lastSeen = lastSeenRef.current.get(enemy.id) ?? -Infinity;
		const prevState = enemy.fsmState;
		const out = tickEnemyFsm({
			enemy,
			player: { x: px, y: py },
			map,
			ctx: collisionCtxRef.current,
			now,
			dt,
			allEnemies,
			lastSeenAt: lastSeen,
			playerVelocity,
		});
		enemy.fsmState = out.nextState;
		// I7 — first-time patrol → chase transition fires a panned aggro
		// growl. The Set is per-Scene-instance; remounting on level change
		// resets it implicitly.
		if (prevState === 0 && out.nextState === 1 && !aggroFiredRef.current.has(enemy.id)) {
			aggroFiredRef.current.add(enemy.id);
			if (settings.soundEnabled) {
				const pan = panForPosition(enemy.position, {
					x: px,
					y: py,
					yaw: camera.rotation.y,
				});
				playAggroAlert(pan);
			}
		}
		lastSeenRef.current.set(enemy.id, out.lastSeenAt);
		for (const helpId of out.gethelpFromIds) {
			const helped = enemyById.get(helpId);
			if (helped && !helped.dead) helped.fsmState = 1;
		}

		if (out.moveTarget) {
			// POL19 — stagger scaling. If the enemy was hit recently and is
			// still inside the stagger window, scale the move delta down so
			// the enemy "absorbs the hit" before resuming advance.
			let moveTarget = out.moveTarget;
			if (enemy.staggerUntil !== undefined && now < enemy.staggerUntil) {
				const STAGGER_SPEED_FACTOR = 0.2;
				moveTarget = {
					x: enemy.position.x + (moveTarget.x - enemy.position.x) * STAGGER_SPEED_FACTOR,
					y: enemy.position.y + (moveTarget.y - enemy.position.y) * STAGGER_SPEED_FACTOR,
				};
			}
			enemy.position = wraith
				? moveTarget
				: resolveCollisionAny(moveTarget, map, collisionCtxRef.current, 0.5);
		}

		if (out.fireBullet) {
			bulletsRef.current.push(
				makeEnemyBullet(nextBulletIdRef.current++, enemy.id, enemy.position, { x: px, y: py }, now),
			);
			enemy.lastShotAt = now;
		}

		// Skeleton melee — short-range contact damage (legacy path; skeletons
		// don't shoot, so they need a close-quarters threat). Imps and wraiths
		// rely on ranged.
		if (
			enemy.kind === "skeleton" &&
			distToPlayer < SKELETON_ATTACK_RANGE &&
			now - enemy.lastAttackAt > SKELETON_ATTACK_COOLDOWN_MS
		) {
			const sees = hasLineOfSightAny(
				enemy.position,
				{ x: px, y: py },
				map,
				collisionCtxRef.current,
			);
			if (sees) {
				enemy.lastAttackAt = now;
				gameRef.current.onHit(SKELETON_DAMAGE);
				playHurt();
			}
		}

		const mesh = enemyMeshesRef.current.get(enemy.id);
		if (mesh) {
			mesh.position.x = enemy.position.x;
			mesh.position.z = enemy.position.y;
			mesh.position.y = wraith
				? 1.4 + Math.sin(now * 0.003 + enemy.id) * 0.25
				: 0.8 + Math.sin(now * 0.003 + enemy.id) * 0.06;
			mesh.lookAt(px, mesh.position.y, py);
		}

		// Y1 — mirror the FSM-computed enemy position into its yuka
		// GameEntity so EntityManager.update sees real coordinates each
		// frame. Dead-enemy cleanup is handled at the top of the loop.
		const yukaEntity = yukaEntitiesRef.current.get(enemy.id);
		if (yukaEntity) yukaEntity.position.set(enemy.position.x, 0, enemy.position.y);
	}
}
