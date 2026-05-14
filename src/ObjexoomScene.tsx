"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
	Bloom,
	ChromaticAberration,
	EffectComposer,
	Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import type { RefObject } from "react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type * as Yuka from "yuka";
import {
	OBJEXOOM_PALETTE,
	PLAYER_HEIGHT,
	SKELETON_ATTACK_COOLDOWN_MS,
	SKELETON_ATTACK_RANGE,
	SKELETON_DAMAGE,
	TILE,
} from "./constants";
import { tickEnemyFsm } from "./enemyAi";
import type { ObjexoomSectorMap } from "./engine";
import {
	castRayAny,
	computePortalEdges,
	ENEMY_BULLET_DAMAGE,
	type Enemy,
	type EnemyBullet,
	hasLineOfSightAny,
	makeEnemyBullet,
	type ObjexoomGridMap,
	type ObjexoomMap,
	type Pickup,
	resolveCollisionAny,
	spawnEnemies,
	spawnPickups,
	stepEnemyBullet,
} from "./engine";
import { ENEMY_MODELS, pickEnemySkin, WEAPON_MODELS } from "./models";
import type { GameRef, LevelPhase, WeaponState } from "./ObjexoomShell";
import { PlayerController } from "./PlayerController";
import { DIFFICULTY_TUNING, type ObjexoomSettings } from "./settings";
import {
	panForPosition,
	playAggroAlert,
	playBoom,
	playChaingun,
	playDoor,
	playDoorTick,
	playHurt,
	playPickup,
	playPistol,
	playPortal,
	playShotgun,
	playSkeletonDeath,
	stopAmbient,
} from "./sfx";
import { WEAPONS, type WeaponId } from "./weapons";
import {
	clearYuka,
	makeYukaEntityAt,
	removeYukaEntity,
	tickYuka,
} from "./yukaIntegration";

type SceneProps = Readonly<{
	map: ObjexoomMap;
	active: boolean;
	hasKey: boolean;
	gameRef: RefObject<GameRef>;
	weapon: WeaponId;
	ammoRef: RefObject<WeaponState>;
	settings: ObjexoomSettings;
	// H8 — drives going_back behavior (re-aggro, strobe, return-to-spawn).
	phase: LevelPhase;
	// J1 — flashlight ownership. When false, ambient/directional drop to
	// near-dark; when true, a SpotLight tracks camera yaw + pitch.
	hasFlashlight: boolean;
}>;

const WALL_HEIGHT = 3;

