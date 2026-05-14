/**
 * ARCH2b — single-shot fire resolution, extracted from ObjexoomScene's
 * `objexoom:fire` event handler. Pure function over a context object
 * for the same reasons as ARCH2a's `tickEnemyLoop` (see that module).
 *
 * Behavior is byte-identical to the prior inline `onFire` body —
 * every read, write, event dispatch, and sfx call lands in the same
 * order. Closure captures become explicit parameters.
 *
 * Side effects (all preserved):
 *   - Spends ammo via gameRef.current.onSpendAmmo.
 *   - Sets muzzleFlashUntil + muzzleColorRef for the per-frame light decay.
 *   - Emits one `objexoom:shellEject` per chaingun/shotgun pull.
 *   - Per pellet: cast ray, find nearest enemy in cone, prefer barrel
 *     if closer; on barrel hit → damage + burst → explode if HP<=0.
 *     On enemy hit → damage + burst → on death: mesh.visible=false,
 *     imp-explode burst, body-parts spawn, kill counter increment.
 *   - On any kill this shot: gameRef.current.onKill x N, death sfx,
 *     subtle boom if sound enabled.
 *   - Returns nothing; mutates refs and the wider event bus.
 */

import * as THREE from "three";
import { type Barrel, pickRayBarrel } from "../../barrels";
import { TILE } from "../../constants";
import type { CollisionContext } from "../../engine";
import { castRayAny, type Enemy, type ObjexoomMap } from "../../engine";
import { dispatch } from "../../events";
import type { GameRef, WeaponState } from "../../ObjexoomShell";
import type { ObjexoomSettings } from "../../settings";
import {
	playBoom,
	playChaingun,
	playMelee,
	playPistol,
	playShotgun,
	playSkeletonDeath,
} from "../../sfx";
import { WEAPONS, type WeaponId } from "../../weapons";

export interface FireResolutionContext {
	active: boolean;
	weapon: WeaponId;
	now: number;
	camera: THREE.Camera;
	map: ObjexoomMap;
	settings: ObjexoomSettings;
	ammoRef: { current: WeaponState };
	gameRef: { current: GameRef };
	enemiesRef: { current: Enemy[] };
	barrelsRef: { current: Barrel[] };
	enemyMeshesRef: { current: Map<number, THREE.Group> };
	collisionCtxRef: { current: CollisionContext };
	lastFireAtRef: { current: number };
	muzzleFlashUntilRef: { current: number };
	muzzleColorRef: { current: THREE.Color };
	explodeBarrel: (barrel: Barrel) => void;
}

