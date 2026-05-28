/**
 * CR-H1eng — core map + entity TYPES for Bone Buster, plus the trivial
 * map-kind guards and the small const tunables that hang off those types.
 *
 * This is the foundation layer of the decomposed engine: pure types and
 * pure data, no procedural generation, no geometry math, no RNG. Everything
 * else under `src/engine/` (gridGen, collision, sectors, spawn, projectiles)
 * imports FROM here; this file imports nothing from its siblings.
 */

import type { PropArchetype } from "@world/scatter/propPool";

export type Cell = "empty" | "wall" | "door" | "spawn" | "exit" | "key" | "lava";

// D5 — enemy roster expanded from the 3 base kinds (rattler / phaser /
// bouncer, named in D4) to 24 first-class kinds. The base 3 carry
// the canonical mechanics; the 21 additions are split into:
//
//   - 9 promotions: skin variants that previously shared one of the
//     base 3 mechanic profiles are now first-class kinds. Mechanic
//     differentiation lives in src/ai/enemyAi.ts behavior switches.
//   - 12 new extracts: GLBs newly converted from the PSX horror
//     megapack, each with its own mechanic shape.
//
// Full table at docs/REBRAND.md §"Enemy roster — 24 first-class kinds".
// Per-archetype distribution at src/ai/enemyMix.ts.
export type EnemyKind =
	// Base 3 (D4 rename).
	| "rattler"
	| "phaser"
	| "bouncer"
	// 9 promotions (D5).
	| "plaguebeak"
	| "jester"
	| "reverend"
	| "stagged"
	| "grub"
	| "signal"
	| "heap"
	| "heap2"
	| "gorehead"
	// 12 new extracts (D5).
	| "bighoss"
	| "stomper"
	| "butcher"
	| "bloodphaser"
	| "devil"
	| "dolly"
	| "gawker"
	| "oneye"
	| "goliath"
	| "swiney"
	| "mrZ"
	| "lupin"
	// PF2 — sole truly novel kind from the unwired horror-fantasy set
	// per docs/audits/horror-fantasy-enemy-audit.md. Distinct fur-clad
	// brawler silhouette; everything else in the unwired set is a skin
	// variant on an existing kind.
	| "bigfoot";

export type EnemySpawn = Readonly<{
	kind: EnemyKind;
	position: Vec2;
}>;

export type PickupKind =
	| "health"
	| "chaingunAmmo"
	| "shotgunAmmo"
	// D2 — flamethrowerAmmo joins the procedural pickup pool. Spawns
	// every 3rd map (seed%3==0) as a guaranteed-min plus a library-
	// archetype rare bias. On-collect handler credits
	// WEAPONS.flamethrower.pickupAmmo (30) to flamethrower ammo.
	| "flamethrowerAmmo"
	// J1 — flashlight pickup. Carrying it grants a forward cone of
	// directional light; without it the level reads as dark.
	| "flashlight"
	// PB5 step-2 — EMF reader pickup. Carrying it activates the HUD
	// EMF chip (1-5 step readout of nearest-enemy proximity). Passive
	// detection only; doesn't replace any weapon or change damage. See
	// `docs/GHOST-HUNTING.md` for the slice plan.
	| "emfReader"
	// PC2 — Spirit box pickup. Carrying it activates the SpiritBoxBubble
	// HUD overlay: when any live enemy is within SPIRIT_BOX_TRIGGER_RADIUS
	// tiles (6), the box plays a phoneme from the deterministic per-seed
	// pool on a 2.5s cooldown. Passive — no weapon-slot interference.
	| "spiritBox"
	// PC3 — UV flashlight pickup. Carrying it mounts a second SpotLight
	// (purple) parallel to the existing white Flashlight. Enemies tagged
	// `uvHidden: true` at spawn render with mesh.visible = false until
	// the UV cone contains them.
	| "uvFlashlight"
	// PC4 — Crucifix pickup. Increments the player's inventory counter
	// (GameState.crucifixes) by 1 per pickup. Player can stack several
	// across a run; pressing `9` drops one at the player's XZ as an
	// active CrucifixInstance with CRUCIFIX_LIFETIME_MS expiry.
	| "crucifix"
	// COV12 step-2 — rare hero-tier bonus drop. Exactly one per map,
	// placed at the centroid of the sector farthest from playerSpawn.
	// On collect, dispatches a kind-specific bonus picked from the COV12
	// LootKind via `pickLootKind(map.seed)`:
	//   bottles  → +5 health (potion stash)
	//   books    → +chaingun + shotgun ammo (knowledge → reload)
	//   treasure → +score (shipped as a 50-point one-shot bonus)
	| "loot";