export function ObjexoomScene({
	map,
	active,
	hasKey,
	gameRef,
	weapon,
	ammoRef,
	settings,
	phase,
	hasFlashlight,
}: SceneProps) {
	const tuning = DIFFICULTY_TUNING[settings.difficulty];
	const enemiesRef = useRef<Enemy[]>(
		spawnEnemies(map).map((e) => {
			const scaledHp = Math.max(1, Math.round(e.hp * tuning.enemyHpMultiplier));
			return { ...e, hp: scaledHp, maxHp: scaledHp };
		}),
	);
	const pickupsRef = useRef<Pickup[]>(spawnPickups(map));
	const enemyMeshes = useRef<Map<number, THREE.Group>>(new Map());
	const pickupMeshes = useRef<Map<number, THREE.Group>>(new Map());
	const camera = useThree((s) => s.camera);
	const lastFireAt = useRef(0);
	const lastWonAt = useRef(false);
	const lastReachedSpawnAt = useRef(false);
	const lastLavaTickAt = useRef(0);

	// H8 — references for lights so we can strobe them when phase flips to
	// "going_back". The refs are populated when the JSX mounts.
	const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
	const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
	const strobeFrameRef = useRef(0);

	// Live mirror of phase so callbacks/useFrame see the latest value without
	// re-subscribing event listeners.
	const phaseRef = useRef<LevelPhase>(phase);
	useEffect(() => {
		phaseRef.current = phase;
	}, [phase]);

	// I11 — muzzle-flash light. Fires on every shot at the camera position
	// in the weapon's muzzleColor; intensity decays over ~80 ms.
	const muzzleLightRef = useRef<THREE.PointLight | null>(null);
	const muzzleFlashUntil = useRef(0);
	const muzzleColorRef = useRef<THREE.Color>(new THREE.Color("#6172f3"));

	// I7 — track which enemies have already fired their aggro alert so we
	// don't re-play it on every re-entry to chase state. Reset implicitly
	// when the Scene remounts on level change (key=settings.level-…).
	const aggroFiredRef = useRef<Set<number>>(new Set());

	// Y3 — player velocity for imp Pursuit lead-target. Computed from the
	// previous frame's XZ position. Stored as a ref so it survives across
	// frames without triggering re-renders.
	const prevPlayerPosRef = useRef<{ x: number; y: number } | null>(null);
	const playerVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

	// Y1 — per-enemy yuka.GameEntity registry. The FSM computes decisions;
	// the GameEntity exists so neighbor queries (gethelp, navmesh follow-
	// ups) have a real EntityManager registry to read from. Position is
	// mirrored from enemy.position every frame inside the AI loop.
	const yukaEntitiesRef = useRef<Map<number, Yuka.GameEntity>>(new Map());

	// Spawn one yuka.GameEntity per enemy at Scene mount; drop them all
	// at Scene unmount. Re-keying on level change replays this effect so
	// the registry tracks the current enemy roster.
	useEffect(() => {
		for (const enemy of enemiesRef.current) {
			yukaEntitiesRef.current.set(enemy.id, makeYukaEntityAt(enemy.position));
		}
		const registry = yukaEntitiesRef.current;
		return () => {
			for (const entity of registry.values()) removeYukaEntity(entity);
			registry.clear();
		};
	}, []);

	// I2 — player-hit burst: Shell signals an enemy successfully landed a
	// hit (post-iframe). Resolve the camera position and emit the actual
	// burst at the player's XZ so 30 red motes spawn in-place.
	useEffect(() => {
		const onPlayerHit = () => {
			window.dispatchEvent(
				new CustomEvent("objexoom:burst", {
					detail: {
						x: camera.position.x,
						y: camera.position.z,
						kind: "playerHit",
					},
				}),
			);
		};
		window.addEventListener("objexoom:playerHit", onPlayerHit);
		return () => window.removeEventListener("objexoom:playerHit", onPlayerHit);
	}, [camera]);

	// H8 — when phase transitions out → going_back, re-aggro every alive
	// enemy (FSM state 1 = chase, bypass LOS), stop the ambient music, and
	// arm the second RealDoor at the original spawn.
	useEffect(() => {
		if (phase !== "going_back") return;
		for (const enemy of enemiesRef.current) {
			if (enemy.dead) continue;
			enemy.fsmState = 1;
		}
		stopAmbient();
		// K1 — explosion stinger marks the phase flip dramatically.
		if (settings.soundEnabled) playBoom();
	}, [phase, settings.soundEnabled]);

	// C2/C3 — enemy bullets in flight + per-enemy last-seen timestamps for
	// the LOS_LOST_MS fallback. Both refs are live across frames.
	const bulletsRef = useRef<EnemyBullet[]>([]);
	const nextBulletIdRef = useRef(1);
	const lastSeenRef = useRef<Map<number, number>>(new Map());
	const bulletMeshes = useRef<Map<number, THREE.Group>>(new Map());

	// Portals are static per sector map; precompute once. Grid maps don't need
	// them. The CollisionContext keeps the dispatchers honest about which
	// engine path (grid vs. sector) handles each call.
	const portals = useMemo(
		() =>
			map.kind === "sectors" ? computePortalEdges(map) : new Set<string>(),
		[map],
	);
	const collisionCtxRef = useRef({ portals, doorOpen: hasKey });
	useEffect(() => {
		collisionCtxRef.current = { portals, doorOpen: hasKey };
	}, [portals, hasKey]);

	useEffect(() => {
		camera.position.set(map.playerSpawn.x, PLAYER_HEIGHT, map.playerSpawn.y);
		camera.rotation.set(0, map.playerYaw, 0);
	}, [camera, map]);

	// Y7 — drop every yuka entity when the Scene unmounts so a re-key
	// (level change, run reset) starts with an empty manager. The FSM
	// shim doesn't currently register entities, but Y1-Y6 follow-ups
	// will, and the cleanup contract needs to exist now.
	useEffect(() => {
		return () => {
			clearYuka();
		};
	}, []);

	useFrame((_, deltaSeconds) => {
		if (!active) return;
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
		// against a tiny floor so a stationary player gives the imp a
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
			if (hasKey && dxExit * dxExit + dyExit * dyExit < TILE * TILE * 0.4) {
				if (!lastWonAt.current) {
					lastWonAt.current = true;
					gameRef.current.onWin();
					playPortal();
				}
			}
		} else {
			const dxSpawn = px - map.playerSpawn.x;
			const dySpawn = py - map.playerSpawn.y;
			if (dxSpawn * dxSpawn + dySpawn * dySpawn < TILE * TILE * 0.4) {
				if (!lastReachedSpawnAt.current) {
					lastReachedSpawnAt.current = true;
					gameRef.current.onReachSpawn();
					playPortal();
				}
			}
		}

		// I11 — muzzle flash decay. Stays bright until muzzleFlashUntil, then
		// linearly fades to 0 over the remaining window. The light position
		// follows the camera 1:1 (it lives in world space attached to camera).
		if (muzzleLightRef.current) {
			const muzzleNow = now;
			const remaining = muzzleFlashUntil.current - muzzleNow;
			const intensity = remaining > 0 ? Math.min(4, remaining / 20) : 0;
			muzzleLightRef.current.intensity = intensity;
			muzzleLightRef.current.color.copy(muzzleColorRef.current);
			muzzleLightRef.current.position.set(
				camera.position.x,
				camera.position.y,
				camera.position.z,
			);
		}

		// H8 — light strobe during going_back. 200-frame cycle, 10 frames bright.
		if (currentPhase === "going_back") {
			strobeFrameRef.current = (strobeFrameRef.current + 1) % 200;
			const bright = strobeFrameRef.current < 10;
			if (ambientLightRef.current) {
				ambientLightRef.current.intensity = bright ? 1.4 : 0.2;
			}
			if (directionalLightRef.current) {
				directionalLightRef.current.intensity = bright ? 2.0 : 0.35;
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
				// polygonContains test, inlined to avoid an engine import roundtrip.
				const verts = sector.vertices;
				let inside = false;
				const py2 = py + 1e-6;
				for (let i = 0, j = verts.length - 1; i < verts.length; j = i, i += 1) {
					const xi = verts[i].x;
					const yi = verts[i].y;
					const xj = verts[j].x;
					const yj = verts[j].y;
					if (
						yi > py2 !== yj > py2 &&
						px < ((xj - xi) * (py2 - yi)) / (yj - yi) + xi
					) {
						inside = !inside;
					}
				}
				if (inside) {
					standingOnLava = true;
					break;
				}
			}
		}
		if (standingOnLava && now - lastLavaTickAt.current > 600) {
			lastLavaTickAt.current = now;
			gameRef.current.onHit(8);
			playHurt();
		}

		// Pickup collection
		for (const pickup of pickupsRef.current) {
			if (pickup.collected) continue;
			const dx = px - pickup.position.x;
			const dy = py - pickup.position.y;
			if (dx * dx + dy * dy < 1.4 * 1.4) {
				pickup.collected = true;
				const mesh = pickupMeshes.current.get(pickup.id);
				if (mesh) mesh.visible = false;
				gameRef.current.onCollectPickup(pickup.kind);
				playPickup();
				window.dispatchEvent(
					new CustomEvent("objexoom:burst", {
						detail: {
							x: pickup.position.x,
							y: pickup.position.y,
							kind: "pickup",
						},
					}),
				);
			}
		}

		// Enemy AI — FSM driven (state 0=patrol, 1=chase, 3=shoot). Skeletons
		// also melee on contact via the legacy attack-range/cooldown path.
		const allEnemies = enemiesRef.current;
		for (const enemy of allEnemies) {
			if (enemy.dead) continue;
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
				playerVelocity: playerVelocityRef.current,
			});
			enemy.fsmState = out.nextState;
			// I7 — first-time patrol → chase transition fires a panned aggro
			// growl. The Set is per-Scene-instance; remounting on level change
			// resets it implicitly.
			if (
				prevState === 0 &&
				out.nextState === 1 &&
				!aggroFiredRef.current.has(enemy.id)
			) {
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
				const helped = allEnemies.find((e) => e.id === helpId);
				if (helped && !helped.dead) helped.fsmState = 1;
			}

			if (out.moveTarget) {
				enemy.position = wraith
					? out.moveTarget
					: resolveCollisionAny(
							out.moveTarget,
							map,
							collisionCtxRef.current,
							0.5,
						);
			}

			if (out.fireBullet) {
				bulletsRef.current.push(
					makeEnemyBullet(
						nextBulletIdRef.current++,
						enemy.id,
						enemy.position,
						{ x: px, y: py },
						now,
					),
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

			const mesh = enemyMeshes.current.get(enemy.id);
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
			// frame. Drop the entity from the manager when the enemy dies.
			const yukaEntity = yukaEntitiesRef.current.get(enemy.id);
			if (yukaEntity) {
				if (enemy.dead) {
					removeYukaEntity(yukaEntity);
					yukaEntitiesRef.current.delete(enemy.id);
				} else {
					yukaEntity.position.set(enemy.position.x, 0, enemy.position.y);
				}
			}
		}

		// Bullet integration — advance, check wall/player, retire dead bullets.
		const bullets = bulletsRef.current;
		const playerPos = { x: px, y: py };
		let writeIdx = 0;
		for (let i = 0; i < bullets.length; i += 1) {
			const bullet = bullets[i];
			const step = stepEnemyBullet(
				bullet,
				dt,
				now,
				playerPos,
				map,
				collisionCtxRef.current,
			);
			if (step.kind === "hitPlayer") {
				gameRef.current.onHit(ENEMY_BULLET_DAMAGE);
				playHurt();
				const bm = bulletMeshes.current.get(bullet.id);
				if (bm) bm.visible = false;
				continue;
			}
			if (step.kind === "hitWall" || step.kind === "expired") {
				const bm = bulletMeshes.current.get(bullet.id);
				if (bm) bm.visible = false;
				continue;
			}
			bullets[writeIdx++] = bullet;
		}
		bullets.length = writeIdx;
	});

	// Debug listeners (e2e harness). No-ops in production. The
	// `debugKilledSpawnsRef` set is per-Scene-instance and survives the
	// rest of this Scene's lifetime — even if React schedules an extra
	// effect tick, the dead-spawn-position set blocks double-credit.
	const debugKilledSpawnsRef = useRef<Set<string>>(new Set());
	useEffect(() => {
		const onDebugKillAll = () => {
			for (const enemy of enemiesRef.current) {
				const tag = `${enemy.id}@${enemy.position.x.toFixed(3)},${enemy.position.y.toFixed(3)}`;
				if (debugKilledSpawnsRef.current.has(tag)) continue;
				if (enemy.dead) continue;
				debugKilledSpawnsRef.current.add(tag);
				enemy.dead = true;
				const mesh = enemyMeshes.current.get(enemy.id);
				if (mesh) mesh.visible = false;
				// Y1 — debug-kill also drops the enemy's yuka GameEntity so the
				// EntityManager doesn't accumulate dead refs across debug runs.
				const yukaEntity = yukaEntitiesRef.current.get(enemy.id);
				if (yukaEntity) {
					removeYukaEntity(yukaEntity);
					yukaEntitiesRef.current.delete(enemy.id);
				}
				gameRef.current.onKill();
			}
		};
		const onDebugCollectPickups = () => {
			for (const pickup of pickupsRef.current) {
				if (pickup.collected) continue;
				pickup.collected = true;
				const mesh = pickupMeshes.current.get(pickup.id);
				if (mesh) mesh.visible = false;
				gameRef.current.onCollectPickup(pickup.kind);
			}
		};
		window.addEventListener("objexoom:debugKillAll", onDebugKillAll);
		window.addEventListener(
			"objexoom:debugCollectPickups",
			onDebugCollectPickups,
		);
		return () => {
			window.removeEventListener("objexoom:debugKillAll", onDebugKillAll);
			window.removeEventListener(
				"objexoom:debugCollectPickups",
				onDebugCollectPickups,
			);
		};
	}, [gameRef]);

	// Fire handler
	// biome-ignore lint/correctness/useExhaustiveDependencies: refs (ammoRef, enemiesRef) are mutable and shouldn't trigger re-subscribe; lints fights with the imperative ref pattern.
	useEffect(() => {
		const onFire = () => {
			if (!active) return;
			const spec = WEAPONS[weapon];
			const now = performance.now();
			if (now - lastFireAt.current < spec.cooldownMs) return;

			if (spec.ammoCostPerShot > 0) {
				const remaining = ammoRef.current.ammo[weapon];
				if (remaining < spec.ammoCostPerShot) return;
			}

			lastFireAt.current = now;
			gameRef.current.onSpendAmmo(weapon, spec.ammoCostPerShot);

			// I11 — muzzle-flash light. 80 ms of weapon-colored bloom from
			// the camera position. The light decays in the per-frame block.
			muzzleFlashUntil.current = now + 80;
			muzzleColorRef.current.set(spec.muzzleColor);

			if (weapon === "pistol") playPistol();
			else if (weapon === "chaingun") playChaingun();
			else playShotgun();

			// I10 — shotgun shell ejection. One brass shell ejects to the
			// camera's right with random spin; gravity + ground bounce; 4 s
			// despawn. Driven by the ShellEjectField listener.
			if (weapon === "shotgun") {
				const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
					camera.quaternion,
				);
				window.dispatchEvent(
					new CustomEvent("objexoom:shellEject", {
						detail: {
							x: camera.position.x + right.x * 0.3,
							y: camera.position.y - 0.3,
							z: camera.position.z + right.z * 0.3,
							vx: right.x * 1.6 + (Math.random() - 0.5) * 0.4,
							vy: 1.2,
							vz: right.z * 1.6 + (Math.random() - 0.5) * 0.4,
						},
					}),
				);
			}

			const forwardBase = new THREE.Vector3(0, 0, -1)
				.applyQuaternion(camera.quaternion)
				.normalize();
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
				const wallHit = castRayAny(
					origin,
					dir2,
					map,
					collisionCtxRef.current,
					maxDist,
				);
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
				if (bestEnemy) {
					bestEnemy.hp -= spec.damage;
					// D5 — damage burst at hit point.
					window.dispatchEvent(
						new CustomEvent("objexoom:burst", {
							detail: {
								x: bestEnemy.position.x,
								y: bestEnemy.position.y,
								kind: "damage",
							},
						}),
					);
					if (bestEnemy.hp <= 0) {
						bestEnemy.dead = true;
						killsThisShot += 1;
						const mesh = enemyMeshes.current.get(bestEnemy.id);
						if (mesh) mesh.visible = false;
						// D1-style imp explode-on-death: extra burst at higher count.
						if (bestEnemy.kind === "imp") {
							window.dispatchEvent(
								new CustomEvent("objexoom:burst", {
									detail: {
										x: bestEnemy.position.x,
										y: bestEnemy.position.y,
										kind: "explode",
									},
								}),
							);
						}
						// I1 — body-part physics. Spawn 4-6 chunky meshes with
						// urandom spin + gravity at the death location.
						window.dispatchEvent(
							new CustomEvent("objexoom:bodyParts", {
								detail: {
									x: bestEnemy.position.x,
									y: bestEnemy.position.y,
									kind: bestEnemy.kind,
								},
							}),
						);
					}
				}
			}

			if (killsThisShot > 0) {
				for (let i = 0; i < killsThisShot; i += 1) gameRef.current.onKill();
				playSkeletonDeath();
				// K1 — every kill ships a (subtler) explosion stinger so
				// crowd-kill moments have weight, not just the death pluck.
				if (settings.soundEnabled) playBoom();
			}
		};

		window.addEventListener("objexoom:fire", onFire);
		return () => window.removeEventListener("objexoom:fire", onFire);
	}, [active, camera, map, hasKey, gameRef, weapon, ammoRef]);

	useFrame(() => {
		if (!active || hasKey) return;
		const dx = camera.position.x - map.keyPosition.x;
		const dy = camera.position.z - map.keyPosition.y;
		if (dx * dx + dy * dy < 1.2 * 1.2) {
			gameRef.current.onPickupKey();
			playPickup();
		}
	});

	return (
		<>
			{/* J1 — when the player owns the flashlight the world reads in
			    full ambient + sun. Without it, both drop to near-dark and
			    the flashlight spotlight is the only practical fill. */}
			<ambientLight
				ref={ambientLightRef}
				intensity={hasFlashlight ? 0.55 : 0.12}
				color={OBJEXOOM_PALETTE.violet}
			/>
			<directionalLight
				ref={directionalLightRef}
				position={[10, 16, 8]}
				intensity={hasFlashlight ? 0.9 : 0.18}
				color={OBJEXOOM_PALETTE.parchment}
				castShadow
				shadow-mapSize={[1024, 1024]}
				shadow-camera-left={-20}
				shadow-camera-right={20}
				shadow-camera-top={20}
				shadow-camera-bottom={-20}
				shadow-camera-near={0.5}
				shadow-camera-far={60}
			/>
			{hasFlashlight && <Flashlight />}
			<hemisphereLight
				args={[OBJEXOOM_PALETTE.indigo, OBJEXOOM_PALETTE.ink, 0.35]}
			/>
			{/* I11 — muzzle-flash point light. Lives at camera position,
			    driven by useFrame so it can decay between renders. */}
			<pointLight ref={muzzleLightRef} intensity={0} distance={8} decay={1.5} />
			<fog attach="fog" args={[OBJEXOOM_PALETTE.ink, 6, TILE * 12]} />
			<color attach="background" args={[OBJEXOOM_PALETTE.ink]} />

			{map.kind === "grid" ? (
				<MapGeometry map={map} doorOpen={hasKey} />
			) : (
				<SectorMapGeometry map={map} />
			)}
			<KeyMarker visible={!hasKey} position={map.keyPosition} />
			<ExitPortal
				position={map.exitPosition}
				unlocked={hasKey}
				hueIndex={(map.seed >>> 0) % 5}
			/>
			<RealDoor position={map.exitPosition} unlocked={hasKey} />
			<TreasureChest position={map.exitPosition} />
			{/* H8 — second RealDoor at the original spawn. Opens during the
			    going_back phase so the player has a clear visual goal to
			    sprint toward while every enemy aggros. */}
			<RealDoor position={map.playerSpawn} unlocked={phase === "going_back"} />

			{enemiesRef.current.map((enemy) => (
				<EnemyMesh
					key={enemy.id}
					enemy={enemy}
					register={(group) => {
						if (group) enemyMeshes.current.set(enemy.id, group);
						else enemyMeshes.current.delete(enemy.id);
					}}
				/>
			))}

			{pickupsRef.current.map((pickup) => (
				<PickupMesh
					key={pickup.id}
					pickup={pickup}
					register={(group) => {
						if (group) pickupMeshes.current.set(pickup.id, group);
						else pickupMeshes.current.delete(pickup.id);
					}}
				/>
			))}

			<BulletField bulletsRef={bulletsRef} register={bulletMeshes} />
			<ParticleBurstField />
			<BodyPartField />
			<ShellEjectField />
			<WeaponViewmodel weapon={weapon} />

			<PlayerController
				map={map}
				active={active}
				hasKey={hasKey}
				settings={settings}
			/>

			<EffectComposer>
				<Bloom
					intensity={0.45}
					luminanceThreshold={0.55}
					luminanceSmoothing={0.2}
				/>
				<ChromaticAberration
					blendFunction={BlendFunction.NORMAL}
					offset={[0.0015, 0.0015]}
				/>
				<Vignette eskil={false} offset={0.25} darkness={0.7} />
			</EffectComposer>
		</>
	);
}

