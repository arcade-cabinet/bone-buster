import { remapEnemyMix } from "@ai/enemyMix";
import { clearYuka, makeYukaEntityAt, removeYukaEntity, tickYuka } from "@ai/yukaIntegration";
import { preloadTier2MapMount, preloadTier3Deferred } from "@assets/preload";
import {
	playBoom,
	playBossDeath,
	playHurt,
	playPickup,
	playPortal,
	playSkeletonDeath,
	setAmbientArchetype,
	setAmbientPhase,
	stopAmbient,
} from "@audio/sfx";
import { PlayerController } from "@components/PlayerController";
import {
	type BoneBusterMap,
	computePortalEdges,
	ENEMY_BULLET_DAMAGE,
	type Enemy,
	type EnemyBullet,
	isSectorMap,
	type Pickup,
	polygonContains,
	spawnEnemies,
	spawnPickups,
	stepEnemyBullet,
} from "@engine/engine";
import { addBoneBusterListener, dispatch } from "@engine/events";
import { useFrame, useThree } from "@react-three/fiber";
import { getArchetypeLightPalette } from "@scene/lighting/archetypePalette";
import { PLAYER_HEIGHT, TILE } from "@shared/constants";
import type { WeaponId } from "@shared/weapons";
import { type BoneBusterSettings, DIFFICULTY_TUNING } from "@store/settings";
import type { GameRef, LevelPhase, WeaponState } from "@views/Shell";
import { pickArchetype } from "@world/archetype";
import { type Barrel, resolveExplosion, spawnBarrels } from "@world/barrels";
import { type LampInstance, spawnLamps } from "@world/lampScatter";
import { type DebrisInstance, spawnDebris } from "@world/scatter/debrisScatter";
import { type DecalInstance, spawnDecals } from "@world/scatter/decalScatter";
import { type FloorTileInstance, spawnFloorTiles } from "@world/scatter/floorTiles";
import { type KitchenInstance, spawnKitchen } from "@world/scatter/kitchenScatter";
import {
	blockerCirclesOf,
	type LargePropInstance,
	spawnLargeProps,
} from "@world/scatter/largePropScatter";
import { lootPickupSpawn } from "@world/scatter/lootScatter";
import { type NatureInstance, spawnNature } from "@world/scatter/natureScatter";
import { type NpcInstance, spawnNpcs } from "@world/scatter/npcScatter";
import { type PropInstance, spawnProps } from "@world/scatter/propScatter";
import {
	disarmSector,
	spawnTraps,
	TRAP_OVERLAP_RADIUS,
	TRAP_TICK_COOLDOWN_MS,
	TRAP_TICK_DAMAGE,
	TRIGGER_OVERLAP_RADIUS,
	type TrapInstance,
	trapAt,
	triggerAt,
} from "@world/scatter/trapScatter";
import { type Secret, spawnSecrets } from "@world/secrets";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type * as Yuka from "yuka";
import {
	AdaptiveResolution,
	BarrelMesh,
	BodyPartField,
	BulletField,
	CrucifixField,
	DamageNumberField,
	DebrisField,
	DecalField,
	EnemyHitFlash,
	EnemyMesh,
	EnemyUvBaseHide,
	EnemyUvReveal,
	ExitPortal,
	ExitPortalApproach,
	Flashlight,
	FloorTileField,
	KeyMarker,
	KitchenField,
	LampField,
	LargePropField,
	MapGeometry,
	NatureField,
	NpcField,
	ParticleBurstField,
	PickupMesh,
	PostprocessingChain,
	PropField,
	RealDoor,
	ReturnToSpawnBearingWriter,
	SecretField,
	SectorMapGeometry,
	ShellEjectField,
	TrapField,
	TreasureChest,
	UvFlashlight,
	VehicleWreck,
	WeaponSwapDip,
	WeaponViewmodel,
} from "../../src/scene";
import { tickEnemyLoop } from "../../src/scene/tick/enemyTickLoop";
import { resolveFire } from "../../src/scene/tick/fireResolution";
import { createTimeScaleBus } from "../../src/scene/tick/timeScaleBus";
import { pickChaingunProfile } from "../../src/world/chaingunSkins";
import {
	CRUCIFIX_LIFETIME_MS,
	type CrucifixInstance,
	pickEmfReading,
	pickSpiritBoxPhoneme,
	SPIRIT_BOX_COOLDOWN_MS,
	SPIRIT_BOX_TRIGGER_RADIUS,
} from "../../src/world/ghostHunting";
import { pickMeleeProfile } from "../../src/world/meleeSkins";
import { pickPistolProfile } from "../../src/world/pistolSkins";