export type PickupSpawn = Readonly<{
	kind: PickupKind;
	position: Vec2;
}>;

export type Room = Readonly<{
	gx: number;
	gy: number;
	width: number;
	height: number;
}>;

/**
 * Shared metadata that exists on every Bone Buster map regardless of how it
 * was authored. Both the procedural grid and the polygonal-sector
 * representation embed this.
 */
export type BoneBusterMapBase = Readonly<{
	/**
	 * SEED2 — the adjective-adjective-noun seed PHRASE is the map identity
	 * (replaces the old numeric `seed`). All procedural streams derive from
	 * it via `forkStream(seedPhrase, tag)`; same phrase → same map.
	 * See docs/specs/96-prng-and-landing.md.
	 */
	seedPhrase: string;
	/**
	 * CONV3 — denormalized archetype dispatch. Populated once at map
	 * construction (generateMap / loadRefLevel) via
	 * `ARCHETYPE_NAMES[cyrb128(seedPhrase)[0] % 5]`. Every consumer reads
	 * `map.archetype` instead of recomputing it. `pickArchetype(map)` is a
	 * trivial accessor for legacy call-site readability.
	 *
	 * Canonical-byte-stability invariant: CANONICAL_SEED_PHRASE → "corridor".
	 * Don't recompute this from another source — buildMap is the only writer.
	 */
	archetype: PropArchetype;
	playerSpawn: Vec2;
	playerYaw: number;
	enemySpawns: readonly EnemySpawn[];
	pickupSpawns: readonly PickupSpawn[];
	keyPosition: Vec2;
	exitPosition: Vec2;
}>;

export type BoneBusterGridMap = BoneBusterMapBase &
	Readonly<{
		kind: "grid";
		width: number;
		height: number;
		cells: Cell[][];
		doorCell: { gx: number; gy: number };
		rooms: readonly Room[];
	}>;

/**
 * Polygonal-sector map (turtle-decoded reference levels). Each sector is
 * a non-convex polygon with its own floor / ceiling height. Walls are
 * derived from the sector edges that don't share both endpoints with a
 * neighboring sector at the same heights.
 */
export type BoneBusterSectorMap = BoneBusterMapBase &
	Readonly<{
		kind: "sectors";
		sectors: readonly MapSector[];
		/** axis-aligned bounding box of the entire level */
		bounds: Readonly<{
			minX: number;
			minY: number;
			maxX: number;
			maxY: number;
		}>;
		/**
		 * E6 — optional list of secret switch/wall pairs. Step-1 slice
		 * is "one per ref level"; the type is plural so a future step
		 * can scatter several per level without re-shaping the map.
		 * Grid maps don't carry secrets in this slice.
		 */
		secrets?: readonly import("@world/secrets").SecretSpec[];
		/**
		 * COV3 step-1 — when true, SectorMapGeometry OMITS the procedural
		 * floor shape and FloorTileField renders modular asphalt tiles
		 * instead. Walls + ceiling stay procedural until COV3 step-2.
		 * Default false; only refLevel 0 sets this true in the current
		 * slice.
		 */
		useModularFloor?: boolean;
		/**
		 * COV3 step-2 — when true, SectorMapGeometry OMITS the procedural
		 * `<boxGeometry>` wall quads and mounts modular wall GLBs along
		 * non-portal sector edges instead. Portal edges (sector-to-sector
		 * openings) skip walls regardless. Default false; only refLevel
		 * 0 sets it true in this slice.
		 */
		useModularWalls?: boolean;
	}>;