function MapGeometry({
	map,
	doorOpen,
}: {
	map: ObjexoomGridMap;
	doorOpen: boolean;
}) {
	const walls = useMemo(() => {
		const out: { x: number; z: number; variant: number }[] = [];
		for (let gy = 0; gy < map.height; gy += 1) {
			for (let gx = 0; gx < map.width; gx += 1) {
				if (map.cells[gy][gx] !== "wall") continue;
				const variant = (gx * 31 + gy * 17) % 3;
				out.push({ x: (gx + 0.5) * TILE, z: (gy + 0.5) * TILE, variant });
			}
		}
		return out;
	}, [map]);

	const lavaTiles = useMemo(() => {
		const out: { x: number; z: number }[] = [];
		for (let gy = 0; gy < map.height; gy += 1) {
			for (let gx = 0; gx < map.width; gx += 1) {
				if (map.cells[gy][gx] !== "lava") continue;
				out.push({ x: (gx + 0.5) * TILE, z: (gy + 0.5) * TILE });
			}
		}
		return out;
	}, [map]);

	const floorSize = TILE * Math.max(map.width, map.height);
	const floorCenter = (TILE * map.width) / 2;

	const doorPos = useMemo(
		() => ({
			x: (map.doorCell.gx + 0.5) * TILE,
			z: (map.doorCell.gy + 0.5) * TILE,
		}),
		[map],
	);

	return (
		<group>
			<mesh
				rotation={[-Math.PI / 2, 0, 0]}
				position={[floorCenter, 0, floorCenter]}
				receiveShadow
			>
				<planeGeometry args={[floorSize, floorSize]} />
				<meshStandardMaterial
					color={OBJEXOOM_PALETTE.ink}
					emissive="#1a1f3a"
					emissiveIntensity={0.18}
					roughness={0.95}
				/>
			</mesh>
			<mesh
				rotation={[Math.PI / 2, 0, 0]}
				position={[floorCenter, WALL_HEIGHT, floorCenter]}
			>
				<planeGeometry args={[floorSize, floorSize]} />
				<meshStandardMaterial color="#0b1024" roughness={1} />
			</mesh>

			{lavaTiles.map((p) => (
				<mesh
					key={`l-${p.x}-${p.z}`}
					position={[p.x, 0.02, p.z]}
					rotation={[-Math.PI / 2, 0, 0]}
				>
					<planeGeometry args={[TILE, TILE]} />
					<meshStandardMaterial
						color={OBJEXOOM_PALETTE.amber}
						emissive={OBJEXOOM_PALETTE.amber}
						emissiveIntensity={1.6}
					/>
				</mesh>
			))}

			{walls.map((m) => (
				<mesh
					key={`w-${m.x}-${m.z}`}
					position={[m.x, WALL_HEIGHT / 2, m.z]}
					castShadow
					receiveShadow
				>
					<boxGeometry args={[TILE, WALL_HEIGHT, TILE]} />
					<meshStandardMaterial
						color={
							m.variant === 0
								? "#1f2547"
								: m.variant === 1
									? "#26224a"
									: "#1a1e3b"
						}
						emissive={
							m.variant === 0
								? OBJEXOOM_PALETTE.indigo
								: OBJEXOOM_PALETTE.violet
						}
						emissiveIntensity={0.08}
						roughness={0.85}
					/>
				</mesh>
			))}

			<LockedDoor position={doorPos} open={doorOpen} />
		</group>
	);
}

