import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type * as Yuka from "yuka";
import { type Barrel, pickRayBarrel, resolveExplosion, spawnBarrels } from "./barrels";
import {
	PLAYER_HEIGHT,
	SKELETON_ATTACK_COOLDOWN_MS,
	SKELETON_ATTACK_RANGE,
	SKELETON_DAMAGE,
	TILE,
} from "./constants";
import { OBJEXOOM_PALETTE } from "./design-tokens";
import { tickEnemyFsm } from "./enemyAi";
import {
	castRayAny,
	computePortalEdges,
	ENEMY_BULLET_DAMAGE,
	type Enemy,
	type EnemyBullet,
	hasLineOfSightAny,
	makeEnemyBullet,
	type ObjexoomMap,
	type Pickup,
	polygonContains,
	resolveCollisionAny,
	spawnEnemies,
	spawnPickups,
	stepEnemyBullet,
} from "./engine";
import type { GameRef, LevelPhase, WeaponState } from "./ObjexoomShell";
import { PlayerController } from "./PlayerController";
import {
	AdaptiveResolution,
	BarrelMesh,
	BodyPartField,
	BulletField,
	EnemyMesh,
	ExitPortal,
	Flashlight,
	KeyMarker,
	MapGeometry,
	ParticleBurstField,
	PickupMesh,
	RealDoor,
	SectorMapGeometry,
	ShellEjectField,
	TreasureChest,
	WeaponViewmodel,
} from "./scene";
import { DIFFICULTY_TUNING, type ObjexoomSettings } from "./settings";
import {
	panForPosition,
	playAggroAlert,
	playBoom,
	playChaingun,
	playHurt,
	playMelee,
	playPickup,
	playPistol,
	playPortal,
	playShotgun,
	playSkeletonDeath,
	stopAmbient,
} from "./sfx";
import { WEAPONS, type WeaponId } from "./weapons";
import { clearYuka, makeYukaEntityAt, removeYukaEntity, tickYuka } from "./yukaIntegration";

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
	const barrelsRef = useRef<Barrel[]>(spawnBarrels(map));
	const enemyMeshes = useRef<Map<number, THREE.Group>>(new Map());
	const pickupMeshes = useRef<Map<number, THREE.Group>>(new Map());
	const barrelMeshes = useRef<Map<number, THREE.Group>>(new Map());
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

	// I11 — muzzle-flash light. Fires on every shot at the weapon's
	// barrel tip (PA-MOD7 / D11) in the weapon's muzzleColor; intensity
	// decays over ~80 ms.
	const muzzleLightRef = useRef<THREE.PointLight | null>(null);
	const muzzleFlashUntil = useRef(0);
	const muzzleColorRef = useRef<THREE.Color>(new THREE.Color("#6172f3"));
	// PA-MOD7 — the WeaponViewmodel registers its muzzle-anchor group
	// here; per-frame we copy its world-position into muzzleLightRef so
	// the flash bloom originates from the barrel tip rather than the
	// camera. Falls back to camera.position when the ref is null (very
	// first frame after weapon swap, or in test harnesses with no GLB).
	const muzzleAnchorRef = useRef<THREE.Group | null>(null);
	const muzzleWorldPos = useMemo(() => new THREE.Vector3(), []);
	// Stable callback identity so WeaponViewmodel's `useEffect(..., [onMuzzleAnchor])`
	// cleanup doesn't re-run (and briefly null muzzleAnchorRef) on every
	// parent render unrelated to a weapon swap. Reviewer-caught issue from
	// PA-MOD7 review of 2f3369d.
	const onMuzzleAnchor = useCallback((group: THREE.Group | null) => {
		muzzleAnchorRef.current = group;
	}, []);

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
		() => (map.kind === "sectors" ? computePortalEdges(map) : new Set<string>()),
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
		// linearly fades to 0 over the remaining window. PA-MOD7 / D11:
		// position tracks the WeaponViewmodel's muzzle anchor (the actual
		// barrel tip in the GLB), falling back to camera.position when no
		// anchor is registered yet.
		if (muzzleLightRef.current) {
			const muzzleNow = now;
			const remaining = muzzleFlashUntil.current - muzzleNow;
			const intensity = remaining > 0 ? Math.min(4, remaining / 20) : 0;
			muzzleLightRef.current.intensity = intensity;
			muzzleLightRef.current.color.copy(muzzleColorRef.current);
			const anchor = muzzleAnchorRef.current;
			if (anchor) {
				anchor.getWorldPosition(muzzleWorldPos);
				muzzleLightRef.current.position.copy(muzzleWorldPos);
			} else {
				muzzleLightRef.current.position.set(
					camera.position.x,
					camera.position.y,
					camera.position.z,
				);
			}
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
				if (polygonContains({ x: px, y: py + 1e-6 }, sector.vertices)) {
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
				const helped = allEnemies.find((e) => e.id === helpId);
				if (helped && !helped.dead) helped.fsmState = 1;
			}

			if (out.moveTarget) {
				enemy.position = wraith
					? out.moveTarget
					: resolveCollisionAny(out.moveTarget, map, collisionCtxRef.current, 0.5);
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
			const step = stepEnemyBullet(bullet, dt, now, playerPos, map, collisionCtxRef.current);
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
		window.addEventListener("objexoom:debugCollectPickups", onDebugCollectPickups);
		return () => {
			window.removeEventListener("objexoom:debugKillAll", onDebugKillAll);
			window.removeEventListener("objexoom:debugCollectPickups", onDebugCollectPickups);
		};
	}, [gameRef]);

	// E5 — barrel explosion handler. Lives behind a ref so the fire-path
	// (also a ref-closure) can call it without re-subscribing the
	// useEffect listener every weapon swap. Chain reactions are
	// processed as a queue so a barrel that ignites three neighbors
	// doesn't recurse arbitrarily deep on the JS stack.
	const explodeBarrelRef = useRef<(barrel: Barrel) => void>(() => {});
	explodeBarrelRef.current = (initial: Barrel) => {
		const queue: Barrel[] = [initial];
		while (queue.length > 0) {
			const b = queue.shift();
			if (!b || b.exploded) continue;
			b.exploded = true;
			const mesh = barrelMeshes.current.get(b.id);
			if (mesh) mesh.visible = false;
			const result = resolveExplosion(b, enemiesRef.current, barrelsRef.current, {
				x: camera.position.x,
				y: camera.position.z,
			});
			window.dispatchEvent(
				new CustomEvent("objexoom:burst", {
					detail: { x: result.position.x, y: result.position.y, kind: "explode" },
				}),
			);
			if (settings.soundEnabled) playBoom();
			// Apply AoE enemy damage. Killed enemies emit body-parts +
			// kill counter just like a weapon hit.
			for (const enemyId of result.affectedEnemyIds) {
				const enemy = enemiesRef.current.find((e) => e.id === enemyId);
				if (!enemy || enemy.dead) continue;
				enemy.hp -= result.enemyDamage;
				if (enemy.hp <= 0) {
					enemy.dead = true;
					gameRef.current.onKill();
					const enemyMesh = enemyMeshes.current.get(enemy.id);
					if (enemyMesh) enemyMesh.visible = false;
					window.dispatchEvent(
						new CustomEvent("objexoom:bodyParts", {
							detail: { x: enemy.position.x, y: enemy.position.y, kind: enemy.kind },
						}),
					);
				}
			}
			if (result.hitsPlayer) {
				gameRef.current.onHit(result.playerDamage);
				window.dispatchEvent(new CustomEvent("objexoom:playerHit"));
			}
			// Enqueue chain barrels; the loop above pops them in turn.
			for (const chainId of result.chainBarrelIds) {
				const chain = barrelsRef.current.find((bb) => bb.id === chainId);
				if (chain && !chain.exploded) queue.push(chain);
			}
		}
	};

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

			if (weapon === "melee") playMelee();
			else if (weapon === "pistol") playPistol();
			else if (weapon === "chaingun") playChaingun();
			else playShotgun();

			// I10 / PA9b — shell ejection. Shotgun ejects one large brass
			// shell per trigger pull; chaingun ejects a smaller shell on
			// every individual pulse (~11/sec at 90ms cooldown). Both
			// flick to the camera's right with random spin; gravity +
			// ground bounce; 4 s despawn via ShellEjectField.
			if (weapon === "shotgun" || weapon === "chaingun") {
				const isChaingun = weapon === "chaingun";
				const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
				// Chaingun shells lateral velocity is a touch lower so the
				// dense stream doesn't fling shells halfway across the room.
				const lateral = isChaingun ? 1.0 : 1.6;
				const upward = isChaingun ? 0.9 : 1.2;
				const scale = isChaingun ? 0.6 : 1.0;
				window.dispatchEvent(
					new CustomEvent("objexoom:shellEject", {
						detail: {
							x: camera.position.x + right.x * 0.3,
							y: camera.position.y - 0.3,
							z: camera.position.z + right.z * 0.3,
							vx: right.x * lateral + (Math.random() - 0.5) * 0.4,
							vy: upward,
							vz: right.z * lateral + (Math.random() - 0.5) * 0.4,
							scale,
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
				// E5 — barrel hit-test. Barrels are closer-than-enemy targets in
				// the priority chain: if a barrel sits in the ray before the
				// nearest enemy, the barrel takes the pellet instead. Wins ties.
				const barrelHit = pickRayBarrel(origin, dir2, barrelsRef.current, bestDist);
				if (barrelHit && barrelHit.dist <= bestDist) {
					barrelHit.barrel.hp -= spec.damage;
					window.dispatchEvent(
						new CustomEvent("objexoom:burst", {
							detail: {
								x: barrelHit.barrel.position.x,
								y: barrelHit.barrel.position.y,
								kind: "damage",
							},
						}),
					);
					if (barrelHit.barrel.hp <= 0 && !barrelHit.barrel.exploded) {
						explodeBarrelRef.current(barrelHit.barrel);
					}
					// Pellet consumed — skip the enemy-damage block below.
					continue;
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
			<hemisphereLight args={[OBJEXOOM_PALETTE.indigo, OBJEXOOM_PALETTE.ink, 0.35]} />
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
			<ExitPortal position={map.exitPosition} unlocked={hasKey} hueIndex={(map.seed >>> 0) % 5} />
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

			{barrelsRef.current.map((barrel) => (
				<BarrelMesh
					key={barrel.id}
					barrel={barrel}
					register={(group) => {
						if (group) barrelMeshes.current.set(barrel.id, group);
						else barrelMeshes.current.delete(barrel.id);
					}}
				/>
			))}

			<BulletField bulletsRef={bulletsRef} register={bulletMeshes} />
			<ParticleBurstField />
			<BodyPartField />
			<ShellEjectField />
			<WeaponViewmodel weapon={weapon} onMuzzleAnchor={onMuzzleAnchor} />

			<PlayerController map={map} active={active} hasKey={hasKey} settings={settings} />

			{/* E12/PA16 — adaptive pixel ratio. Lives inside Canvas so it
			    can call useFrame + useThree.gl.setPixelRatio directly. */}
			<AdaptiveResolution
				onUpdate={(info) =>
					window.dispatchEvent(new CustomEvent("objexoom:fpsUpdate", { detail: info }))
				}
			/>

			<EffectComposer>
				<Bloom intensity={0.45} luminanceThreshold={0.55} luminanceSmoothing={0.2} />
				<ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.0015, 0.0015]} />
				<Vignette eskil={false} offset={0.25} darkness={0.7} />
			</EffectComposer>
		</>
	);
}
