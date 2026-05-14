import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type * as Yuka from "yuka";
import { pickArchetype } from "./archetype";
import { type Barrel, resolveExplosion, spawnBarrels } from "./barrels";
import { PLAYER_HEIGHT, TILE } from "./constants";
import { OBJEXOOM_PALETTE } from "./design-tokens";
import {
	computePortalEdges,
	ENEMY_BULLET_DAMAGE,
	type Enemy,
	type EnemyBullet,
	isSectorMap,
	type ObjexoomMap,
	type Pickup,
	polygonContains,
	spawnEnemies,
	spawnPickups,
	stepEnemyBullet,
} from "./engine";
import { addObjexoomListener, dispatch } from "./events";
import { type LampInstance, spawnLamps } from "./lampScatter";
import type { GameRef, LevelPhase, WeaponState } from "./ObjexoomShell";
import { PlayerController } from "./PlayerController";
import { type DebrisInstance, spawnDebris } from "./scatter/debrisScatter";
import { type FloorTileInstance, spawnFloorTiles } from "./scatter/floorTiles";
import { type PropInstance, spawnProps } from "./scatter/propScatter";
import {
	AdaptiveResolution,
	BarrelMesh,
	BodyPartField,
	BulletField,
	DebrisField,
	EnemyMesh,
	ExitPortal,
	Flashlight,
	FloorTileField,
	KeyMarker,
	LampField,
	MapGeometry,
	ParticleBurstField,
	PickupMesh,
	PropField,
	RealDoor,
	SecretField,
	SectorMapGeometry,
	ShellEjectField,
	TreasureChest,
	WeaponViewmodel,
} from "./scene";
import { tickEnemyLoop } from "./scene/hooks/enemyTickLoop";
import { resolveFire } from "./scene/hooks/fireResolution";
import { type Secret, spawnSecrets } from "./secrets";
import { DIFFICULTY_TUNING, type ObjexoomSettings } from "./settings";
import {
	playBoom,
	playHurt,
	playPickup,
	playPortal,
	setAmbientArchetype,
	setAmbientPhase,
	stopAmbient,
} from "./sfx";
import type { WeaponId } from "./weapons";
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
	// E6 — secret switches/walls for the current map. Grid maps don't
	// carry secrets in this slice; sector maps may have a `secrets` field
	// that lists 1+ SecretSpec. spawnSecrets initializes the runtime
	// state (triggered=false, liftProgress=0) per Spec.
	const secretsRef = useRef<Secret[]>(
		isSectorMap(map) && map.secrets ? spawnSecrets(map.secrets) : [],
	);
	// COV1 — per-map lamp scatter from PSX Mega Pack II Light Sources.
	// Sector maps only in this slice; grid maps return []. E4 will flip
	// the lit-subset's `on` flag and wire pointLights.
	const lampsRef = useRef<LampInstance[]>(spawnLamps(map));
	// E13 step-1 — pick the map's archetype deterministically from
	// `map.seed % 5`. Step-1 only wires the prop-pool axis; future
	// steps will add lighting palette + enemy mix + SFX bed axes per
	// PRD §E13. The archetype is constant for the lifetime of the
	// Scene mount (re-keyed on level change).
	const archetype = useMemo(() => pickArchetype(map), [map]);
	// COV4 + E3 — per-map decorative prop scatter, now using E13's
	// per-map archetype pick instead of the hardcoded "corridor".
	const propsRef = useRef<PropInstance[]>(spawnProps(map, archetype));
	// COV3 step-1 — modular asphalt floor tiles. Empty unless the map
	// opts in via `useModularFloor: true`. Currently only refLevel 0
	// sets the flag; the procedural floor stays everywhere else.
	const floorTilesRef = useRef<FloorTileInstance[]>(spawnFloorTiles(map));
	// COV5 step-2 — sector-body debris scatter. 3-5 piles per non-spawn
	// sector, 4-tile skip-radius from anchors. Reads as "this place has
	// been overrun."
	const debrisRef = useRef<DebrisInstance[]>(spawnDebris(map));
	// E2 — reactive "all bosses dead" flag that the visual portal/door
	// components read so they don't appear open while a boss is still
	// alive. Initialized true when the map has no bosses (single source
	// of truth: enemiesRef at mount time). The per-frame loop flips it
	// when the last boss dies. Reviewer-caught issue from E2 review.
	const [allBossesDead, setAllBossesDead] = useState(
		() => !enemiesRef.current.some((e) => e.tier === "boss"),
	);
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
		return addObjexoomListener("playerHit", () => {
			dispatch({
				type: "burst",
				x: camera.position.x,
				y: camera.position.z,
				kind: "playerHit",
			});
		});
	}, [camera]);

	// E11 — push the per-map archetype to the ambient bed on mount.
	// Each archetype shifts the drone's pitch + base volume so different
	// runs sound distinct. The picker (E13) already chose the archetype;
	// this just plumbs it to sfx.
	useEffect(() => {
		setAmbientArchetype(archetype);
	}, [archetype]);

	// E11 — phase-reactive ambient volume. `out` plays the archetype
	// base; `going_back` swells +6dB so the "everything aggros" beat
	// reads sonically too. The actual stopAmbient() in the going_back
	// useEffect below still fires (the explosion stinger marks the
	// flip), but `setAmbientPhase` would otherwise hold the swell across
	// the phase boundary if a future commit removes the stopAmbient.
	useEffect(() => {
		setAmbientPhase(phase === "going_back" ? "going_back" : "out");
	}, [phase]);

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
			// E2 — portal stays locked until every boss enemy is dead, even
			// if the key has been collected. Sync the reactive flag on the
			// same tick so the visual portal/door reflects the gate state.
			const allBossesDeadNow = enemiesRef.current.every((e) => e.tier !== "boss" || e.dead);
			if (allBossesDeadNow !== allBossesDead) setAllBossesDead(allBossesDeadNow);
			if (hasKey && allBossesDeadNow && dxExit * dxExit + dyExit * dyExit < TILE * TILE * 0.4) {
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
				dispatch({
					type: "burst",
					x: pickup.position.x,
					y: pickup.position.y,
					kind: "pickup",
				});
			}
		}

		// ARCH2a — per-frame enemy AI loop lives in src/scene/hooks/enemyTickLoop.ts.
		// Behavior is byte-identical; this call site is a pure relocation.
		tickEnemyLoop({
			enemiesRef,
			yukaEntitiesRef,
			bulletsRef,
			nextBulletIdRef,
			enemyMeshesRef: enemyMeshes,
			lastSeenRef,
			aggroFiredRef,
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
		});

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
		const teardownKill = addObjexoomListener("debugKillAll", onDebugKillAll);
		const teardownCollect = addObjexoomListener("debugCollectPickups", onDebugCollectPickups);
		return () => {
			teardownKill();
			teardownCollect();
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
			dispatch({ type: "burst", x: result.position.x, y: result.position.y, kind: "explode" });
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
					dispatch({
						type: "bodyParts",
						x: enemy.position.x,
						y: enemy.position.y,
						kind: enemy.kind,
					});
				}
			}
			if (result.hitsPlayer) {
				gameRef.current.onHit(result.playerDamage);
				dispatch({ type: "playerHit" });
			}
			// Enqueue chain barrels; the loop above pops them in turn.
			for (const chainId of result.chainBarrelIds) {
				const chain = barrelsRef.current.find((bb) => bb.id === chainId);
				if (chain && !chain.exploded) queue.push(chain);
			}
		}
	};

	// ARCH2b — single-shot resolution moved to src/scene/hooks/fireResolution.ts.
	// The useEffect that wires `objexoom:fire` stays here (it owns the
	// listener lifecycle); the body is one call into the pure helper.
	// biome-ignore lint/correctness/useExhaustiveDependencies: refs are mutable and shouldn't trigger re-subscribe; matches the imperative ref pattern.
	useEffect(() => {
		const onFire = () => {
			resolveFire({
				active,
				weapon,
				now: performance.now(),
				camera,
				map,
				settings,
				ammoRef,
				gameRef,
				enemiesRef,
				barrelsRef,
				secretsRef,
				enemyMeshesRef: enemyMeshes,
				collisionCtxRef,
				lastFireAtRef: lastFireAt,
				muzzleFlashUntilRef: muzzleFlashUntil,
				muzzleColorRef,
				explodeBarrel: (b) => explodeBarrelRef.current(b),
			});
		};

		return addObjexoomListener("fire", onFire);
	}, [active, camera, map, hasKey, gameRef, weapon, ammoRef, settings]);

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
			<ExitPortal
				position={map.exitPosition}
				unlocked={hasKey && allBossesDead}
				hueIndex={(map.seed >>> 0) % 5}
			/>
			<RealDoor position={map.exitPosition} unlocked={hasKey && allBossesDead} mapSeed={map.seed} />
			<TreasureChest position={map.exitPosition} />
			{/* H8 — second RealDoor at the original spawn. Opens during the
			    going_back phase so the player has a clear visual goal to
			    sprint toward while every enemy aggros. */}
			<RealDoor
				position={map.playerSpawn}
				unlocked={phase === "going_back"}
				mapSeed={map.seed ^ 0x676f6e67 /* "gong" tag — different variant for the spawn-side door */}
			/>

			{/* E6 — secret switches + their hidden walls. Empty when the
			    current map has no `secrets` field (grid maps + future
			    secret-free ref levels). */}
			<SecretField secretsRef={secretsRef} />

			{/* COV1 — PSX Mega Pack II lamp scatter. Empty on grid maps
			    in this slice. E4 will flip a subset to `on` + wire
			    scoped pointLights. */}
			<LampField lamps={lampsRef.current} />

			{/* COV4 + E3 — decorative prop scatter from PSX Mega Pack II
			    Props pool. Step-1: "corridor" archetype default for
			    every sector; E13 will pick archetypes per map.seed. */}
			<PropField props={propsRef.current} />

			{/* COV3 step-1 — modular asphalt floor tiles. Empty unless
			    the map opts in via `useModularFloor: true`. */}
			<FloorTileField tiles={floorTilesRef.current} />

			{/* COV5 step-2 — sector-body debris scatter (3-5 per sector,
			    skip-radius 4 from spawn/exit/key). Reads as "overrun." */}
			<DebrisField debris={debrisRef.current} />

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
			<WeaponViewmodel weapon={weapon} mapSeed={map.seed} onMuzzleAnchor={onMuzzleAnchor} />

			<PlayerController map={map} active={active} hasKey={hasKey} settings={settings} />

			{/* E12/PA16 — adaptive pixel ratio. Lives inside Canvas so it
			    can call useFrame + useThree.gl.setPixelRatio directly. */}
			<AdaptiveResolution onUpdate={(info) => dispatch({ type: "fpsUpdate", ...info })} />

			<EffectComposer>
				<Bloom intensity={0.45} luminanceThreshold={0.55} luminanceSmoothing={0.2} />
				<ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.0015, 0.0015]} />
				<Vignette eskil={false} offset={0.25} darkness={0.7} />
			</EffectComposer>
		</>
	);
}