// H6 — animated locked door. Slides upward over ~600 ms when the player
// has the key. Fires `playDoor` exactly once on the open transition.
function LockedDoor({
	position,
	open,
}: {
	position: { x: number; z: number };
	open: boolean;
}) {
	const meshRef = useRef<THREE.Mesh | null>(null);
	const progressRef = useRef(open ? 1 : 0);
	const didFireRef = useRef(open);
	useFrame((_, dt) => {
		if (!meshRef.current) return;
		const target = open ? 1 : 0;
		const speed = 1 / 0.6; // 600 ms full travel
		progressRef.current +=
			Math.sign(target - progressRef.current) *
			Math.min(Math.abs(target - progressRef.current), speed * dt);
		if (open && !didFireRef.current && progressRef.current > 0.05) {
			didFireRef.current = true;
			playDoor();
			// K7 — mechanical tick pairs with the heavy door boom.
			playDoorTick();
		}
		const baseY = WALL_HEIGHT / 2;
		meshRef.current.position.set(
			position.x,
			baseY + progressRef.current * WALL_HEIGHT,
			position.z,
		);
	});
	return (
		<mesh
			ref={(node) => {
				meshRef.current = node;
			}}
		>
			<boxGeometry args={[TILE * 0.95, WALL_HEIGHT * 0.95, TILE * 0.25]} />
			<meshStandardMaterial
				color={OBJEXOOM_PALETTE.amber}
				emissive={OBJEXOOM_PALETTE.amber}
				emissiveIntensity={open ? 0.08 : 0.55}
				roughness={0.5}
			/>
		</mesh>
	);
}

/**
 * Renders an enemy using a real 3DPSX GLB asset (see `models.ts`),
 * with state-driven animation:
 *  - walking when the enemy is moving (velocity sample)
 *  - attack when fsmState===3 (just fired)
 *  - death once enemy.dead flips true
 *  - idle otherwise
 *
 * Each instance gets a SkeletonUtils.clone of the cached scene so
 * multiple enemies of the same kind animate independently.
 */
function EnemyMesh({
	enemy,
	register,
}: {
	enemy: Enemy;
	register: (group: THREE.Group | null) => void;
}) {
	const groupRef = useRef<THREE.Group | null>(null);
	// Each enemy picks deterministically from the kind's skin roster
	// using its id. Same id => same skin every spawn.
	const skin = useMemo(
		() => pickEnemySkin(enemy.kind, enemy.id),
		[enemy.kind, enemy.id],
	);
	const gltf = useGLTF(skin.url);
	// SkeletonUtils.clone keeps the skinned-mesh/skeleton bindings sane
	// across multiple instances — a plain .clone() shares skeletons and
	// every instance animates in lockstep.
	const cloned = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
	// Normalize size against measured bbox. Use the LONGEST axis (not
	// just Y) because some horror meshes ship lying on the wrong axis
	// — picking the biggest dim and matching it to heightTiles gives
	// a reliable on-screen scale regardless of authored orientation.
	const scale = useMemo(() => {
		const bbox = new THREE.Box3().setFromObject(cloned);
		const size = new THREE.Vector3();
		bbox.getSize(size);
		const longest = Math.max(size.x, size.y, size.z, 1e-3);
		return skin.heightTiles / longest;
	}, [cloned, skin.heightTiles]);
	const { actions, mixer } = useAnimations(gltf.animations, cloned);
	// Some skins ship no usable named animations (T-pose only, or the
	// FBX→GLB step collapsed track names to "mixamo.com"). Renderer
	// gives them a procedural idle-bob so they don't look frozen.
	const hasNamedAnims = useMemo(
		() => Boolean(skin.anims.idle && actions[skin.anims.idle]),
		[actions, skin.anims.idle],
	);

	const facingRef = useRef(0);
	const lastPosRef = useRef({ x: enemy.position.x, y: enemy.position.y });
	const prevStateRef = useRef<"idle" | "walk" | "attack" | "death" | null>(
		null,
	);
	// Phase offset for the procedural bob so a packed level doesn't
	// look like a chorus line. Deterministic from id.
	const bobPhase = useMemo(() => (enemy.id * 0.7) % (Math.PI * 2), [enemy.id]);

	useEffect(() => {
		register(groupRef.current);
		return () => register(null);
	}, [register]);

	useFrame((_, dt) => {
		mixer.update(dt);
		const group = groupRef.current;
		if (!group) return;

		// Procedural bob amplitude (off when a real walk anim is present).
		const t = performance.now() / 1000;
		const bobY = hasNamedAnims ? 0 : Math.sin(t * 2.2 + bobPhase) * 0.06;

		// Y-position: wraith hovers; ground enemies stand on floor.
		const targetY =
			skin.floorOffset + bobY + (enemy.kind === "wraith" ? 1.2 : 0);
		group.position.set(enemy.position.x, targetY, enemy.position.y);

		// Face the direction of travel (smoothed).
		const dx = enemy.position.x - lastPosRef.current.x;
		const dy = enemy.position.y - lastPosRef.current.y;
		if (dx * dx + dy * dy > 1e-6) {
			facingRef.current = Math.atan2(dx, dy);
		}
		lastPosRef.current = { x: enemy.position.x, y: enemy.position.y };
		group.rotation.y = facingRef.current + skin.yawOffsetRad;

		// State → animation (only when the rig has real animations).
		if (!hasNamedAnims) return;
		const speedSq = dx * dx + dy * dy;
		const desired: "idle" | "walk" | "attack" | "death" = enemy.dead
			? "death"
			: enemy.fsmState === 3
				? "attack"
				: speedSq > 1e-5
					? "walk"
					: "idle";

		if (desired !== prevStateRef.current) {
			const animName = skin.anims[desired];
			const next = animName ? actions[animName] : null;
			if (next) {
				for (const action of Object.values(actions)) {
					if (action && action !== next && action.isRunning()) {
						action.fadeOut(0.15);
					}
				}
				next.reset();
				next.fadeIn(0.15);
				if (desired === "attack" || desired === "death") {
					next.setLoop(THREE.LoopOnce, 1);
					next.clampWhenFinished = true;
				} else {
					next.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY);
				}
				next.play();
			}
			prevStateRef.current = desired;
		}
	});

	return (
		<group
			ref={(node) => {
				groupRef.current = node;
			}}
			position={[enemy.position.x, skin.floorOffset, enemy.position.y]}
			scale={scale}
		>
			<primitive object={cloned} />
		</group>
	);
}

// Preload every skin variant in the roster, not just the primary.
for (const m of Object.values(ENEMY_MODELS)) {
	for (const s of m.roster) useGLTF.preload(s.url);
}