type SceneProps = Readonly<{
	map: BoneBusterMap;
	active: boolean;
	hasKey: boolean;
	gameRef: RefObject<GameRef>;
	weapon: WeaponId;
	ammoRef: RefObject<WeaponState>;
	settings: BoneBusterSettings;
	// H8 — drives going_back behavior (re-aggro, strobe, return-to-spawn).
	phase: LevelPhase;
	// J1 — flashlight ownership. When false, ambient/directional drop to
	// near-dark; when true, a SpotLight tracks camera yaw + pitch.
	hasFlashlight: boolean;
	// PB5 step-2 — EMF reader ownership. When false, the Scene skips
	// the per-frame nearest-enemy distance calc and dispatches no
	// emfReading events; the HUD chip stays hidden.
	hasEmfReader: boolean;
	// PC2 — Spirit box ownership. When false, the Scene skips the
	// per-frame nearest-enemy proximity check + cooldown tracking and
	// dispatches no spiritBoxResponse events; the HUD bubble stays hidden.
	hasSpiritBox: boolean;
	// PC3 — UV flashlight ownership. When true, the UV SpotLight mounts
	// and uvHidden enemies run the per-frame reveal check. When false,
	// uvHidden enemies run a one-shot baseline-hide on mount.
	hasUvFlashlight: boolean;
}>;

