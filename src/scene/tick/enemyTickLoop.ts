/**
 * ARCH2a — per-frame enemy AI tick, extracted from BoneBusterScene's
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
 *   map                  — current BoneBusterMap (sector or grid)
 *   camera               — three.js camera (for yaw on aggro pan)
 *   settings             — full BoneBusterSettings (for soundEnabled)
 *   playerVelocity       — XZ-frame player velocity (Y3)
 *   playerX / playerY    — camera.position.{x,z}
 *   now                  — performance.now() at the top of the tick
 *   dt                   — clamped delta seconds for the tick
 */

import { tickEnemyFsm } from "@ai/enemyAi";
import { removeYukaEntity } from "@ai/yukaIntegration";
import { panForPosition, playAggroAlert, playHurt } from "@audio/sfx";
import {
	type BoneBusterMap,
	type CollisionContext,
	type Enemy,
	hasLineOfSightAny,
	resolveCollisionAny,
} from "@engine/engine";
import { dispatch } from "@engine/events";
import { type EnemyBullet, makeEnemyBullet } from "@engine/projectiles";
import {
	RATTLER_ATTACK_COOLDOWN_MS,
	RATTLER_ATTACK_RANGE,
	RATTLER_DAMAGE,
} from "@shared/constants";
import type { BoneBusterSettings } from "@store/settings";
import type { GameRef } from "@views/Shell";
import { type CrucifixInstance, isEnemyCrucified } from "@world/ghostHunting";
import type * as THREE from "three";
import type * as Yuka from "yuka";

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
	/**
	 * POL36 — set of enemy ids that have triggered the boss-spotted
	 * banner already. Per-Scene-instance (resets on level remount via
	 * the same lifecycle as aggroFiredRef). Optional so legacy test
	 * contexts that don't care about the banner can omit it.
	 */
	bossSpottedFiredRef?: { current: Set<number> };
	collisionCtxRef: CollisionCtxRef;
	gameRef: { current: GameRef };
	map: BoneBusterMap;
	camera: THREE.Camera;
	settings: BoneBusterSettings;
	playerVelocity: { x: number; y: number };
	playerX: number;
	playerY: number;
	now: number;
	dt: number;
	/**
	 * POL35 — time-scale bus. The loop applies the combined scale (min
	 * over live reservations) to `dt`. POL12 hitstop and POL22 key
	 * acquire both reserve on this bus; the loop sees only the combined
	 * result. Optional so test contexts that don't care about time
	 * scaling can pass `undefined` (treated as scale = 1).
	 */
	timeScaleBus?: { getCombinedScale(nowMs: number): number };
	/**
	 * PC4 — active crucifix placements. When an enemy is within the
	 * radius of any active crucifix, the FSM tick + bullet fire + melee
	 * are short-circuited so the enemy stands passive until the crucifix
	 * expires. Optional so legacy test contexts can omit it.
	 */
	crucifixesRef?: { current: readonly CrucifixInstance[] };
}

export function tickEnemyLoop(ctx: EnemyTickContext): void {
	const {
		enemiesRef,
		yukaEntitiesRef,
		bulletsRef,
		nextBulletIdRef,
		lastSeenRef,
		aggroFiredRef,
		bossSpottedFiredRef,
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
		timeScaleBus,
		crucifixesRef,
	} = ctx;

	// POL35 — combined time scale. The bus combines POL12 hitstop (0.05
	// during a kill window) and POL22 key-acquire (0.55 during the brief
	// world-pause on key pickup) via min, so the most-pinched reservation
	// always wins. Floor at 0.05 to avoid divide-by-zero in math that
	// normalizes by dt — matches the pre-POL35 HITSTOP_FACTOR.
	const combinedScale = timeScaleBus ? timeScaleBus.getCombinedScale(now) : 1;
	const dt = rawDt * Math.max(combinedScale, 0.05);

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

		// PC4 — crucifix gate. If the enemy stands within any active
		// crucifix's radius, skip the entire AI tick: no FSM transition,
		// no movement target, no bullet fire, no melee. The enemy is held
		// in its current pose until the crucifix expires (Scene prunes
		// expired entries before this tick runs).
		if (
			crucifixesRef !== undefined &&
			isEnemyCrucified(crucifixesRef.current, enemy.position.x, enemy.position.y, now)
		) {
			const yukaEntity = yukaEntitiesRef.current.get(enemy.id);
			if (yukaEntity) yukaEntity.position.set(enemy.position.x, 0, enemy.position.y);
			continue;
		}

		const phaser = enemy.kind === "phaser";
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
			// POL36 — boss-tier first-time aggro fires a "BOSS APPROACHES"
			// banner via the bossSpotted event. Gated on bossSpottedFiredRef
			// so the banner shows AT MOST once per boss enemy per map.
			if (
				enemy.tier === "boss" &&
				bossSpottedFiredRef !== undefined &&
				!bossSpottedFiredRef.current.has(enemy.id)
			) {
				bossSpottedFiredRef.current.add(enemy.id);
				dispatch({ type: "bossSpotted", enemyId: enemy.id });
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
			enemy.position = phaser
				? moveTarget
				: resolveCollisionAny(moveTarget, map, collisionCtxRef.current, 0.5);
		}

		if (out.fireBullet) {
			bulletsRef.current.push(
				makeEnemyBullet(nextBulletIdRef.current++, enemy.id, enemy.position, { x: px, y: py }, now),
			);
			enemy.lastShotAt = now;
		}

		// Rattler melee — short-range contact damage (legacy path; skeletons
		// don't shoot, so they need a close-quarters threat). Imps and wraiths
		// rely on ranged.
		if (
			enemy.kind === "rattler" &&
			distToPlayer < RATTLER_ATTACK_RANGE &&
			now - enemy.lastAttackAt > RATTLER_ATTACK_COOLDOWN_MS
		) {
			const sees = hasLineOfSightAny(
				enemy.position,
				{ x: px, y: py },
				map,
				collisionCtxRef.current,
			);
			if (sees) {
				enemy.lastAttackAt = now;
				gameRef.current.onHit(RATTLER_DAMAGE);
				playHurt();
			}
		}

		// QW5 — mesh.position/lookAt writes deleted here. EnemyMesh.tsx
		// owns visual position+yaw (see scene/entities/EnemyMesh.tsx:98-116
		// — sets group.position from enemy.position and computes
		// rotation.y from delta-direction-of-motion). The pre-QW5 path
		// here additionally wrote position + a horizontal billboard
		// `lookAt(player)` which fought EnemyMesh's character-facing yaw
		// at the same useFrame priority and doubled the per-enemy matrix
		// recompute cost. The sim now only mutates `enemy.position`; the
		// visual layer is the sole position consumer.

		// Y1 — mirror the FSM-computed enemy position into its yuka
		// GameEntity so EntityManager.update sees real coordinates each
		// frame. Dead-enemy cleanup is handled at the top of the loop.
		const yukaEntity = yukaEntitiesRef.current.get(enemy.id);
		if (yukaEntity) yukaEntity.position.set(enemy.position.x, 0, enemy.position.y);
	}
}