function PickupMesh({
	pickup,
	register,
}: {
	pickup: Pickup;
	register: (group: THREE.Group | null) => void;
}) {
	const ref = useRef<THREE.Group | null>(null);
	useEffect(() => {
		register(ref.current);
		return () => register(null);
	}, [register]);
	useFrame((s) => {
		if (!ref.current) return;
		ref.current.rotation.y = s.clock.elapsedTime * 1.4;
		ref.current.position.y =
			0.7 + Math.sin(s.clock.elapsedTime * 2 + pickup.id) * 0.1;
	});

	return (
		<group
			ref={(node) => {
				ref.current = node;
			}}
			position={[pickup.position.x, 0.7, pickup.position.y]}
		>
			{pickup.kind === "health" && (
				<>
					{/* Amber cross — D2. Two crossed bars in brand amber. */}
					<mesh>
						<boxGeometry args={[0.5, 0.15, 0.15]} />
						<meshStandardMaterial
							color={OBJEXOOM_PALETTE.amber}
							emissive={OBJEXOOM_PALETTE.amber}
							emissiveIntensity={1.0}
						/>
					</mesh>
					<mesh>
						<boxGeometry args={[0.15, 0.5, 0.15]} />
						<meshStandardMaterial
							color={OBJEXOOM_PALETTE.amber}
							emissive={OBJEXOOM_PALETTE.amber}
							emissiveIntensity={1.0}
						/>
					</mesh>
				</>
			)}
			{pickup.kind === "chaingunAmmo" && (
				/* D3 — indigo cell box. Reads as a battery / power cell. */
				<group>
					<mesh>
						<boxGeometry args={[0.55, 0.32, 0.32]} />
						<meshStandardMaterial
							color="#1f2547"
							emissive={OBJEXOOM_PALETTE.indigo}
							emissiveIntensity={0.55}
							roughness={0.5}
						/>
					</mesh>
					{/* Cap stripes */}
					<mesh position={[0.18, 0, 0]}>
						<boxGeometry args={[0.06, 0.4, 0.4]} />
						<meshStandardMaterial
							color={OBJEXOOM_PALETTE.indigo}
							emissive={OBJEXOOM_PALETTE.indigo}
							emissiveIntensity={1.4}
						/>
					</mesh>
					<mesh position={[-0.18, 0, 0]}>
						<boxGeometry args={[0.06, 0.4, 0.4]} />
						<meshStandardMaterial
							color={OBJEXOOM_PALETTE.indigo}
							emissive={OBJEXOOM_PALETTE.indigo}
							emissiveIntensity={1.4}
						/>
					</mesh>
				</group>
			)}
			{pickup.kind === "shotgunAmmo" && (
				/* D3 — amber shell pair. Two stubby cylinders side by side. */
				<group>
					<mesh position={[-0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.13, 0.13, 0.36, 12]} />
						<meshStandardMaterial
							color={OBJEXOOM_PALETTE.amber}
							emissive={OBJEXOOM_PALETTE.amber}
							emissiveIntensity={0.95}
							roughness={0.4}
						/>
					</mesh>
					<mesh position={[0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.13, 0.13, 0.36, 12]} />
						<meshStandardMaterial
							color={OBJEXOOM_PALETTE.amber}
							emissive={OBJEXOOM_PALETTE.amber}
							emissiveIntensity={0.95}
							roughness={0.4}
						/>
					</mesh>
					{/* Brass primer caps */}
					<mesh position={[-0.15, 0.18, 0]}>
						<cylinderGeometry args={[0.13, 0.13, 0.04, 12]} />
						<meshStandardMaterial
							color="#b16a14"
							emissive="#b16a14"
							emissiveIntensity={0.4}
						/>
					</mesh>
					<mesh position={[0.15, 0.18, 0]}>
						<cylinderGeometry args={[0.13, 0.13, 0.04, 12]} />
						<meshStandardMaterial
							color="#b16a14"
							emissive="#b16a14"
							emissiveIntensity={0.4}
						/>
					</mesh>
				</group>
			)}
			{pickup.kind === "flashlight" && (
				/* J1 — flashlight pickup: parchment cylinder w/ amber lens */
				<group>
					<mesh rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.13, 0.16, 0.45, 12]} />
						<meshStandardMaterial
							color="#fef3c7"
							emissive="#fef3c7"
							emissiveIntensity={0.6}
							metalness={0.4}
							roughness={0.3}
						/>
					</mesh>
					<mesh position={[0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
						<cylinderGeometry args={[0.18, 0.13, 0.08, 12]} />
						<meshStandardMaterial
							color={OBJEXOOM_PALETTE.amber}
							emissive={OBJEXOOM_PALETTE.amber}
							emissiveIntensity={1.8}
						/>
					</mesh>
				</group>
			)}
		</group>
	);
}

function KeyMarker({
	visible,
	position,
}: {
	visible: boolean;
	position: { x: number; y: number };
}) {
	const ref = useRef<THREE.Mesh | null>(null);
	useFrame((s) => {
		if (!ref.current) return;
		ref.current.rotation.y = s.clock.elapsedTime * 1.6;
		ref.current.position.y = 0.7 + Math.sin(s.clock.elapsedTime * 2.2) * 0.12;
	});
	return (
		<mesh ref={ref} position={[position.x, 0.7, position.y]} visible={visible}>
			<torusGeometry args={[0.28, 0.09, 8, 18]} />
			<meshStandardMaterial
				color={OBJEXOOM_PALETTE.amber}
				emissive={OBJEXOOM_PALETTE.amber}
				emissiveIntensity={0.95}
			/>
		</mesh>
	);
}

// D1 — decorative treasure chest stamped on every exit. The reference uses
// a lathed ring + cylinder + box silhouette; we approximate with a wide
// box base + a narrower lid offset upward. No interaction — the portal
// torus is still the win trigger.
function TreasureChest({ position }: { position: { x: number; y: number } }) {
	return (
		<group position={[position.x, 0.25, position.y]}>
			<mesh position={[0, 0, 0]}>
				<boxGeometry args={[0.9, 0.45, 0.65]} />
				<meshStandardMaterial
					color="#3a2a14"
					emissive={OBJEXOOM_PALETTE.amber}
					emissiveIntensity={0.15}
					roughness={0.7}
				/>
			</mesh>
			<mesh position={[0, 0.33, 0]}>
				<boxGeometry args={[0.92, 0.22, 0.68]} />
				<meshStandardMaterial
					color="#241a0a"
					emissive={OBJEXOOM_PALETTE.amber}
					emissiveIntensity={0.18}
					roughness={0.6}
				/>
			</mesh>
			{/* Brass band */}
			<mesh position={[0, 0.05, 0.34]}>
				<boxGeometry args={[0.94, 0.05, 0.02]} />
				<meshStandardMaterial
					color={OBJEXOOM_PALETTE.amber}
					emissive={OBJEXOOM_PALETTE.amber}
					emissiveIntensity={0.65}
				/>
			</mesh>
			{/* Lock */}
			<mesh position={[0, 0.27, 0.34]}>
				<cylinderGeometry args={[0.07, 0.07, 0.05, 12]} />
				<meshStandardMaterial
					color={OBJEXOOM_PALETTE.amber}
					emissive={OBJEXOOM_PALETTE.amber}
					emissiveIntensity={1.0}
				/>
			</mesh>
		</group>
	);
}

// H9 — 5-hue goal palette. Reference uses `pallet[rotation*8/PI]` to color
// the goal; we derive the hue from a 0-4 index so each ref level reads
// with a distinct portal tint. Indigo/violet stay, plus amber/teal/rose.
const GOAL_HUES: readonly string[] = [
	OBJEXOOM_PALETTE.violet,
	OBJEXOOM_PALETTE.indigo,
	OBJEXOOM_PALETTE.amber,
	"#22d3a8", // teal
	"#f43f5e", // rose
];

function ExitPortal({
	position,
	unlocked,
	hueIndex,
}: {
	position: { x: number; y: number };
	unlocked: boolean;
	hueIndex: number;
}) {
	const ref = useRef<THREE.Mesh | null>(null);
	const hue = GOAL_HUES[hueIndex % GOAL_HUES.length];
	useFrame((s) => {
		if (!ref.current) return;
		ref.current.rotation.z = s.clock.elapsedTime * 0.6;
	});
	return (
		<mesh ref={ref} position={[position.x, 1.2, position.y]}>
			<torusGeometry args={[0.95, 0.22, 18, 32]} />
			<meshStandardMaterial
				color={unlocked ? hue : OBJEXOOM_PALETTE.indigo}
				emissive={unlocked ? hue : OBJEXOOM_PALETTE.indigo}
				emissiveIntensity={unlocked ? 1.4 : 0.3}
			/>
		</mesh>
	);
}