export function BoneBusterScene({
	map,
	active,
	hasKey,
	gameRef,
	weapon,
	ammoRef,
	settings,
	phase,
	hasFlashlight,
	hasEmfReader,
	hasSpiritBox,
	hasUvFlashlight,
}: SceneProps) {
	const tuning = DIFFICULTY_TUNING[settings.difficulty];
	// E13 step-3 — per-archetype enemy mix. Remap spawn `kind`s through
	// the archetype's weight table before spawnEnemies consumes them.
	// pickArchetype is pure + trivial; safe to call inline for the
	// useRef initializer.
	const initialEnemies = spawnEnemies(
		map,
		remapEnemyMix(map.enemySpawns, pickArchetype(map), map.seed),
	).map((e) => {
		const scaledHp = Math.max(1, Math.round(e.hp * tuning.enemyHpMultiplier));
		return { ...e, hp: scaledHp, maxHp: scaledHp };
	});
	const enemiesRef = useRef<Enemy[]>(initialEnemies);
	// COV12 step-2 — exactly 1 loot pickup per sector map at the far-
	// centroid. Appended to the base spawnPickups output with a stable
	// id derived from the base length so collected/un-collected tracking
	// stays consistent across reloads of the same seed.
	const initialPickups = ((): Pickup[] => {
		const base = spawnPickups(map);
		const loot = lootPickupSpawn(map);
		if (loot === null) return base;
		return [
			...base,
			{ id: base.length, kind: loot.kind, position: { ...loot.position }, collected: false },
		];
	})();
	const pickupsRef = useRef<Pickup[]>(initialPickups);
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
	// E13 step-2 — per-archetype lighting palette tint. The corridor
	// entry preserves the pre-step-2 literal colors so refLevel 0's
	// canonical screenshots stay byte-stable; the other 4 archetypes
	// each pull a contrasting ambient + directional pair.
	const lightPalette = useMemo(() => getArchetypeLightPalette(archetype), [archetype]);
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
	// COV2 step-2 — anchor-piece large-prop scatter. 1-2 per sector,
	// sparser than props/debris. The 2 blocking variants opt into
	// circle collision via the blockers list fed to resolveCollisionAny.
	const largePropsRef = useRef<LargePropInstance[]>(spawnLargeProps(map));
	const largePropBlockers = useMemo(() => blockerCirclesOf(largePropsRef.current), []);
	// COV13 step-2 — library-archetype kitchen scatter. Empty list on
	// non-library maps. 20% of library sectors get 1-3 kitchen props.
	const kitchenRef = useRef<KitchenInstance[]>(spawnKitchen(map));
	// COV11 step-2 — courtyard-archetype nature scatter. Empty list on
	// non-courtyard maps. Each instance is a scaled-down clone of the
	// Mega_Nature.glb aggregate (4-8 per sector, varied yaw + scale).
	const natureRef = useRef<NatureInstance[]>(spawnNature(map));
	// COV14 step-2 — library-archetype ambient NPC scatter. Empty list on
	// non-library maps. NPCs are pure set-dressing (no AI, no LOS, no
	// damage). 0-2 chibis per library sector picked deterministically.
	const npcsRef = useRef<NpcInstance[]>(spawnNpcs(map));
	// COV8 step-2 — per-map trap scatter (hazards + triggers per sector).
	// Tick damage + lever-disarm-sector handled in the main per-frame loop.
	const trapsRef = useRef<TrapInstance[]>(spawnTraps(map));
	// Per-trap last-tick timestamp so the player takes one damage pulse
	// per TRAP_TICK_COOLDOWN_MS while overlapping a hazard.
	const lastTrapTickAt = useRef<Map<number, number>>(new Map());
	// COV6 step-2 — wall-face decal scatter. 0-2 decals per sector edge
	// via tile hash, aggregate ≥3 per sector across edges.
	const decalsRef = useRef<DecalInstance[]>(spawnDecals(map));
	// COV10 step-2 — courtyard-archetype RV wreck. Placed at the
	// centroid of the sector farthest from playerSpawn (the hero
	// position the boss also uses). Null on non-courtyard maps.
	const wreckPosition = useMemo(() => {
		if (archetype !== "courtyard") return null;
		if (!isSectorMap(map) || map.sectors.length === 0) return null;
		let best = map.sectors[0];
		let bestDistSq = Number.NEGATIVE_INFINITY;
		for (const sector of map.sectors) {
			let cx = 0;
			let cy = 0;
			for (const v of sector.vertices) {
				cx += v.x;
				cy += v.y;
			}
			cx /= sector.vertices.length;
			cy /= sector.vertices.length;
			const dx = cx - map.playerSpawn.x;
			const dy = cy - map.playerSpawn.y;
			const d2 = dx * dx + dy * dy;
			if (d2 > bestDistSq) {
				bestDistSq = d2;
				best = sector;
			}
		}
		let cx = 0;
		let cy = 0;
		for (const v of best.vertices) {
			cx += v.x;
			cy += v.y;
		}
		return { x: cx / best.vertices.length, y: cy / best.vertices.length };
	}, [archetype, map]);
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

	// A4 — tiered preload entry point. Tier 2 (everything needed
	// for the first frame: walls + roster + props + ...) fires
	// synchronously on mount. Tier 3 (decals + debris + nature +
	// kitchen + npcs + traps + wrecks) is deferred via
	// `setTimeout(0)` so it lands after the first paint instead of
	// contending with map-mount fetches.
	// useGLTF.preload dedupes internally so repeated mounts (e.g.
	// per-level scene re-keys) are no-ops.
	useEffect(() => {
		preloadTier2MapMount();
		const handle = setTimeout(() => {
			preloadTier3Deferred();
		}, 0);
		return () => clearTimeout(handle);
	}, []);

	// I11 — muzzle-flash light. Fires on every shot at the weapon's
	// barrel tip (PA-MOD7 / D11) in the weapon's muzzleColor; intensity
	// decays over ~80 ms.
	const muzzleLightRef = useRef<THREE.PointLight | null>(null);
	const muzzleFlashUntil = useRef(0);
	const muzzleColorRef = useRef<THREE.Color>(new THREE.Color("#6172f3"));
	// POL13 — per-weapon bloom tier multiplier set on every shot by
	// fireResolution; muzzle decay block applies it to base intensity.
	const muzzleIntensityScaleRef = useRef(1.0);
	// POL35 — time-scale bus. POL12 hitstop and POL22 key-acquire both
	// reserve on this bus; enemyTickLoop reads only the combined scale.
	// fireResolution + onDebugKill reserve "hitstop" on enemy kills;
	// FlashlightAcquired/KeyAcquired listeners reserve "key-acquire" via
	// the slot pattern.
	const timeScaleBusRef = useRef(createTimeScaleBus());
	// POL20 — shared Y-offset ref between WeaponSwapDip (writer) and
	// WeaponViewmodel (reader). Slot architecture: the dip animation
	// lives in its own component, the viewmodel just reads the value.
	const weaponSwapDipOffsetRef = useRef(0);
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
	// POL36 — track which boss-tier enemies have already dispatched the
	// "BOSS APPROACHES" banner. Per-Scene-instance (resets on level
	// remount), so a 2nd visit to the same map fires the banner fresh.
	const bossSpottedFiredRef = useRef<Set<number>>(new Set());

	// Y3 — player velocity for bouncer Pursuit lead-target. Computed from the
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
		return addBoneBusterListener("playerHit", () => {
			dispatch({
				type: "burst",
				x: camera.position.x,
				y: camera.position.z,
				kind: "playerHit",
			});
		});
	}, [camera]);

	// POL35 — key-acquire reservation on the time-scale bus. POL22 punted
	// the slow-mo on key pickup because timeScale needed a single owner;
	// the bus IS that owner. 0.55× for 220ms — distinct from kill hitstop
	// (0.05× for 80ms) so a player can feel the difference between "you
	// killed something heavy" and "you got the key".
	useEffect(() => {
		return addBoneBusterListener("keyPickedUp", () => {
			timeScaleBusRef.current.reserve("key-acquire", 0.55, performance.now() + 220);
		});
	}, []);

	// PC4 — active crucifix list. Mutated in-place by the
	// `crucifixPlace` listener (push new) and the per-frame expiry
	// pruner (filter out expired). useRef-backed so the per-tick
	// reads + enemy-tick reads don't trigger React re-renders, and
	// the CrucifixField re-render is gated by a counter ref + a
	// setState bump from the listener.
	const activeCrucifixesRef = useRef<CrucifixInstance[]>([]);
	const crucifixIdCounterRef = useRef(0);
	const [crucifixesVersion, setCrucifixesVersion] = useState(0);

	useEffect(() => {
		return addBoneBusterListener("crucifixPlace", () => {
			if (!gameRef.current.onConsumeCrucifix()) return;
			crucifixIdCounterRef.current += 1;
			const now = performance.now();
			activeCrucifixesRef.current = [
				...activeCrucifixesRef.current,
				{
					id: crucifixIdCounterRef.current,
					x: camera.position.x,
					z: camera.position.z,
					expiresAtMs: now + CRUCIFIX_LIFETIME_MS,
				},
			];
			setCrucifixesVersion((v) => v + 1);
		});
	}, [camera, gameRef]);

	// PC4 — per-frame expiry pruner. Runs in the same useFrame block
	// as the EMF dispatch so the cost stays inside one tick. Bumps
	// the version when entries drop so CrucifixField re-renders with
	// the smaller list.
	useFrame(() => {
		const list = activeCrucifixesRef.current;
		if (list.length === 0) return;
		const now = performance.now();
		const filtered = list.filter((c) => c.expiresAtMs > now);
		if (filtered.length !== list.length) {
			activeCrucifixesRef.current = filtered;
			setCrucifixesVersion((v) => v + 1);
		}
	});

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
	const collisionCtxRef = useRef({ portals, doorOpen: hasKey, blockers: largePropBlockers });
	useEffect(() => {
		collisionCtxRef.current = { portals, doorOpen: hasKey, blockers: largePropBlockers };
	}, [portals, hasKey, largePropBlockers]);

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
		if (standingOnLava && now - lastLavaTickAt.current > 600) {
			lastLavaTickAt.current = now;
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
		}
		// Then check for hazard overlap (per-trap ticked damage).
		const hazard = trapAt(trapsRef.current, { x: px, y: py }, TRAP_OVERLAP_RADIUS);
		if (hazard) {
			const lastTick = lastTrapTickAt.current.get(hazard.id) ?? 0;
			if (now - lastTick > TRAP_TICK_COOLDOWN_MS) {
				lastTrapTickAt.current.set(hazard.id, now);
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

		// ARCH2a — per-frame enemy AI loop lives in src/scene/tick/enemyTickLoop.ts.
		// Behavior is byte-identical; this call site is a pure relocation.
		tickEnemyLoop({
			enemiesRef,
			yukaEntitiesRef,
			bulletsRef,
			nextBulletIdRef,
			enemyMeshesRef: enemyMeshes,
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
			crucifixesRef: activeCrucifixesRef,
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
	// biome-ignore lint/correctness/useExhaustiveDependencies: camera.position is a mutable three.js Vector3 read at event-fire time (debug kill / collect pickups). Treating .x/.z as dep would force re-subscribe per frame, which is wrong — the listener registration only needs `camera` identity stability.
	useEffect(() => {
		const runDebugKill = (predicate: (e: Enemy) => boolean) => {
			let killsThisTick = 0;
			let bossKillsThisTick = 0;
			for (const enemy of enemiesRef.current) {
				if (!predicate(enemy)) continue;
				const tag = `${enemy.id}@${enemy.position.x.toFixed(3)},${enemy.position.y.toFixed(3)}`;
				if (debugKilledSpawnsRef.current.has(tag)) continue;
				if (enemy.dead) continue;
				debugKilledSpawnsRef.current.add(tag);
				enemy.dead = true;
				killsThisTick += 1;
				if (enemy.tier === "boss") {
					bossKillsThisTick += 1;
					// POL36 — debug kill should also surface the boss-defeated
					// banner so playtest captures see the modernized beat.
					dispatch({ type: "bossDefeated", enemyId: enemy.id });
				}
				const mesh = enemyMeshes.current.get(enemy.id);
				if (mesh) mesh.visible = false;
				// Y1 — debug-kill also drops the enemy's yuka GameEntity so the
				// EntityManager doesn't accumulate dead refs across debug runs.
				const yukaEntity = yukaEntitiesRef.current.get(enemy.id);
				if (yukaEntity) {
					removeYukaEntity(yukaEntity);
					yukaEntitiesRef.current.delete(enemy.id);
				}
				// PT1 fold-forward — debug kill dispatches the same
				// death side-effects as the real fire path so playtest
				// captures see POL16 layered burst + POL25 body-part
				// settle + POL12 hitstop.
				dispatch({
					type: "burst",
					x: enemy.position.x,
					y: enemy.position.y,
					kind: enemy.kind === "bouncer" ? "explode" : "damage",
				});
				dispatch({
					type: "bodyParts",
					x: enemy.position.x,
					y: enemy.position.y,
					kind: enemy.kind,
				});
				gameRef.current.onKill();
			}
			if (killsThisTick > 0) {
				// POL35 hitstop reservation — debug-kills should feel the same
				// punch as real kills. POL12 timings preserved (boss 150ms,
				// standard 80ms, scale 0.05 — the most-pinched scale wins).
				const hitstopMs = bossKillsThisTick > 0 ? 150 : 80;
				timeScaleBusRef.current.reserve("hitstop", 0.05, performance.now() + hitstopMs);
				// POL10-v2 boss death + rattler death audio.
				playSkeletonDeath();
				if (bossKillsThisTick > 0) playBossDeath();
				if (settings.soundEnabled) playBoom();
				// PT1C-fold — synthetic burst at camera-forward so playtest
				// captures reliably show POL16's layered burst (impact
				// sparks + smoke + ember trails) even when the killed
				// enemies are off-frame. Production fire-resolution path
				// is unchanged — the per-enemy bursts at real hit
				// positions are still emitted (lines ~683 above). This
				// is purely a debug-camera-framing additive event.
				const forwardX = -Math.sin(camera.rotation.y);
				const forwardZ = -Math.cos(camera.rotation.y);
				dispatch({
					type: "burst",
					x: camera.position.x + forwardX * 2.5,
					y: camera.position.z + forwardZ * 2.5,
					kind: "damage",
				});
			}
		};
		const onDebugKillAll = () => runDebugKill(() => true);
		const onDebugKillBoss = () => runDebugKill((e) => e.tier === "boss");
		const onDebugCollectPickups = () => {
			for (const pickup of pickupsRef.current) {
				if (pickup.collected) continue;
				pickup.collected = true;
				const mesh = pickupMeshes.current.get(pickup.id);
				if (mesh) mesh.visible = false;
				gameRef.current.onCollectPickup(pickup.kind);
			}
		};
		const teardownKillAll = addBoneBusterListener("debugKillAll", onDebugKillAll);
		const teardownKillBoss = addBoneBusterListener("debugKillBoss", onDebugKillBoss);
		const teardownCollect = addBoneBusterListener("debugCollectPickups", onDebugCollectPickups);
		return () => {
			teardownKillAll();
			teardownKillBoss();
			teardownCollect();
		};
	}, [gameRef, settings.soundEnabled]);

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

	// PB4 — per-run melee profile resolved from level.seed; pairs with
	// the viewmodel's pickMeleeSkin so the visible weapon and the damage
	// numbers stay in lockstep.
	const meleeProfile = useMemo(() => pickMeleeProfile(map.seed), [map.seed]);
	// PD1 — same pattern for the pistol skin: per-seed profile pairs
	// with WeaponViewmodel's pickPistolSkin so viewmodel and damage
	// numbers stay in lockstep.
	const pistolProfile = useMemo(() => pickPistolProfile(map.seed), [map.seed]);
	// PD3 — chaingun skin profile pairs with pickChaingunSkin.
	const chaingunProfile = useMemo(() => pickChaingunProfile(map.seed), [map.seed]);

	// ARCH2b — single-shot resolution moved to src/scene/tick/fireResolution.ts.
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
				muzzleIntensityScaleRef,
				timeScaleBus: timeScaleBusRef.current,
				explodeBarrel: (b) => explodeBarrelRef.current(b),
				meleeProfile,
				pistolProfile,
				chaingunProfile,
			});
		};

		return addBoneBusterListener("fire", onFire);
	}, [
		active,
		camera,
		map,
		hasKey,
		gameRef,
		weapon,
		ammoRef,
		settings,
		meleeProfile,
		pistolProfile,
		chaingunProfile,
	]);

	useFrame(() => {
		if (!active || hasKey) return;
		const dx = camera.position.x - map.keyPosition.x;
		const dy = camera.position.z - map.keyPosition.y;
		if (dx * dx + dy * dy < 1.2 * 1.2) {
			gameRef.current.onPickupKey();
			playPickup();
		}
	});

	// PB5 step-2 — EMF reader per-frame nearest-enemy distance dispatch.
	// Throttled to 100 ms (≈10 Hz) so HUD re-renders stay cheap; the chip
	// animation interpolates smoothly between the discrete level steps.
	// Gated on hasEmfReader — when the player doesn't own the reader the
	// per-frame cost collapses to one boolean check.
	const lastEmfDispatchRef = useRef(0);
	const lastEmfLevelRef = useRef<-1 | 0 | 1 | 2 | 3 | 4 | 5>(-1);
	useFrame(() => {
		if (!hasEmfReader || !active) return;
		const now = performance.now();
		if (now - lastEmfDispatchRef.current < 100) return;
		lastEmfDispatchRef.current = now;
		// Nearest-enemy distance in tiles. Camera position is world units;
		// 1 tile = 1 world unit in Bone Buster's coordinate space (TILE
		// constant), so the raw Euclidean distance IS the tile count.
		let bestDistSq = Number.POSITIVE_INFINITY;
		for (const enemy of enemiesRef.current) {
			if (enemy.dead) continue;
			const ex = enemy.position.x - camera.position.x;
			const ez = enemy.position.y - camera.position.z;
			const d = ex * ex + ez * ez;
			if (d < bestDistSq) bestDistSq = d;
		}
		const dist = Number.isFinite(bestDistSq) ? Math.sqrt(bestDistSq) : Number.POSITIVE_INFINITY;
		const level = pickEmfReading(dist);
		// Skip the dispatch when the level hasn't changed since the last
		// emit — the HUD chip only needs deltas. Initial value (-1) always
		// triggers the first dispatch so the chip can clear an inherited
		// state.
		if (level === lastEmfLevelRef.current) return;
		lastEmfLevelRef.current = level;
		dispatch({ type: "emfReading", level });
	});

	// PC2 — Spirit-box per-frame proximity check + cooldown-gated
	// response dispatch. Walks the same enemiesRef pool as the EMF
	// dispatch above; when the nearest live enemy is within
	// SPIRIT_BOX_TRIGGER_RADIUS tiles and the cooldown has expired,
	// picks a deterministic phoneme keyed off (map.seed, triggerIndex)
	// and emits the typed event. The HUD bubble subscribes; the audio
	// sting (future commit) can subscribe to the same event.
	const lastSpiritBoxTriggerAtRef = useRef(0);
	const spiritBoxTriggerCountRef = useRef(0);
	useFrame(() => {
		if (!hasSpiritBox || !active) return;
		const now = performance.now();
		if (now - lastSpiritBoxTriggerAtRef.current < SPIRIT_BOX_COOLDOWN_MS) return;
		const radiusSq = SPIRIT_BOX_TRIGGER_RADIUS * SPIRIT_BOX_TRIGGER_RADIUS;
		let nearestSq = Number.POSITIVE_INFINITY;
		for (const enemy of enemiesRef.current) {
			if (enemy.dead) continue;
			const ex = enemy.position.x - camera.position.x;
			const ez = enemy.position.y - camera.position.z;
			const d = ex * ex + ez * ez;
			if (d < nearestSq) nearestSq = d;
		}
		if (nearestSq > radiusSq) return;
		lastSpiritBoxTriggerAtRef.current = now;
		const phoneme = pickSpiritBoxPhoneme(map.seed, spiritBoxTriggerCountRef.current);
		spiritBoxTriggerCountRef.current += 1;
		dispatch({ type: "spiritBoxResponse", phoneme });
	});

	// POL44 — muzzle-light decay at positive priority. The fire event
	// handler (registered on a different useFrame's frame timing) can
	// land EITHER before or after the main default-priority useFrame.
	// Reading muzzleFlashUntil.current there risked a 1-frame lag when
	// the fire event arrived after main's read. Pinning this block to
	// priority=1 guarantees it always runs AFTER every default-priority
	// useFrame in the same frame — including the fire handler. The
	// intensity register the player sees on a fire frame is always
	// THIS frame's write, never last frame's.
	useFrame(() => {
		if (!muzzleLightRef.current) return;
		const now = performance.now();
		const remaining = muzzleFlashUntil.current - now;
		// POL13 — bloom-tier scale per weapon. Baseline intensity
		// (remaining / 20) hits 4.0 at fresh-flash; the per-weapon
		// scale multiplies that so pistol reads 2.4 max, chaingun
		// 3.6, shotgun 5.6, flamethrower 4.4, melee 0.
		const baseIntensity = remaining > 0 ? Math.min(4, remaining / 20) : 0;
		const intensity = baseIntensity * muzzleIntensityScaleRef.current;
		muzzleLightRef.current.intensity = intensity;
		muzzleLightRef.current.color.copy(muzzleColorRef.current);
		const anchor = muzzleAnchorRef.current;
		if (anchor) {
			// PA-MOD7 / D11: position tracks the WeaponViewmodel's muzzle
			// anchor (the actual barrel tip in the GLB). The anchor's
			// world matrix was updated by WeaponViewmodel's priority=-1
			// useFrame, so it's already THIS frame's pose by the time
			// we read it here.
			anchor.getWorldPosition(muzzleWorldPos);
			muzzleLightRef.current.position.copy(muzzleWorldPos);
		} else {
			muzzleLightRef.current.position.set(camera.position.x, camera.position.y, camera.position.z);
		}
	}, 1);

	return (
		<>
			{/* J1 — when the player owns the flashlight the world reads in
			    full ambient + sun. Without it, both drop to near-dark and
			    the flashlight spotlight is the only practical fill. */}
			<ambientLight
				ref={ambientLightRef}
				intensity={(hasFlashlight ? 0.55 : 0.12) * lightPalette.ambientMul}
				color={lightPalette.ambientColor}
			/>
			<directionalLight
				ref={directionalLightRef}
				position={[10, 16, 8]}
				intensity={(hasFlashlight ? 0.9 : 0.18) * lightPalette.directionalMul}
				color={lightPalette.directionalColor}
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
			{/* PC3 — UV flashlight cone. Mounted alongside (not instead of)
			    the white flashlight; the two lights coexist when the
			    player owns both. */}
			{hasUvFlashlight && <UvFlashlight />}
			{/* PC4 — active crucifix placements. Re-renders when
			    crucifixesVersion bumps (push on place / filter on
			    expiry). Always mounted (no owner-gate) — the list is
			    empty when no crucifix is active, so the cost collapses
			    to a single empty Array.map. */}
			<CrucifixField crucifixes={activeCrucifixesRef.current} key={crucifixesVersion} />

			<hemisphereLight args={[lightPalette.hemisphereSky, lightPalette.hemisphereGround, 0.35]} />
			{/* I11 — muzzle-flash point light. Lives at camera position,
			    driven by useFrame so it can decay between renders. */}
			<pointLight ref={muzzleLightRef} intensity={0} distance={8} decay={1.5} />
			{/* E13 step-4 — per-archetype fog tint. Dominant depth-fade
			    signal in low-lit play; biggest visual lever for archetype-
			    distinctness. Corridor still resolves to BONE_BUSTER_PALETTE.ink. */}
			<fog attach="fog" args={[lightPalette.fogColor, 6, TILE * lightPalette.fogFarTiles]} />
			<color attach="background" args={[lightPalette.fogColor]} />

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
			{/* POL23 — exit-portal approach FOV-widen slot per
			    docs/SLOT-ARCHITECTURE.md. The base FOV of 75 mirrors
			    the BoneBusterShell Canvas camera config. */}
			<ExitPortalApproach
				portalPosition={map.exitPosition}
				unlocked={hasKey && allBossesDead}
				baseFov={75}
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
			<LampField lamps={lampsRef.current} lightColor={lightPalette.lampLightColor} />

			{/* COV4 + E3 — decorative prop scatter from PSX Mega Pack II
			    Props pool. Step-1: "corridor" archetype default for
			    every sector; E13 will pick archetypes per map.seed. */}
			<PropField props={propsRef.current} />

			{/* COV2 step-2 — anchor-piece large-prop scatter (1-2 per
			    sector). Blocking entries (machinery, shipping container)
			    push the player out via the collision blocker list. */}
			<LargePropField props={largePropsRef.current} />

			{/* COV8 step-2 — trap scatter (0-2 hazards + 1 trigger per
			    sector, archetype-biased). Tick damage + lever-disarm
			    flow lives in the per-frame loop in BoneBusterScene. */}
			<TrapField traps={trapsRef.current} />

			{/* COV13 step-2 — library-archetype kitchen scatter.
			    Empty on non-library archetypes. */}
			<KitchenField props={kitchenRef.current} />

			{/* COV11 step-2 — courtyard-archetype nature scatter.
			    Empty on non-courtyard archetypes. */}
			<NatureField instances={natureRef.current} />

			{/* COV14 step-2 — library-archetype ambient NPCs. Pure
			    set-dressing; no AI/LOS/damage tracks. */}
			<NpcField instances={npcsRef.current} />

			{/* COV3 step-1 — modular asphalt floor tiles. Empty unless
			    the map opts in via `useModularFloor: true`. */}
			<FloorTileField tiles={floorTilesRef.current} />

			{/* COV5 step-2 — sector-body debris scatter (3-5 per sector,
			    skip-radius 4 from spawn/exit/key). Reads as "overrun." */}
			<DebrisField debris={debrisRef.current} />

			{/* COV6 step-2.1 — wall-face decals as billboard quads with
			    the GLB's primary texture extracted onto a 1.2×0.8 plane
			    aligned to the sector edge normal. */}
			<DecalField decals={decalsRef.current} />

			{/* COV10 step-2 — one RV wreck at the courtyard archetype's
			    farthest-sector centroid. Null on non-courtyard maps. */}
			{wreckPosition && <VehicleWreck position={wreckPosition} seed={map.seed} />}

			{enemiesRef.current.map((enemy) => (
				<group key={enemy.id}>
					<EnemyMesh
						enemy={enemy}
						register={(group) => {
							if (group) enemyMeshes.current.set(enemy.id, group);
							else enemyMeshes.current.delete(enemy.id);
						}}
					/>
					{/* POL19 — hit-flash slot. Sibling to EnemyMesh per
					    docs/SLOT-ARCHITECTURE.md. Reads enemy.staggerUntil,
					    looks up the registered mesh via enemyMeshes, clones
					    + modulates materials. Returns null. */}
					<EnemyHitFlash enemy={enemy} meshLookup={enemyMeshes} />
					{/* PC3 — UV reveal / baseline-hide slot. uvHidden enemies
					    are invisible by default; UV flashlight cone reveals
					    them per-frame. The two slots are mutually exclusive
					    based on hasUvFlashlight so the no-tool path pays
					    zero per-frame UV cost. */}
					{enemy.uvHidden &&
						(hasUvFlashlight ? (
							<EnemyUvReveal enemy={enemy} meshLookup={enemyMeshes} />
						) : (
							<EnemyUvBaseHide enemy={enemy} meshLookup={enemyMeshes} />
						))}
				</group>
			))}

			{pickupsRef.current.map((pickup) => (
				<PickupMesh
					key={pickup.id}
					pickup={pickup}
					mapSeed={map.seed}
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
			<BodyPartField archetype={archetype} />
			<ReturnToSpawnBearingWriter spawnX={map.playerSpawn.x} spawnY={map.playerSpawn.y} />
			<ShellEjectField />
			<DamageNumberField />
			<WeaponViewmodel
				weapon={weapon}
				mapSeed={map.seed}
				onMuzzleAnchor={onMuzzleAnchor}
				swapDipOffsetRef={weaponSwapDipOffsetRef}
			/>
			{/* POL20 — weapon-swap dip slot per docs/SLOT-ARCHITECTURE.md. */}
			<WeaponSwapDip weapon={weapon} dipOffsetRef={weaponSwapDipOffsetRef} />

			<PlayerController map={map} active={active} hasKey={hasKey} settings={settings} />

			{/* E12/PA16 — adaptive pixel ratio. Lives inside Canvas so it
			    can call useFrame + useThree.gl.setPixelRatio directly. */}
			<AdaptiveResolution onUpdate={(info) => dispatch({ type: "fpsUpdate", ...info })} />

			{/* A3 — selective postprocess chain. PostprocessingChain owns
			    the EffectComposer block and conditionally drops Bloom
			    when avgFps <30 for 2 consecutive windows. */}
			<PostprocessingChain />
		</>
	);
}
