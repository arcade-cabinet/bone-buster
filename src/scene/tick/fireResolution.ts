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

import {
	playBoom,
	playBossDeath,
	playChaingun,
	playFlamethrower,
	playMelee,
	playPistol,
	playShotgun,
	playSkeletonDeath,
} from "@audio/sfx";
import type { CollisionContext } from "@engine/engine";
import { castRayAny, type Enemy, type ObjexoomMap } from "@engine/engine";
import { dispatch } from "@engine/events";
import { TILE } from "@shared/constants";
import { WEAPONS, type WeaponId } from "@shared/weapons";
import { type Barrel, pickRayBarrel } from "@world/barrels";
import { pickRaySwitch, type Secret } from "@world/secrets";
import * as THREE from "three";
import type { GameRef, WeaponState } from "../../ObjexoomShell";
import type { ObjexoomSettings } from "../../settings";

// QW1 — module-scope scratch vectors. Reused across every shot to
// skip per-pellet allocations (shotgun = 7 allocs/shot pre-QW1). The
// _xAxis / _yAxis bases are pre-set to canonical unit vectors and
// never mutated; _right / _forwardBase / _forwardPellet are reused
// per-call with `.set(...)` + in-place transforms.
const _xAxis = /*@__PURE__*/ new THREE.Vector3(1, 0, 0);
const _yAxis = /*@__PURE__*/ new THREE.Vector3(0, 1, 0);
const _right = /*@__PURE__*/ new THREE.Vector3();
const _forwardBase = /*@__PURE__*/ new THREE.Vector3();
const _forwardPellet = /*@__PURE__*/ new THREE.Vector3();

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
	// E6 — optional. When undefined, the secret hit-test branch is skipped.
	secretsRef?: { current: Secret[] };
	enemyMeshesRef: { current: Map<number, THREE.Group> };
	collisionCtxRef: { current: CollisionContext };
	lastFireAtRef: { current: number };
	muzzleFlashUntilRef: { current: number };
	muzzleColorRef: { current: THREE.Color };
	/** POL13 — muzzle-flash bloom tier per weapon (0=melee, 0.6=pistol, 0.9=chaingun, 1.4=shotgun, 1.1=flamethrower). */
	muzzleIntensityScaleRef: { current: number };
	/**
	 * POL35 — time-scale bus. resolveFire reserves "hitstop" on any
	 * enemy kill this shot; the enemy tick loop reads the combined
	 * scale (POL12 hitstop + POL22 key-acquire min'd together) and
	 * applies it to its dt.
	 */
	timeScaleBus: {
		reserve(id: "hitstop" | "key-acquire", scale: number, untilMs: number): void;
	};
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
		secretsRef,
		enemyMeshesRef,
		collisionCtxRef,
		lastFireAtRef,
		muzzleFlashUntilRef,
		muzzleColorRef,
		muzzleIntensityScaleRef,
		timeScaleBus,
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
	// POL13 — per-weapon bloom tier. Drives the muzzleLight intensity
	// multiplier in ObjexoomScene's per-frame decay block. Defaults to
	// 1.0 if the weapon spec doesn't declare one (back-compat).
	muzzleIntensityScaleRef.current = spec.muzzleIntensity ?? 1.0;

	if (weapon === "melee") playMelee();
	else if (weapon === "pistol") playPistol();
	else if (weapon === "chaingun") playChaingun();
	else if (weapon === "flamethrower") playFlamethrower();
	else playShotgun();

	// I10 / PA9b — shell ejection.
	if (weapon === "shotgun" || weapon === "chaingun") {
		const isChaingun = weapon === "chaingun";
		// QW1 — reuse module-scope _right; set to canonical X then rotate.
		_right.set(1, 0, 0).applyQuaternion(camera.quaternion);
		const lateral = isChaingun ? 1.0 : 1.6;
		const upward = isChaingun ? 0.9 : 1.2;
		const scale = isChaingun ? 0.6 : 1.0;
		dispatch({
			type: "shellEject",
			x: camera.position.x + _right.x * 0.3,
			y: camera.position.y - 0.3,
			z: camera.position.z + _right.z * 0.3,
			vx: _right.x * lateral + (Math.random() - 0.5) * 0.4,
			vy: upward,
			vz: _right.z * lateral + (Math.random() - 0.5) * 0.4,
			scale,
		});
	}

	// QW1 — reuse module-scope _forwardBase; set to camera-forward then normalize.
	const forwardBase = _forwardBase.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
	const origin = { x: camera.position.x, y: camera.position.z };

	// E8 step-2 — flamethrower emits a distinct directional cone stream
	// once per trigger pull (not per pellet — the layered particle
	// effect in ParticleBurstField already spreads with its own spread
	// cone). Position is ~1 tile forward of the muzzle so the spawn
	// origin reads as "out of the barrel" rather than "around the
	// camera"; direction is the forward unit vector in the XZ plane.
	if (weapon === "flamethrower") {
		const muzzleOffset = 0.6;
		dispatch({
			type: "burst",
			kind: "flameStream",
			x: origin.x + forwardBase.x * muzzleOffset,
			y: origin.y + forwardBase.z * muzzleOffset,
			dirX: forwardBase.x,
			dirY: forwardBase.z,
		});
	}

	let killsThisShot = 0;
	let bossKillsThisShot = 0;
	for (let pelletIdx = 0; pelletIdx < spec.pellets; pelletIdx += 1) {
		const spreadX = (Math.random() - 0.5) * spec.spreadRad;
		const spreadY = (Math.random() - 0.5) * spec.spreadRad;
		// QW1 — reuse module-scope _forwardPellet; copy forwardBase then
		// apply spread in place. Avoids 1 Vector3 clone + 2 unit-vector
		// allocs per pellet (shotgun = 7 pellets/shot pre-QW1).
		const forward = _forwardPellet
			.copy(forwardBase)
			.applyAxisAngle(_yAxis, spreadX)
			.applyAxisAngle(_xAxis, spreadY);
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
		// E6 — secret-switch hit-test wins over barrels + enemies. The
		// switch is an explicit aim target on a wall; if the ray hits
		// one before any other entity, the switch flips and the pellet
		// is consumed (no damage propagated past). A triggered switch
		// is inert (pickRaySwitch already filters those out).
		if (secretsRef) {
			const switchHit = pickRaySwitch(origin, dir2, secretsRef.current, bestDist);
			if (switchHit) {
				switchHit.secret.triggered = true;
				dispatch({
					type: "secretTriggered",
					id: switchHit.secret.id,
					x: switchHit.secret.spec.switchPosition.x,
					y: switchHit.secret.spec.switchPosition.y,
				});
				// Pellet consumed — skip the barrel + enemy branches.
				continue;
			}
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
			// POL19 — non-killing-hit stagger window. Only set when the
			// hit doesn't kill (the kill path uses POL12 hitstop + body-
			// parts spawn instead — a dead enemy doesn't flinch). Bosses
			// stagger 100ms (heavier "feel" but less so than the kill);
			// regular enemies 70ms — both inside any weapon cooldown so
			// the stagger never blocks the next shot.
			if (bestEnemy.hp > 0) {
				const staggerMs = bestEnemy.tier === "boss" ? 100 : 70;
				bestEnemy.staggerUntil = now + staggerMs;
			}
			dispatch({
				type: "burst",
				x: bestEnemy.position.x,
				y: bestEnemy.position.y,
				kind: "damage",
			});
			// POL11-v2 — floating damage number. Consumed by
			// DamageNumberField. `enemyId` enables crit-stack
			// consolidation so 8 shotgun pellets on one enemy read
			// as a single growing total, not 8 stacked labels.
			dispatch({
				type: "damageNumber",
				x: bestEnemy.position.x,
				y: bestEnemy.position.y,
				amount: spec.damage,
				killed: bestEnemy.hp <= 0,
				enemyId: bestEnemy.id,
			});
			if (bestEnemy.hp <= 0) {
				bestEnemy.dead = true;
				killsThisShot += 1;
				// POL10 — track boss kills in this shot so we can layer the
				// boss-down sting on top of the standard skeleton-death cue.
				if (bestEnemy.tier === "boss") {
					bossKillsThisShot += 1;
					// POL36 — boss-defeated banner. Per-enemy dispatch (not
					// shot-level) so multi-boss maps fire one banner per
					// boss-down. The audio is carried by POL10-v2's
					// playBossDeath() which fires once per shot at line ~310.
					dispatch({ type: "bossDefeated", enemyId: bestEnemy.id });
				}
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
		// POL35 hitstop reservation — same POL12 timings (80ms standard,
		// 150ms boss), scale 0.05. Enemy tick reads min(this, POL22 key
		// acquire 0.55), so a key-acquire-during-kill cycle still freezes
		// to 0.05 — the player feels the heaviest moment.
		const hitstopMs = bossKillsThisShot > 0 ? 150 : 80;
		timeScaleBus.reserve("hitstop", 0.05, now + hitstopMs);
		playSkeletonDeath();
		// POL10 — layer the boss-down sting on top when at least one boss
		// died in this shot. Players hear both the "kill confirmed" cascade
		// and the "boss down" resolve, so AoE shots that take down a boss
		// + standard enemies read as a richer audio event.
		if (bossKillsThisShot > 0) playBossDeath();
		if (settings.soundEnabled) playBoom();
	}
}