// H7 — RealDoor at the goal. A wide animated portal frame that slides
// upward when the player has the key. Mirrors the reference's
// `RealDoor` class which gates level-clear behind passing through.
function RealDoor({
	position,
	unlocked,
}: {
	position: { x: number; y: number };
	unlocked: boolean;
}) {
	const meshRef = useRef<THREE.Mesh | null>(null);
	const progressRef = useRef(unlocked ? 1 : 0);
	const didFireRef = useRef(unlocked);
	useFrame((_, dt) => {
		if (!meshRef.current) return;
		const target = unlocked ? 1 : 0;
		const speed = 1 / 0.9; // 900 ms slower-than-locked-door open
		const delta =
			Math.sign(target - progressRef.current) *
			Math.min(Math.abs(target - progressRef.current), speed * dt);
		progressRef.current += delta;
		if (unlocked && !didFireRef.current && progressRef.current > 0.05) {
			didFireRef.current = true;
			playPortal();
			// K7 — RealDoor mechanical tick on the open transition.
			playDoorTick();
		}
		const baseY = 1.2;
		meshRef.current.position.set(
			position.x,
			baseY + progressRef.current * 2.4,
			position.y,
		);
	});
	return (
		<mesh
			ref={(node) => {
				meshRef.current = node;
			}}
		>
			<boxGeometry args={[2.2, 2.4, 0.18]} />
			<meshStandardMaterial
				color={unlocked ? OBJEXOOM_PALETTE.violet : "#231a3f"}
				emissive={unlocked ? OBJEXOOM_PALETTE.violet : OBJEXOOM_PALETTE.indigo}
				emissiveIntensity={unlocked ? 1.0 : 0.25}
				roughness={0.4}
				metalness={0.2}
			/>
		</mesh>
	);
}

// Renders an ObjexoomSectorMap (decoded reference level) as r3f geometry.
// Each MapSector becomes a flat floor + ceiling shape plus wall quads along
// every edge that isn't shared with an adjacent sector at the same height.
// Sectors with floorHeight < 0 render lava-tinted (matches reference).
function SectorMapGeometry({ map }: { map: ObjexoomSectorMap }) {
	const shapes = useMemo(() => {
		return map.sectors.map((sector) => {
			const shape = new THREE.Shape(
				sector.vertices.map((v) => new THREE.Vector2(v.x, v.y)),
			);
			const lava = sector.floorHeight < 0;
			const sectorKey = sector.vertices
				.map((v) => `${v.x.toFixed(2)},${v.y.toFixed(2)}`)
				.join("|");
			return { sector, shape, lava, sectorKey };
		});
	}, [map]);

	return (
		<group>
			{shapes.map(({ sector, shape, lava, sectorKey }) => (
				<group key={`sec-${sectorKey}`}>
					{/* Floor */}
					<mesh
						rotation={[-Math.PI / 2, 0, 0]}
						position={[0, sector.floorHeight, 0]}
					>
						<shapeGeometry args={[shape]} />
						<meshStandardMaterial
							color={lava ? OBJEXOOM_PALETTE.amber : "#1f2547"}
							emissive={lava ? OBJEXOOM_PALETTE.amber : "#0b1024"}
							emissiveIntensity={lava ? 1.4 : 0.18}
							roughness={lava ? 0.4 : 0.95}
							side={THREE.DoubleSide}
						/>
					</mesh>
					{/* Ceiling */}
					<mesh
						rotation={[Math.PI / 2, 0, 0]}
						position={[0, sector.ceilingHeight, 0]}
					>
						<shapeGeometry args={[shape]} />
						<meshStandardMaterial
							color="#0b1024"
							roughness={1}
							side={THREE.DoubleSide}
						/>
					</mesh>
					{/* Walls — one quad per edge. Portal de-duping is engine-side. */}
					{sector.vertices.map((a, idx) => {
						const b = sector.vertices[(idx + 1) % sector.vertices.length];
						const len = Math.hypot(b.x - a.x, b.y - a.y);
						if (len < 1e-3) return null;
						const mx = (a.x + b.x) / 2;
						const mz = (a.y + b.y) / 2;
						const angle = Math.atan2(b.y - a.y, b.x - a.x);
						const height = sector.ceilingHeight - sector.floorHeight;
						const variant = idx % 3;
						return (
							<mesh
								key={`w-${sectorKey}-${a.x.toFixed(2)},${a.y.toFixed(2)}-${b.x.toFixed(2)},${b.y.toFixed(2)}`}
								position={[mx, sector.floorHeight + height / 2, mz]}
								rotation={[0, -angle, 0]}
							>
								<boxGeometry args={[len, height, 0.08]} />
								<meshStandardMaterial
									color={
										variant === 0
											? "#1f2547"
											: variant === 1
												? "#26224a"
												: "#1a1e3b"
									}
									emissive={
										variant === 0
											? OBJEXOOM_PALETTE.indigo
											: OBJEXOOM_PALETTE.violet
									}
									emissiveIntensity={0.08}
									roughness={0.85}
								/>
							</mesh>
						);
					})}
				</group>
			))}
		</group>
	);
}

// Renders all currently-alive enemy bullets. The bullet array lives on a
// ref managed by the parent Scene's useFrame; this component just walks it
// each frame and lays down a glowing sphere per bullet.
function BulletField({
	bulletsRef,
	register,
}: {
	bulletsRef: RefObject<EnemyBullet[]>;
	register: RefObject<Map<number, THREE.Group>>;
}) {
	const groupRef = useRef<THREE.Group | null>(null);
	useFrame(() => {
		if (!groupRef.current) return;
		const seen = new Set<number>();
		for (const bullet of bulletsRef.current ?? []) {
			if (bullet.dead) continue;
			let mesh = register.current?.get(bullet.id);
			if (!mesh && groupRef.current) {
				const g = new THREE.Group();
				const inner = new THREE.Mesh(
					new THREE.SphereGeometry(0.18, 10, 10),
					new THREE.MeshStandardMaterial({
						color: OBJEXOOM_PALETTE.amber,
						emissive: OBJEXOOM_PALETTE.amber,
						emissiveIntensity: 1.8,
					}),
				);
				g.add(inner);
				groupRef.current.add(g);
				register.current?.set(bullet.id, g);
				mesh = g;
			}
			if (mesh) {
				mesh.visible = true;
				mesh.position.set(bullet.position.x, 1.3, bullet.position.y);
				seen.add(bullet.id);
			}
		}
		for (const [id, mesh] of register.current ?? []) {
			if (!seen.has(id)) mesh.visible = false;
		}
	});
	return (
		<group
			ref={(node) => {
				groupRef.current = node;
			}}
		/>
	);
}

// D4/D5 — particle bursts. Listens for `objexoom:burst` events (pickup
// collected → 8 amber motes; enemy hit → 4 violet motes; imp explode →
// 12 amber motes). Each mote fades over 350ms (matches D4 spec).
type Mote = {
	id: number;
	pos: { x: number; y: number; z: number };
	vel: { x: number; y: number; z: number };
	color: number;
	createdAt: number;
};

const MOTE_TTL_MS = 350;
// I2 — bumped from 96 to fit ref-parity counts (15 + 30 = 45 mid-fight),
// 200 covers 4-5 concurrent damage bursts without dropping older motes.
const MAX_MOTES = 200;

function ParticleBurstField() {
	const motesRef = useRef<Mote[]>([]);
	const groupRef = useRef<THREE.Group | null>(null);
	const meshes = useRef<Map<number, THREE.Mesh>>(new Map());
	const nextId = useRef(1);

	useEffect(() => {
		const onBurst = (e: Event) => {
			const ev = e as CustomEvent<{
				x: number;
				y: number;
				kind: "pickup" | "damage" | "explode" | "playerHit";
			}>;
			const detail = ev.detail;
			// I2 — exact ref-parity counts: enemy hit = 15, player hit = 30,
			// imp explode-on-death = 12, pickup chime = 8.
			const count =
				detail.kind === "pickup"
					? 8
					: detail.kind === "explode"
						? 12
						: detail.kind === "playerHit"
							? 30
							: 15;
			const colorHex =
				detail.kind === "damage"
					? 0xa855f7 // violet — enemy hit
					: detail.kind === "playerHit"
						? 0xdc2626 // red — player hit
						: 0xf59e0b; // amber — pickup / explode
			const now = performance.now();
			for (let i = 0; i < count; i += 1) {
				const theta = Math.random() * Math.PI * 2;
				const phi = Math.random() * Math.PI - Math.PI / 2;
				const speed = 1.5 + Math.random() * 1.5;
				motesRef.current.push({
					id: nextId.current++,
					pos: { x: detail.x, y: 0.9, z: detail.y },
					vel: {
						x: Math.cos(theta) * Math.cos(phi) * speed,
						y: Math.sin(phi) * speed + 1.6,
						z: Math.sin(theta) * Math.cos(phi) * speed,
					},
					color: colorHex,
					createdAt: now,
				});
			}
			// Cap allocation — drop oldest if we've crossed the budget.
			while (motesRef.current.length > MAX_MOTES) motesRef.current.shift();
		};
		window.addEventListener("objexoom:burst", onBurst);
		return () => window.removeEventListener("objexoom:burst", onBurst);
	}, []);

	useFrame((_, dt) => {
		if (!groupRef.current) return;
		const now = performance.now();
		const live: Mote[] = [];
		const seen = new Set<number>();
		for (const mote of motesRef.current) {
			const age = now - mote.createdAt;
			if (age > MOTE_TTL_MS) continue;
			mote.pos.x += mote.vel.x * dt;
			mote.pos.y += mote.vel.y * dt;
			mote.pos.z += mote.vel.z * dt;
			mote.vel.y -= 6 * dt; // gravity
			let mesh = meshes.current.get(mote.id);
			if (!mesh) {
				const m = new THREE.Mesh(
					new THREE.SphereGeometry(0.08, 6, 6),
					new THREE.MeshStandardMaterial({
						color: mote.color,
						emissive: mote.color,
						emissiveIntensity: 1.6,
						transparent: true,
					}),
				);
				groupRef.current.add(m);
				meshes.current.set(mote.id, m);
				mesh = m;
			}
			mesh.position.set(mote.pos.x, mote.pos.y, mote.pos.z);
			const fade = 1 - age / MOTE_TTL_MS;
			(mesh.material as THREE.MeshStandardMaterial).opacity = fade;
			mesh.visible = true;
			seen.add(mote.id);
			live.push(mote);
		}
		motesRef.current = live;
		// Recycle expired meshes — hide and let GC clean up on unmount.
		for (const [id, mesh] of meshes.current) {
			if (!seen.has(id)) {
				mesh.visible = false;
				groupRef.current.remove(mesh);
				meshes.current.delete(id);
			}
		}
	});

	return (
		<group
			ref={(node) => {
				groupRef.current = node;
			}}
		/>
	);
}