export function resolveFire(ctx: FireResolutionContext): void {
	const {
		active,
		weapon,
		now,
		camera,
		map,
		settings,
		ammoRef,
		gameRef,
		enemiesRef,
		barrelsRef,
		enemyMeshesRef,
		collisionCtxRef,
		lastFireAtRef,
		muzzleFlashUntilRef,
		muzzleColorRef,
		explodeBarrel,
	} = ctx;

	if (!active) return;
	const spec = WEAPONS[weapon];
	if (now - lastFireAtRef.current < spec.cooldownMs) return;

	if (spec.ammoCostPerShot > 0) {
		const remaining = ammoRef.current.ammo[weapon];
		if (remaining < spec.ammoCostPerShot) return;
	}

	lastFireAtRef.current = now;
	gameRef.current.onSpendAmmo(weapon, spec.ammoCostPerShot);

	// I11 — muzzle-flash light. 80 ms of weapon-colored bloom. The light
	// decays in the per-frame block and tracks the muzzle anchor (PA-MOD7).
	muzzleFlashUntilRef.current = now + 80;
	muzzleColorRef.current.set(spec.muzzleColor);

	if (weapon === "melee") playMelee();
	else if (weapon === "pistol") playPistol();
	else if (weapon === "chaingun") playChaingun();
	else playShotgun();

	// I10 / PA9b — shell ejection.
	if (weapon === "shotgun" || weapon === "chaingun") {
		const isChaingun = weapon === "chaingun";
		const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
		const lateral = isChaingun ? 1.0 : 1.6;
		const upward = isChaingun ? 0.9 : 1.2;
		const scale = isChaingun ? 0.6 : 1.0;
		dispatch({
			type: "shellEject",
			x: camera.position.x + right.x * 0.3,
			y: camera.position.y - 0.3,
			z: camera.position.z + right.z * 0.3,
			vx: right.x * lateral + (Math.random() - 0.5) * 0.4,
			vy: upward,
			vz: right.z * lateral + (Math.random() - 0.5) * 0.4,
			scale,
		});
	}

	const forwardBase = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
	const origin = { x: camera.position.x, y: camera.position.z };

	let killsThisShot = 0;
	for (let pelletIdx = 0; pelletIdx < spec.pellets; pelletIdx += 1) {
		const spreadX = (Math.random() - 0.5) * spec.spreadRad;
		const spreadY = (Math.random() - 0.5) * spec.spreadRad;
		const forward = forwardBase
			.clone()
			.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadX)
			.applyAxisAngle(new THREE.Vector3(1, 0, 0), spreadY);
		const dir2 = { x: forward.x, y: forward.z };
		const len2 = Math.hypot(dir2.x, dir2.y) || 1;
		dir2.x /= len2;
		dir2.y /= len2;

		const maxDist = spec.rangeTiles * TILE;
		const wallHit = castRayAny(origin, dir2, map, collisionCtxRef.current, maxDist);
		let bestEnemy: Enemy | null = null;
		let bestDist = wallHit.dist;
		for (const enemy of enemiesRef.current) {
			if (enemy.dead) continue;
			const ex = enemy.position.x - origin.x;
			const ey = enemy.position.y - origin.y;
			const t = ex * dir2.x + ey * dir2.y;
			if (t <= 0 || t > bestDist) continue;
			const perpX = ex - dir2.x * t;
			const perpY = ey - dir2.y * t;
			const perp = Math.hypot(perpX, perpY);
			if (perp > 1.0) continue;
			bestEnemy = enemy;
			bestDist = t;
		}
		// E5 — barrel hit-test wins ties over enemies.
		const barrelHit = pickRayBarrel(origin, dir2, barrelsRef.current, bestDist);
		if (barrelHit && barrelHit.dist <= bestDist) {
			barrelHit.barrel.hp -= spec.damage;
			dispatch({
				type: "burst",
				x: barrelHit.barrel.position.x,
				y: barrelHit.barrel.position.y,
				kind: "damage",
			});
			if (barrelHit.barrel.hp <= 0 && !barrelHit.barrel.exploded) {
				explodeBarrel(barrelHit.barrel);
			}
			continue;
		}
		if (bestEnemy) {
			bestEnemy.hp -= spec.damage;
			dispatch({
				type: "burst",
				x: bestEnemy.position.x,
				y: bestEnemy.position.y,
				kind: "damage",
			});
			if (bestEnemy.hp <= 0) {
				bestEnemy.dead = true;
				killsThisShot += 1;
				const mesh = enemyMeshesRef.current.get(bestEnemy.id);
				if (mesh) mesh.visible = false;
				if (bestEnemy.kind === "imp") {
					dispatch({
						type: "burst",
						x: bestEnemy.position.x,
						y: bestEnemy.position.y,
						kind: "explode",
					});
				}
				// I1 — body-part physics on death.
				dispatch({
					type: "bodyParts",
					x: bestEnemy.position.x,
					y: bestEnemy.position.y,
					kind: bestEnemy.kind,
				});
			}
		}
	}

	if (killsThisShot > 0) {
		for (let i = 0; i < killsThisShot; i += 1) gameRef.current.onKill();
		playSkeletonDeath();
		if (settings.soundEnabled) playBoom();
	}
}