export type MapSector = Readonly<{
	id: number;
	vertices: readonly Vec2[];
	floorHeight: number;
	ceilingHeight: number;
	/**
	 * E7 — when true, this sector renders with the UV-scrolled water
	 * surface mesh and applies WATER_SPEED_MULTIPLIER to player movement
	 * while overlapping. Defaults to false (regular floor).
	 */
	isWater?: boolean;
}>;

export type BoneBusterMap = BoneBusterGridMap | BoneBusterSectorMap;

export const isGridMap = (m: BoneBusterMap): m is BoneBusterGridMap => m.kind === "grid";

export const isSectorMap = (m: BoneBusterMap): m is BoneBusterSectorMap => m.kind === "sectors";

export type Vec2 = Readonly<{ x: number; y: number }>;

/**
 * E13 step-5 — optional shape override for `generateMap`. When absent,
 * uses the pre-step-5 defaults (MIN_ROOM=3, MAX_ROOM=6, ROOM_TRIES=90)
 * so callers that don't know about archetypes get the same behavior.
 */
export type GenerateMapShape = Readonly<{
	minRoom: number;
	maxRoom: number;
	roomTries: number;
}>;

export type EnemyFsmState = 0 | 1 | 3;

export type Enemy = {
	id: number;
	kind: EnemyKind;
	position: Vec2;
	hp: number;
	maxHp: number;
	lastAttackAt: number;
	dead: boolean;
	fsmState: EnemyFsmState;
	patrolBearing: number; // radians; only used in state 0
	lastShotAt: number;
	/** E2 — when "boss", HP is BOSS_HP_MULTIPLIER × base and the portal stays locked until dead. */
	tier?: "boss";
	/**
	 * POL19 — non-killing-hit stagger. Set to `now + 70ms` (or 100ms
	 * for bosses) on every damage event the enemy survives. enemyTickLoop
	 * scales the enemy's per-frame movement by STAGGER_SPEED_FACTOR
	 * while `now < staggerUntil`. EnemyMesh reads it for the tint flash.
	 * 0 when not staggered.
	 */
	staggerUntil?: number;
	/**
	 * PC3 — UV-hidden tag. When true, EnemyMesh keeps mesh.visible = false
	 * until the UV flashlight cone contains the enemy. Assigned at spawn
	 * time via `pickUvHidden(seed, spawnIndex)` so the same seed always
	 * hides the same enemies — keeps QA + canonical playtests reproducible.
	 * Non-boss enemies only (bosses are always-visible — the reveal layer
	 * shouldn't mask the goal-boss).
	 */
	uvHidden?: boolean;
};

export type Pickup = {
	id: number;
	kind: PickupKind;
	position: Vec2;
	collected: boolean;
};

export type CollisionContext = Readonly<{
	portals?: Set<string>;
	doorOpen?: boolean;
	/**
	 * COV2 step-2 — circle blockers from large-prop anchor pieces.
	 * Each entry pushes the actor out by `radius + actorRadius` if it
	 * overlaps. Optional; absent → no extra blockers (back-compat).
	 */
	blockers?: readonly { position: Vec2; radius: number }[];
}>;

export type SectorCache = { last: MapSector | null };

/** E2 — boss HP scaling factor over the kind's base HP (PRD §E2: "3-5×"). */
export const BOSS_HP_MULTIPLIER = 4;

/** E2 — visual scale applied to boss meshes so they read as bigger/scarier. */
export const BOSS_VISUAL_SCALE = 1.6;

/** E7 — multiplier applied to PLAYER_MOVE_SPEED when player overlaps a water sector. */
export const WATER_SPEED_MULTIPLIER = 0.6;

/**
 * Shared geometry epsilon — the "actor sits exactly on the blocker/edge"
 * degenerate-case threshold used by both the circle-blocker pushout and the
 * sector edge pushout. Lives here so the collision + sector modules agree on
 * one value instead of each redeclaring it.
 */
export const EPS = 1e-6;