// I1 — body-part physics. Listens for `objexoom:bodyParts` (dispatched
// at every enemy death) and spawns 4-6 chunky shard meshes at the death
// location. Each shard has random spin + initial velocity + gravity, sits
// on the floor after bouncing once, fades over BODYPART_TTL_MS, and
// despawns. Caps total live shards to keep allocation bounded.
type BodyShard = {
	id: number;
	pos: { x: number; y: number; z: number };
	vel: { x: number; y: number; z: number };
	spin: { x: number; y: number; z: number };
	color: number;
	createdAt: number;
	bounced: boolean;
};

const BODYPART_TTL_MS = 3000;
const MAX_BODY_SHARDS = 120;

function BodyPartField() {
	const shardsRef = useRef<BodyShard[]>([]);
	const groupRef = useRef<THREE.Group | null>(null);
	const meshes = useRef<Map<number, THREE.Mesh>>(new Map());
	const nextId = useRef(1);

	useEffect(() => {
		const onSpawn = (e: Event) => {
			const ev = e as CustomEvent<{
				x: number;
				y: number;
				kind: "skeleton" | "imp" | "wraith";
			}>;
			const detail = ev.detail;
			const count = 4 + ((Math.random() * 3) | 0); // 4-6
			const baseColor =
				detail.kind === "wraith"
					? 0xa855f7
					: detail.kind === "imp"
						? 0xdc2626
						: 0xd4d4d8; // skeleton: bone white
			const now = performance.now();
			for (let i = 0; i < count; i += 1) {
				const theta = Math.random() * Math.PI * 2;
				const speed = 1.2 + Math.random() * 1.8;
				shardsRef.current.push({
					id: nextId.current++,
					pos: { x: detail.x, y: 1.0, z: detail.y },
					vel: {
						x: Math.cos(theta) * speed,
						y: 1.5 + Math.random() * 1.5,
						z: Math.sin(theta) * speed,
					},
					spin: {
						x: (Math.random() - 0.5) * 8,
						y: (Math.random() - 0.5) * 8,
						z: (Math.random() - 0.5) * 8,
					},
					color: baseColor,
					createdAt: now,
					bounced: false,
				});
			}
			while (shardsRef.current.length > MAX_BODY_SHARDS) {
				shardsRef.current.shift();
			}
		};
		window.addEventListener("objexoom:bodyParts", onSpawn);
		return () => window.removeEventListener("objexoom:bodyParts", onSpawn);
	}, []);

	useFrame((_, dt) => {
		if (!groupRef.current) return;
		const now = performance.now();
		const live: BodyShard[] = [];
		const seen = new Set<number>();
		for (const shard of shardsRef.current) {
			const age = now - shard.createdAt;
			if (age > BODYPART_TTL_MS) continue;
			shard.pos.x += shard.vel.x * dt;
			shard.pos.y += shard.vel.y * dt;
			shard.pos.z += shard.vel.z * dt;
			shard.vel.y -= 10 * dt;
			if (shard.pos.y < 0.1) {
				shard.pos.y = 0.1;
				if (!shard.bounced && shard.vel.y < -0.5) {
					shard.vel.y *= -0.35;
					shard.vel.x *= 0.6;
					shard.vel.z *= 0.6;
					shard.bounced = true;
				} else {
					shard.vel.x *= 0.85;
					shard.vel.z *= 0.85;
					shard.vel.y = 0;
				}
			}
			let mesh = meshes.current.get(shard.id);
			if (!mesh) {
				const m = new THREE.Mesh(
					new THREE.BoxGeometry(0.18, 0.18, 0.18),
					new THREE.MeshStandardMaterial({
						color: shard.color,
						emissive: shard.color,
						emissiveIntensity: 0.25,
						transparent: true,
						roughness: 0.7,
					}),
				);
				groupRef.current.add(m);
				meshes.current.set(shard.id, m);
				mesh = m;
			}
			mesh.position.set(shard.pos.x, shard.pos.y, shard.pos.z);
			mesh.rotation.x += shard.spin.x * dt;
			mesh.rotation.y += shard.spin.y * dt;
			mesh.rotation.z += shard.spin.z * dt;
			const fade = 1 - age / BODYPART_TTL_MS;
			(mesh.material as THREE.MeshStandardMaterial).opacity = fade;
			mesh.visible = true;
			seen.add(shard.id);
			live.push(shard);
		}
		shardsRef.current = live;
		for (const [id, mesh] of meshes.current) {
			if (!seen.has(id)) {
				mesh.visible = false;
				groupRef.current.remove(mesh);
				meshes.current.delete(id);
			}
		}
	});

	return (
		<group
			ref={(node) => {
				groupRef.current = node;
			}}
		/>
	);
}

// M3 — weapon view-model. A chunky stylized weapon mesh anchored to the
// lower-right of the camera viewport. Built from box + cylinder
// primitives in the weapon's palette tint. Each frame the group is
// re-anchored to the camera so the weapon rides the view.
//
// I9 — listens for `objexoom:fire` events to drive a per-weapon recoil:
// view-model offsets along -Z then springs back over 120 ms. Recoil
// distance: pistol 0.04 m, chaingun 0.025 m, shotgun 0.08 m.
const RECOIL_DISTANCE: Record<WeaponId, number> = {
	pistol: 0.04,
	chaingun: 0.025,
	shotgun: 0.08,
};
const RECOIL_DURATION_MS = 120;

/**
 * GLTF-driven first-person weapon viewmodel. The model lives in
 * camera-relative space and gets pose-updated every frame:
 *  - position copies camera.position
 *  - quaternion copies camera.quaternion
 *  - translateX/Y/Z then offset to the screen-right hip pose per model
 *  - recoil adds a forward-then-back z-bounce on objexoom:fire
 *
 * GLB models come from `models.ts`. Each weapon has its own scale +
 * rotation tuned so the muzzle points along camera-forward (-Z).
 */
/**
 * Target on-screen size for the longest axis of any weapon GLB. The
 * viewmodel auto-normalizes each weapon (regardless of its native
 * GLB dimensions) to this length, then applies offset+rotation. That
 * way the per-weapon tuning in models.ts only carries POSE (rotation,
 * offset), not arbitrary scale numbers that get out of sync with the
 * asset.
 */
const VIEWMODEL_TARGET_LENGTH = 0.32;

function WeaponViewmodel({ weapon }: { weapon: WeaponId }) {
	const groupRef = useRef<THREE.Group | null>(null);
	const camera = useThree((s) => s.camera);
	const recoilUntil = useRef(0);
	const model = WEAPON_MODELS[weapon];
	const gltf = useGLTF(model.url);
	const scene = gltf.scene;

	// Normalize size: compute bbox of the loaded GLB, derive scale so
	// the longest axis matches VIEWMODEL_TARGET_LENGTH, and remember
	// the center so we can offset the model into the origin before
	// the camera-relative transform stack.
	const { autoScale, center } = useMemo(() => {
		const bbox = new THREE.Box3().setFromObject(scene);
		const size = new THREE.Vector3();
		bbox.getSize(size);
		const c = new THREE.Vector3();
		bbox.getCenter(c);
		const longest = Math.max(size.x, size.y, size.z, 1e-3);
		return {
			autoScale: VIEWMODEL_TARGET_LENGTH / longest,
			center: c,
		};
	}, [scene]);

	// Fallback material override: USP + Uzi ship without embedded
	// textures and would render pure white. Replace any
	// MeshBasicMaterial-with-no-map (and same for Standard) with a
	// dark metal tinted by the weapon's muzzle color.
	useEffect(() => {
		scene.traverse((node) => {
			if (!(node instanceof THREE.Mesh)) return;
			const m = node.material;
			const isUntexturedStd = m instanceof THREE.MeshStandardMaterial && !m.map;
			const isUntexturedBasic = m instanceof THREE.MeshBasicMaterial && !m.map;
			if (isUntexturedStd || isUntexturedBasic) {
				node.material = new THREE.MeshStandardMaterial({
					color: weapon === "pistol" ? "#3a3a48" : "#1f2230",
					emissive: WEAPONS[weapon].muzzleColor,
					emissiveIntensity: 0.18,
					metalness: 0.7,
					roughness: 0.35,
				});
			}
		});
	}, [scene, weapon]);

	useEffect(() => {
		const onFire = () => {
			recoilUntil.current = performance.now() + RECOIL_DURATION_MS;
		};
		window.addEventListener("objexoom:fire", onFire);
		return () => window.removeEventListener("objexoom:fire", onFire);
	}, []);

	useFrame(() => {
		const group = groupRef.current;
		if (!group) return;
		// Anchor at camera; rotation copies camera.
		group.position.copy(camera.position);
		group.quaternion.copy(camera.quaternion);

		const now = performance.now();
		const remaining = recoilUntil.current - now;
		let recoilOffset = 0;
		if (remaining > 0) {
			const t = 1 - remaining / RECOIL_DURATION_MS;
			recoilOffset = Math.sin(t * Math.PI) * RECOIL_DISTANCE[weapon];
		}

		// In camera-local space:
		//   +X = right, +Y = up, -Z = forward.
		// model.offset = [right, up, forward (negative)] in world-units.
		group.translateX(model.offset[0]);
		group.translateY(model.offset[1]);
		group.translateZ(model.offset[2] + recoilOffset);
	});

	return (
		<group
			ref={(node) => {
				groupRef.current = node;
			}}
		>
			{/* Outer pose: rotate to align barrel with camera-forward */}
			<group rotation={model.rotation} scale={autoScale}>
				{/* Inner re-center: shift the GLB so its bbox center sits
				    at the origin, otherwise off-axis pivots throw the
				    pose. */}
				<group position={[-center.x, -center.y, -center.z]}>
					<primitive object={scene} />
				</group>
			</group>
		</group>
	);
}

// Preload weapon GLBs so the very first swap doesn't stutter.
for (const m of Object.values(WEAPON_MODELS)) useGLTF.preload(m.url);

// I10 — shotgun shell ejection. Listens for `objexoom:shellEject` events
// (dispatched by the fire handler on shotgun shots only) and spawns one
// brass-tipped cylinder shell at the eject point. Each shell has random
// spin + initial velocity, gravity, single ground bounce, and despawns
// after SHELL_TTL_MS.
type Shell = {
	id: number;
	pos: { x: number; y: number; z: number };
	vel: { x: number; y: number; z: number };
	spin: { x: number; y: number; z: number };
	createdAt: number;
	bounced: boolean;
};

const SHELL_TTL_MS = 4000;
const MAX_SHELLS = 40;

function ShellEjectField() {
	const shellsRef = useRef<Shell[]>([]);
	const groupRef = useRef<THREE.Group | null>(null);
	const meshes = useRef<Map<number, THREE.Mesh>>(new Map());
	const nextId = useRef(1);

	useEffect(() => {
		const onEject = (e: Event) => {
			const ev = e as CustomEvent<{
				x: number;
				y: number;
				z: number;
				vx: number;
				vy: number;
				vz: number;
			}>;
			const d = ev.detail;
			shellsRef.current.push({
				id: nextId.current++,
				pos: { x: d.x, y: d.y, z: d.z },
				vel: { x: d.vx, y: d.vy, z: d.vz },
				spin: {
					x: (Math.random() - 0.5) * 12,
					y: (Math.random() - 0.5) * 12,
					z: (Math.random() - 0.5) * 12,
				},
				createdAt: performance.now(),
				bounced: false,
			});
			while (shellsRef.current.length > MAX_SHELLS) shellsRef.current.shift();
		};
		window.addEventListener("objexoom:shellEject", onEject);
		return () => window.removeEventListener("objexoom:shellEject", onEject);
	}, []);

	useFrame((_, dt) => {
		if (!groupRef.current) return;
		const now = performance.now();
		const live: Shell[] = [];
		const seen = new Set<number>();
		for (const shell of shellsRef.current) {
			const age = now - shell.createdAt;
			if (age > SHELL_TTL_MS) continue;
			shell.pos.x += shell.vel.x * dt;
			shell.pos.y += shell.vel.y * dt;
			shell.pos.z += shell.vel.z * dt;
			shell.vel.y -= 9 * dt;
			if (shell.pos.y < 0.05) {
				shell.pos.y = 0.05;
				if (!shell.bounced && shell.vel.y < -0.3) {
					shell.vel.y *= -0.3;
					shell.vel.x *= 0.7;
					shell.vel.z *= 0.7;
					shell.bounced = true;
				} else {
					shell.vel.x *= 0.85;
					shell.vel.z *= 0.85;
					shell.vel.y = 0;
				}
			}
			let mesh = meshes.current.get(shell.id);
			if (!mesh) {
				const m = new THREE.Mesh(
					new THREE.CylinderGeometry(0.025, 0.025, 0.07, 8),
					new THREE.MeshStandardMaterial({
						color: 0xb45309,
						emissive: 0x92400e,
						emissiveIntensity: 0.4,
						metalness: 0.7,
						roughness: 0.35,
						transparent: true,
					}),
				);
				groupRef.current.add(m);
				meshes.current.set(shell.id, m);
				mesh = m;
			}
			mesh.position.set(shell.pos.x, shell.pos.y, shell.pos.z);
			mesh.rotation.x += shell.spin.x * dt;
			mesh.rotation.y += shell.spin.y * dt;
			mesh.rotation.z += shell.spin.z * dt;
			// Fade only in the last 750 ms.
			const fadeStart = SHELL_TTL_MS - 750;
			const fade = age < fadeStart ? 1 : 1 - (age - fadeStart) / 750;
			(mesh.material as THREE.MeshStandardMaterial).opacity = fade;
			mesh.visible = true;
			seen.add(shell.id);
			live.push(shell);
		}
		shellsRef.current = live;
		for (const [id, mesh] of meshes.current) {
			if (!seen.has(id)) {
				mesh.visible = false;
				groupRef.current.remove(mesh);
				meshes.current.delete(id);
			}
		}
	});

	return (
		<group
			ref={(node) => {
				groupRef.current = node;
			}}
		/>
	);
}

// J1 — flashlight. A SpotLight that lives at the camera position and
// points along the camera-forward vector each frame. Cone ≈ 0.5 rad
// half-angle (≈ 28° from center), range ~12 m, brightness 1.4 in the
// weapon's ambient hue (parchment). The light target is also moved
// each frame to a point 8 m ahead of the camera so the cone projects
// where the player is looking.
function Flashlight() {
	const camera = useThree((s) => s.camera);
	const spotRef = useRef<THREE.SpotLight | null>(null);
	const targetRef = useRef<THREE.Object3D | null>(null);

	useFrame(() => {
		const spot = spotRef.current;
		const target = targetRef.current;
		if (!spot || !target) return;
		spot.position.copy(camera.position);
		const forward = new THREE.Vector3(0, 0, -1)
			.applyQuaternion(camera.quaternion)
			.normalize();
		target.position.set(
			camera.position.x + forward.x * 8,
			camera.position.y + forward.y * 8,
			camera.position.z + forward.z * 8,
		);
		spot.target = target;
	});

	return (
		<>
			<spotLight
				ref={spotRef}
				intensity={1.4}
				distance={12}
				angle={0.5}
				penumbra={0.3}
				decay={1.5}
				color="#fef3c7"
				castShadow
				shadow-mapSize={[1024, 1024]}
				shadow-camera-near={0.2}
				shadow-camera-far={14}
				shadow-bias={-0.0005}
			/>
			<object3D
				ref={(node) => {
					targetRef.current = node;
				}}
			/>
		</>
	);
}
