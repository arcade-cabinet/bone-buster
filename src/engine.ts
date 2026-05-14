import { PISTOL_MAX_RANGE, PLAYER_RADIUS, SKELETON_HP, TILE } from "./constants";

export type Cell = "empty" | "wall" | "door" | "spawn" | "exit" | "key" | "lava";

// Reference enemy roster (game.js → all_objects):
//   skeleton  = closest analogue to the reference's vanilla `Enemy` —
//               ground unit, melee on contact, dies cleanly.
//   wraith    = reference `FlyingEnemy` — no-clip movement, weaker but
//               harder to corner; shoots EnemyBullets at the player.
//   imp       = reference `Enemy` variant with explode-on-death — bursts
//               into 3-5 BodyPart particles. Higher HP than skeleton.
export type EnemyKind = "skeleton" | "wraith" | "imp";

export type EnemySpawn = Readonly<{
	kind: EnemyKind;
	position: Vec2;
}>;

export type PickupKind =
	| "health"
	| "chaingunAmmo"
	| "shotgunAmmo"
	// J1 — flashlight pickup. Carrying it grants a forward cone of
	// directional light; without it the level reads as dark.
	| "flashlight"
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
 * Shared metadata that exists on every Objexoom map regardless of how it
 * was authored. Both the procedural grid and the polygonal-sector
 * representation embed this.
 */
export type ObjexoomMapBase = Readonly<{
	seed: number;
	playerSpawn: Vec2;
	playerYaw: number;
	enemySpawns: readonly EnemySpawn[];
	pickupSpawns: readonly PickupSpawn[];
	keyPosition: Vec2;
	exitPosition: Vec2;
}>;

export type ObjexoomGridMap = ObjexoomMapBase &
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
export type ObjexoomSectorMap = ObjexoomMapBase &
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
		secrets?: readonly import("./secrets").SecretSpec[];
		/**
		 * COV3 step-1 — when true, SectorMapGeometry OMITS the procedural
		 * floor shape and FloorTileField renders modular asphalt tiles
		 * instead. Walls + ceiling stay procedural until COV3 step-2.
		 * Default false; only refLevel 0 sets this true in the current
		 * slice.
		 */
		useModularFloor?: boolean;
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

export type ObjexoomMap = ObjexoomGridMap | ObjexoomSectorMap;

export const isGridMap = (m: ObjexoomMap): m is ObjexoomGridMap => m.kind === "grid";

export const isSectorMap = (m: ObjexoomMap): m is ObjexoomSectorMap => m.kind === "sectors";

export type Vec2 = Readonly<{ x: number; y: number }>;

const MAP_WIDTH = 24;
const MAP_HEIGHT = 24;
const MIN_ROOM = 3;
const MAX_ROOM = 6;
const ROOM_TRIES = 90;

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

function mulberry32(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const cellCenter = (gx: number, gy: number): Vec2 => ({
	x: (gx + 0.5) * TILE,
	y: (gy + 0.5) * TILE,
});

const inBounds = (gx: number, gy: number, w: number, h: number) =>
	gx >= 0 && gy >= 0 && gx < w && gy < h;

function carveRoom(cells: Cell[][], room: Room) {
	for (let gy = room.gy; gy < room.gy + room.height; gy += 1) {
		for (let gx = room.gx; gx < room.gx + room.width; gx += 1) {
			cells[gy][gx] = "empty";
		}
	}
}

function carveCorridor(cells: Cell[][], a: Room, b: Room, rand: () => number) {
	const ax = a.gx + Math.floor(a.width / 2);
	const ay = a.gy + Math.floor(a.height / 2);
	const bx = b.gx + Math.floor(b.width / 2);
	const by = b.gy + Math.floor(b.height / 2);
	const horizontalFirst = rand() < 0.5;
	let cx = ax;
	let cy = ay;
	if (horizontalFirst) {
		while (cx !== bx) {
			cells[cy][cx] = "empty";
			cx += cx < bx ? 1 : -1;
		}
		while (cy !== by) {
			cells[cy][cx] = "empty";
			cy += cy < by ? 1 : -1;
		}
	} else {
		while (cy !== by) {
			cells[cy][cx] = "empty";
			cy += cy < by ? 1 : -1;
		}
		while (cx !== bx) {
			cells[cy][cx] = "empty";
			cx += cx < bx ? 1 : -1;
		}
	}
	cells[cy][cx] = "empty";
}

function bfsReachable(
	cells: Cell[][],
	start: { gx: number; gy: number },
	passable: (c: Cell) => boolean,
): boolean[][] {
	const height = cells.length;
	const width = cells[0].length;
	const visited: boolean[][] = Array.from({ length: height }, () =>
		new Array<boolean>(width).fill(false),
	);
	if (!inBounds(start.gx, start.gy, width, height)) return visited;
	const queue: Array<{ gx: number; gy: number }> = [start];
	visited[start.gy][start.gx] = true;
	while (queue.length > 0) {
		const next = queue.shift();
		if (!next) break;
		const { gx, gy } = next;
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		] as const) {
			const nx = gx + dx;
			const ny = gy + dy;
			if (!inBounds(nx, ny, width, height)) continue;
			if (visited[ny][nx]) continue;
			if (!passable(cells[ny][nx])) continue;
			visited[ny][nx] = true;
			queue.push({ gx: nx, gy: ny });
		}
	}
	return visited;
}

function roomsIntersect(a: Room, b: Room, padding: number) {
	return (
		a.gx - padding < b.gx + b.width &&
		a.gx + a.width + padding > b.gx &&
		a.gy - padding < b.gy + b.height &&
		a.gy + a.height + padding > b.gy
	);
}

export function generateMap(seed: number, shape?: GenerateMapShape): ObjexoomGridMap {
	const rand = mulberry32(seed);
	const width = MAP_WIDTH;
	const height = MAP_HEIGHT;
	const minRoom = shape?.minRoom ?? MIN_ROOM;
	const maxRoom = shape?.maxRoom ?? MAX_ROOM;
	const roomTries = shape?.roomTries ?? ROOM_TRIES;
	const cells: Cell[][] = Array.from({ length: height }, () => new Array<Cell>(width).fill("wall"));

	const rooms: Room[] = [];
	for (let i = 0; i < roomTries; i += 1) {
		const w = minRoom + Math.floor(rand() * (maxRoom - minRoom + 1));
		const h = minRoom + Math.floor(rand() * (maxRoom - minRoom + 1));
		const gx = 1 + Math.floor(rand() * (width - w - 2));
		const gy = 1 + Math.floor(rand() * (height - h - 2));
		const room: Room = { gx, gy, width: w, height: h };
		if (rooms.some((r) => roomsIntersect(r, room, 1))) continue;
		rooms.push(room);
		carveRoom(cells, room);
		if (rooms.length > 1) {
			carveCorridor(cells, rooms[rooms.length - 2], room, rand);
		}
	}

	// Sprinkle lava in a few inner rooms.
	const lavaRoomCount = Math.min(2, Math.floor(rooms.length / 6));
	for (let i = 0; i < lavaRoomCount; i += 1) {
		const room = rooms[Math.floor(rand() * (rooms.length - 2)) + 1];
		const cgx = room.gx + Math.floor(room.width / 2);
		const cgy = room.gy + Math.floor(room.height / 2);
		if (cells[cgy][cgx] === "empty") cells[cgy][cgx] = "lava";
	}

	// Player spawn = first room center.
	const spawnRoom = rooms[0];
	const startGx = spawnRoom.gx + Math.floor(spawnRoom.width / 2);
	const startGy = spawnRoom.gy + Math.floor(spawnRoom.height / 2);

	// Exit = furthest empty cell reachable from spawn.
	const reach = bfsReachable(
		cells,
		{ gx: startGx, gy: startGy },
		(c) => c === "empty" || c === "lava",
	);
	let exit = { gx: startGx, gy: startGy };
	let exitDist = -1;
	for (let gy = 0; gy < height; gy += 1) {
		for (let gx = 0; gx < width; gx += 1) {
			if (!reach[gy][gx]) continue;
			if (cells[gy][gx] !== "empty") continue;
			const d = Math.abs(gx - startGx) + Math.abs(gy - startGy);
			if (d > exitDist) {
				exitDist = d;
				exit = { gx, gy };
			}
		}
	}

	// Place door between exit and the corridor.
	let doorCell = { gx: exit.gx, gy: exit.gy };
	const exitNeighbors = (
		[
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		] as const
	)
		.map(([dx, dy]) => ({ gx: exit.gx + dx, gy: exit.gy + dy }))
		.filter((n) => inBounds(n.gx, n.gy, width, height) && cells[n.gy][n.gx] === "empty");
	if (exitNeighbors.length > 0) {
		doorCell = exitNeighbors[0];
		for (let i = 1; i < exitNeighbors.length; i += 1) {
			cells[exitNeighbors[i].gy][exitNeighbors[i].gx] = "wall";
		}
		cells[doorCell.gy][doorCell.gx] = "door";
	}
	cells[exit.gy][exit.gx] = "exit";

	const openReach = bfsReachable(
		cells,
		{ gx: startGx, gy: startGy },
		(c) => c === "empty" || c === "spawn" || c === "lava",
	);

	// Key — far from door, accessible without the door.
	let key = { gx: startGx, gy: startGy };
	let keyDist = -1;
	for (let gy = 0; gy < height; gy += 1) {
		for (let gx = 0; gx < width; gx += 1) {
			if (!openReach[gy][gx]) continue;
			if (cells[gy][gx] !== "empty") continue;
			if (gx === startGx && gy === startGy) continue;
			const d = Math.abs(gx - doorCell.gx) + Math.abs(gy - doorCell.gy);
			if (d > keyDist) {
				keyDist = d;
				key = { gx, gy };
			}
		}
	}
	cells[key.gy][key.gx] = "key";

	// Enemy spawns: room centers + room corners, distance-biased.
	const enemyCandidates: Vec2[] = [];
	for (let gy = 0; gy < height; gy += 1) {
		for (let gx = 0; gx < width; gx += 1) {
			if (!openReach[gy][gx]) continue;
			if (cells[gy][gx] !== "empty") continue;
			if (gx === startGx && gy === startGy) continue;
			const d = Math.abs(gx - startGx) + Math.abs(gy - startGy);
			if (d < 5) continue;
			enemyCandidates.push(cellCenter(gx, gy));
		}
	}
	for (let i = enemyCandidates.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rand() * (i + 1));
		[enemyCandidates[i], enemyCandidates[j]] = [enemyCandidates[j], enemyCandidates[i]];
	}
	const totalEnemies = Math.min(12, Math.max(6, Math.floor(rooms.length * 1.2)));
	const enemySpawns: EnemySpawn[] = enemyCandidates.slice(0, totalEnemies).map((position, idx) => ({
		kind: idx % 3 === 2 ? "wraith" : "skeleton",
		position,
	}));

	// L2 — pickup spawns are health-only on procedural maps now.
	// Chaingun is permanent (L3) and shotgun arrives from the goal drop
	// (not the floor). One shotgun-ammo every 4 slots keeps procedural
	// runs distinct from ref-level pickup layouts.
	const pickupCandidates = enemyCandidates.slice(totalEnemies);
	const pickupSpawns: PickupSpawn[] = pickupCandidates
		.slice(0, Math.min(8, pickupCandidates.length))
		.map((position, idx) => {
			if (idx % 4 === 0) return { kind: "shotgunAmmo", position };
			return { kind: "health", position };
		});

	cells[startGy][startGx] = "spawn";

	return {
		kind: "grid",
		seed,
		width,
		height,
		cells,
		playerSpawn: cellCenter(startGx, startGy),
		playerYaw: rand() * Math.PI * 2,
		enemySpawns,
		pickupSpawns,
		keyPosition: cellCenter(key.gx, key.gy),
		exitPosition: cellCenter(exit.gx, exit.gy),
		doorCell,
		rooms,
	};
}

export function worldToGrid(pos: Vec2): { gx: number; gy: number } {
	return {
		gx: Math.floor(pos.x / TILE),
		gy: Math.floor(pos.y / TILE),
	};
}

export function cellAt(gx: number, gy: number, map: ObjexoomGridMap): Cell | "outOfBounds" {
	if (!inBounds(gx, gy, map.width, map.height)) return "outOfBounds";
	return map.cells[gy][gx];
}

export function isBlocking(cell: Cell | "outOfBounds", doorOpen: boolean) {
	if (cell === "outOfBounds") return true;
	if (cell === "wall") return true;
	if (cell === "door") return !doorOpen;
	return false;
}

export function isLava(cell: Cell | "outOfBounds") {
	return cell === "lava";
}

export function resolveCollision(
	desired: Vec2,
	map: ObjexoomGridMap,
	doorOpen: boolean,
	radius: number = PLAYER_RADIUS,
): Vec2 {
	let { x, y } = desired;
	const grid = worldToGrid({ x, y });
	for (let dgy = -1; dgy <= 1; dgy += 1) {
		for (let dgx = -1; dgx <= 1; dgx += 1) {
			const gx = grid.gx + dgx;
			const gy = grid.gy + dgy;
			const cell = cellAt(gx, gy, map);
			if (!isBlocking(cell, doorOpen)) continue;
			const minX = gx * TILE;
			const maxX = (gx + 1) * TILE;
			const minY = gy * TILE;
			const maxY = (gy + 1) * TILE;
			const closestX = Math.max(minX, Math.min(x, maxX));
			const closestY = Math.max(minY, Math.min(y, maxY));
			let dx = x - closestX;
			let dy = y - closestY;
			let dist2 = dx * dx + dy * dy;
			if (dist2 >= radius * radius) continue;
			if (dist2 === 0) {
				const leftDist = x - minX;
				const rightDist = maxX - x;
				const upDist = y - minY;
				const downDist = maxY - y;
				const minDist = Math.min(leftDist, rightDist, upDist, downDist);
				if (minDist === leftDist) {
					dx = -1;
					dy = 0;
				} else if (minDist === rightDist) {
					dx = 1;
					dy = 0;
				} else if (minDist === upDist) {
					dx = 0;
					dy = -1;
				} else {
					dx = 0;
					dy = 1;
				}
				dist2 = 1;
			}
			const dist = Math.sqrt(dist2) || radius;
			const push = radius - dist;
			x += (dx / dist) * push;
			y += (dy / dist) * push;
		}
	}
	return { x, y };
}

export function castRay(
	origin: Vec2,
	dir: Vec2,
	map: ObjexoomGridMap,
	doorOpen: boolean,
	maxDist: number = PISTOL_MAX_RANGE,
): { dist: number; hit: { gx: number; gy: number } | null } {
	let gx = Math.floor(origin.x / TILE);
	let gy = Math.floor(origin.y / TILE);
	const stepX = Math.sign(dir.x);
	const stepY = Math.sign(dir.y);
	const tDeltaX = dir.x === 0 ? Number.POSITIVE_INFINITY : Math.abs(TILE / dir.x);
	const tDeltaY = dir.y === 0 ? Number.POSITIVE_INFINITY : Math.abs(TILE / dir.y);
	let tMaxX =
		dir.x === 0
			? Number.POSITIVE_INFINITY
			: ((stepX > 0 ? (gx + 1) * TILE : gx * TILE) - origin.x) / dir.x;
	let tMaxY =
		dir.y === 0
			? Number.POSITIVE_INFINITY
			: ((stepY > 0 ? (gy + 1) * TILE : gy * TILE) - origin.y) / dir.y;
	let dist = 0;
	while (dist < maxDist) {
		if (tMaxX < tMaxY) {
			gx += stepX;
			dist = tMaxX;
			tMaxX += tDeltaX;
		} else {
			gy += stepY;
			dist = tMaxY;
			tMaxY += tDeltaY;
		}
		const cell = cellAt(gx, gy, map);
		if (isBlocking(cell, doorOpen)) {
			return { dist, hit: { gx, gy } };
		}
	}
	return { dist: maxDist, hit: null };
}

export function hasLineOfSight(a: Vec2, b: Vec2, map: ObjexoomGridMap, doorOpen: boolean): boolean {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.hypot(dx, dy);
	if (len === 0) return true;
	const dir = { x: dx / len, y: dy / len };
	const { dist } = castRay(a, dir, map, doorOpen, len);
	return dist >= len - 0.001;
}

// Reference FSM states (game.js BaseEnemy._fsm_advance):
//   0 = patrol — slow drift along assigned bearing until LOS to player.
//   1 = chase  — move toward player on a direct LOS-checked line.
//   3 = shoot  — stop, spawn an EnemyBullet, then return to chase.
//   (state 2 in the reference was a transient that we elide.)
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
};

function enemyBaseHp(kind: EnemyKind): number {
	switch (kind) {
		case "wraith":
			return Math.floor(SKELETON_HP * 0.7);
		case "imp":
			return Math.floor(SKELETON_HP * 1.5);
		default:
			return SKELETON_HP;
	}
}

/** E2 — boss HP scaling factor over the kind's base HP (PRD §E2: "3-5×"). */
export const BOSS_HP_MULTIPLIER = 4;

/** E2 — visual scale applied to boss meshes so they read as bigger/scarier. */
export const BOSS_VISUAL_SCALE = 1.6;

/**
 * E2 — pick which spawn becomes the boss. Returns the spawn-index
 * farthest from `map.playerSpawn` (the "final sector" per PRD §E2).
 * Returns -1 if there are no spawns. Deterministic given the map.
 */
export function pickBossSpawnIndex(map: ObjexoomMap): number {
	if (map.enemySpawns.length === 0) return -1;
	let bestIdx = 0;
	// Use -Infinity (not -1) so the comparison is independent of the loop
	// starting index — if a future refactor skips the first spawn for any
	// reason, the picker still works. Reviewer-caught issue from E2.
	let bestDistSq = Number.NEGATIVE_INFINITY;
	for (let i = 0; i < map.enemySpawns.length; i += 1) {
		const dx = map.enemySpawns[i].position.x - map.playerSpawn.x;
		const dy = map.enemySpawns[i].position.y - map.playerSpawn.y;
		const d2 = dx * dx + dy * dy;
		if (d2 > bestDistSq) {
			bestDistSq = d2;
			bestIdx = i;
		}
	}
	return bestIdx;
}

/**
 * @param spawnsOverride — optional pre-remapped spawn list (E13 step-3
 * enemy mix). When absent, uses `map.enemySpawns` directly. Length and
 * order must match `map.enemySpawns` so bossIdx still aligns.
 */
export function spawnEnemies(map: ObjexoomMap, spawnsOverride?: readonly EnemySpawn[]): Enemy[] {
	const spawns = spawnsOverride ?? map.enemySpawns;
	const bossIdx = pickBossSpawnIndex(map);
	return spawns.map((spawn, i) => {
		const isBoss = i === bossIdx;
		const baseHp = enemyBaseHp(spawn.kind);
		const hp = isBoss ? baseHp * BOSS_HP_MULTIPLIER : baseHp;
		// Patrol bearings deterministic from spawn index — same seed → same
		// patrol pattern, which keeps headed e2e + screenshots reproducible.
		const bearing = (i * 1.732) % (Math.PI * 2);
		return {
			id: i,
			kind: spawn.kind,
			position: { ...spawn.position },
			hp,
			maxHp: hp,
			lastAttackAt: 0,
			dead: false,
			fsmState: 0 as const,
			patrolBearing: bearing,
			lastShotAt: 0,
			...(isBoss ? { tier: "boss" as const } : {}),
		};
	});
}

export type Pickup = {
	id: number;
	kind: PickupKind;
	position: Vec2;
	collected: boolean;
};

export function spawnPickups(map: ObjexoomMap): Pickup[] {
	return map.pickupSpawns.map((p, i) => ({
		id: i,
		kind: p.kind,
		position: { ...p.position },
		collected: false,
	}));
}

// ──────────────────────────────────────────────────────────────
// Map-kind dispatchers — call these from r3f/UI code so callers
// don't need to know which map representation is active.
// ──────────────────────────────────────────────────────────────

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

export function resolveCollisionAny(
	desired: Vec2,
	map: ObjexoomMap,
	ctx: CollisionContext,
	radius: number = PLAYER_RADIUS,
): Vec2 {
	if (map.kind === "grid") {
		const resolved = resolveCollision(desired, map, ctx.doorOpen ?? false, radius);
		return ctx.blockers && ctx.blockers.length > 0
			? pushOutBlockers(resolved, ctx.blockers, radius)
			: resolved;
	}
	if (!ctx.portals) {
		throw new Error("resolveCollisionAny: sector map requires portals set");
	}
	const resolved = resolveCollisionSectors(desired, map, ctx.portals, radius);
	return ctx.blockers && ctx.blockers.length > 0
		? pushOutBlockers(resolved, ctx.blockers, radius)
		: resolved;
}

/**
 * COV2 step-2 — push the actor out of each circular blocker. Walks
 * the blocker list (O(n), n ≤ 2 * sectors in practice) and applies a
 * radial pushout. Used after the wall-pushout so the actor never ends
 * up inside a blocker even on a corner-into-blocker desired move.
 */
function pushOutBlockers(
	desired: Vec2,
	blockers: readonly { position: Vec2; radius: number }[],
	actorRadius: number,
): Vec2 {
	let { x, y } = desired;
	for (let iter = 0; iter < 3; iter += 1) {
		let moved = false;
		for (const b of blockers) {
			const dx = x - b.position.x;
			const dy = y - b.position.y;
			const min = b.radius + actorRadius;
			const d2 = dx * dx + dy * dy;
			if (d2 >= min * min) continue;
			if (d2 < EPS) {
				// Actor exactly on the blocker centre — pop east by min.
				x = b.position.x + min;
				y = b.position.y;
			} else {
				const d = Math.sqrt(d2);
				const push = min - d;
				x += (dx / d) * push;
				y += (dy / d) * push;
			}
			moved = true;
		}
		if (!moved) break;
	}
	return { x, y };
}

export function hasLineOfSightAny(
	a: Vec2,
	b: Vec2,
	map: ObjexoomMap,
	ctx: CollisionContext,
): boolean {
	if (map.kind === "grid") {
		return hasLineOfSight(a, b, map, ctx.doorOpen ?? false);
	}
	return hasLineOfSightSectors(a, b, map);
}

export function castRayAny(
	origin: Vec2,
	dir: Vec2,
	map: ObjexoomMap,
	ctx: CollisionContext,
	maxDist?: number,
): { dist: number } {
	if (map.kind === "grid") {
		return castRay(origin, dir, map, ctx.doorOpen ?? false, maxDist);
	}
	return castRaySectors(origin, dir, map, maxDist);
}

// Reference EnemyBullet: 1-cell/sec velocity, hits walls or player.
// We keep tracking server-authoritative in the Scene useFrame; this
// just describes the actor shape so unit tests can reason about it.
// Y5 — yuka-backed projectile step. Imported as a value (only used by
// stepEnemyBullet) so engine.ts itself stays free of yuka imports.
import { yukaProjectileStep } from "./yukaIntegration";

export const ENEMY_BULLET_SPEED = 1.4 * TILE; // ≈ 1 cell / second
// L1 — damage values rescaled for the 0-9 HP scale. Imp bullets land
// for 1 hp on Hurt Me Plenty; wraith bullets pile up over time.
export const ENEMY_BULLET_DAMAGE = 1;
export const ENEMY_BULLET_TTL_MS = 8_000;
export const ENEMY_BULLET_RADIUS = 0.4;

export type EnemyBullet = {
	id: number;
	ownerEnemyId: number;
	position: Vec2;
	velocity: Vec2;
	createdAt: number;
	dead: boolean;
};

export function makeEnemyBullet(
	id: number,
	ownerEnemyId: number,
	origin: Vec2,
	target: Vec2,
	now: number,
): EnemyBullet {
	const dx = target.x - origin.x;
	const dy = target.y - origin.y;
	const len = Math.hypot(dx, dy) || 1;
	return {
		id,
		ownerEnemyId,
		position: { ...origin },
		velocity: {
			x: (dx / len) * ENEMY_BULLET_SPEED,
			y: (dy / len) * ENEMY_BULLET_SPEED,
		},
		createdAt: now,
		dead: false,
	};
}

/**
 * Advances an EnemyBullet by `dt` seconds against the active map. Returns
 * one of:
 *   - { kind: "alive" }            — keep simulating.
 *   - { kind: "hitWall" }          — bullet should be removed; no damage.
 *   - { kind: "hitPlayer" }        — bullet should be removed; player damaged.
 *   - { kind: "expired" }          — older than ENEMY_BULLET_TTL_MS.
 */
export type EnemyBulletStep =
	| { kind: "alive" }
	| { kind: "hitWall" }
	| { kind: "hitPlayer" }
	| { kind: "expired" };

export function stepEnemyBullet(
	bullet: EnemyBullet,
	dt: number,
	now: number,
	playerPos: Vec2,
	map: ObjexoomMap,
	ctx: CollisionContext,
): EnemyBulletStep {
	// `dead` is set by the scene as a removal signal — treat it the same as
	// expired so the bullet gets compacted out of the active list this frame.
	if (bullet.dead) return { kind: "expired" };
	if (now - bullet.createdAt > ENEMY_BULLET_TTL_MS) return { kind: "expired" };

	// Y5 — projectile integration routes through the yuka-style helper so
	// the math matches yuka.Projectile.update; wall + player collision
	// continue to be tested here against the engine's raycast dispatcher.
	const next = yukaProjectileStep(bullet.position, bullet.velocity, dt);

	// Wall test: cast from current to next along the velocity. If the cast
	// distance is shorter than the step length, we hit something.
	const stepLen = Math.hypot(next.x - bullet.position.x, next.y - bullet.position.y);
	if (stepLen > 0) {
		const dir = {
			x: (next.x - bullet.position.x) / stepLen,
			y: (next.y - bullet.position.y) / stepLen,
		};
		const wallHit = castRayAny(bullet.position, dir, map, ctx, stepLen);
		if (wallHit.dist < stepLen - 1e-3) return { kind: "hitWall" };
	}

	// Player hit test.
	const dx = next.x - playerPos.x;
	const dy = next.y - playerPos.y;
	if (Math.hypot(dx, dy) < ENEMY_BULLET_RADIUS + 0.45) {
		bullet.position = next;
		return { kind: "hitPlayer" };
	}

	bullet.position = next;
	return { kind: "alive" };
}

// ──────────────────────────────────────────────────────────────
// Sector-map primitives (used by ObjexoomSectorMap)
// ──────────────────────────────────────────────────────────────

/**
 * Even-odd point-in-polygon test. Works for non-convex polygons. Counts how
 * many polygon edges a horizontal ray from `point` crosses; odd ⇒ inside.
 * Edges that pass exactly through `point.y` are jittered up by ε to avoid
 * the degenerate boundary case (matches the reference's urandom_vector
 * jitter in `is_in_region`).
 */
export function polygonContains(point: Vec2, vertices: readonly Vec2[]): boolean {
	let inside = false;
	const len = vertices.length;
	if (len < 3) return false;
	const px = point.x;
	const py = point.y + 1e-6;
	for (let i = 0, j = len - 1; i < len; j = i, i += 1) {
		const xi = vertices[i].x;
		const yi = vertices[i].y;
		const xj = vertices[j].x;
		const yj = vertices[j].y;
		const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-30) + xi;
		if (intersects) inside = !inside;
	}
	return inside;
}

/**
 * Mutable cache to amortize sector lookups. Each actor (player, enemy)
 * should hold its own instance; passing it lets `getSectorAtPoint` short-
 * circuit when the actor hasn't crossed a sector boundary since the last
 * frame.
 */
export type SectorCache = { last: MapSector | null };

export const newSectorCache = (): SectorCache => ({ last: null });

export function getSectorAtPoint(
	map: ObjexoomSectorMap,
	point: Vec2,
	cache?: SectorCache,
): MapSector | null {
	if (cache?.last && polygonContains(point, cache.last.vertices)) {
		return cache.last;
	}
	for (const sector of map.sectors) {
		if (polygonContains(point, sector.vertices)) {
			if (cache) cache.last = sector;
			return sector;
		}
	}
	if (cache) cache.last = null;
	return null;
}

export function getFloorHeightAt(map: ObjexoomSectorMap, point: Vec2, cache?: SectorCache): number {
	const sector = getSectorAtPoint(map, point, cache);
	return sector ? sector.floorHeight : -100;
}

/** E7 — multiplier applied to PLAYER_MOVE_SPEED when player overlaps a water sector. */
export const WATER_SPEED_MULTIPLIER = 0.6;

/**
 * E7 — true if `point` lies inside a water-flagged sector. Used by
 * PlayerController to apply the wading slowdown. Returns false for
 * grid maps + for points outside any sector.
 */
export function isInWaterAt(map: ObjexoomMap, point: Vec2, cache?: SectorCache): boolean {
	if (map.kind !== "sectors") return false;
	const sector = getSectorAtPoint(map, point, cache);
	return sector?.isWater === true;
}

export function getCeilingHeightAt(
	map: ObjexoomSectorMap,
	point: Vec2,
	cache?: SectorCache,
): number {
	const sector = getSectorAtPoint(map, point, cache);
	return sector ? sector.ceilingHeight : 0;
}

// H2 — map-shape-agnostic floor/ceiling lookup. Grid maps are flat
// (floor=0, ceiling=WALL_HEIGHT); sector maps look up the polygon
// the point sits inside. Returns null when the point is outside the
// playable region (e.g. inside a wall).
export function getFloorHeightAtAny(map: ObjexoomMap, point: Vec2): number | null {
	if (map.kind === "grid") return 0;
	const sector = getSectorAtPoint(map, point);
	return sector ? sector.floorHeight : null;
}

export function getCeilingHeightAtAny(map: ObjexoomMap, point: Vec2): number | null {
	if (map.kind === "grid") return 3; // matches WALL_HEIGHT
	const sector = getSectorAtPoint(map, point);
	return sector ? sector.ceilingHeight : null;
}

/**
 * Ray-vs-segment intersection. Returns the parametric distance `t` along
 * the ray at which it crosses the segment, or null if no intersection.
 * The ray is `origin + t * dir` (dir need not be normalized — `t` is in
 * units of `|dir|`). Returned `t` is non-negative.
 *
 * Reference: `ray_line_intersect` in utils.js.
 */
export function rayHitsSegment(origin: Vec2, dir: Vec2, p1: Vec2, p2: Vec2): number | null {
	const v1x = origin.x - p1.x;
	const v1y = origin.y - p1.y;
	const v2x = p2.x - p1.x;
	const v2y = p2.y - p1.y;
	const v3x = -dir.y;
	const v3y = dir.x;
	const denom = v2x * v3x + v2y * v3y;
	if (Math.abs(denom) < 1e-12) return null;
	const t1 = (v2x * v1y - v2y * v1x) / denom;
	const t2 = (v1x * v3x + v1y * v3y) / denom;
	if (t1 < 0 || t2 < 0 || t2 > 1) return null;
	return t1;
}

/**
 * Cast a ray through a polygonal-sector map. Returns the distance to the
 * first wall edge (an edge whose adjacent sectors would force a height
 * step) and the sector + edge that was hit.
 *
 * For now every sector edge counts as a wall — we do not yet detect
 * shared edges between adjacent sectors at the same height (i.e. portals
 * between sectors). A4 will add edge-sharing detection so the player can
 * walk through doorways.
 */
export function castRaySectors(
	origin: Vec2,
	dir: Vec2,
	map: ObjexoomSectorMap,
	maxDist: number = PISTOL_MAX_RANGE,
): {
	dist: number;
	hit: { sectorId: number; edgeIndex: number } | null;
} {
	let bestDist = maxDist;
	let bestHit: { sectorId: number; edgeIndex: number } | null = null;
	for (const sector of map.sectors) {
		const verts = sector.vertices;
		const len = verts.length;
		for (let i = 0; i < len; i += 1) {
			const a = verts[i];
			const b = verts[(i + 1) % len];
			const t = rayHitsSegment(origin, dir, a, b);
			if (t == null) continue;
			if (t < 1e-6) continue;
			if (t < bestDist) {
				bestDist = t;
				bestHit = { sectorId: sector.id, edgeIndex: i };
			}
		}
	}
	return { dist: bestDist, hit: bestHit };
}

export function hasLineOfSightSectors(a: Vec2, b: Vec2, map: ObjexoomSectorMap): boolean {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.hypot(dx, dy);
	if (len === 0) return true;
	const dir = { x: dx / len, y: dy / len };
	const { dist } = castRaySectors(a, dir, map, len);
	return dist >= len - 1e-3;
}

const EPS = 1e-6;

function edgeKey(a: Vec2, b: Vec2): string {
	// Order-independent so shared edges match regardless of winding direction.
	const ax = Math.round(a.x * 1000) / 1000;
	const ay = Math.round(a.y * 1000) / 1000;
	const bx = Math.round(b.x * 1000) / 1000;
	const by = Math.round(b.y * 1000) / 1000;
	const k1 = `${ax},${ay}`;
	const k2 = `${bx},${by}`;
	return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
}

/**
 * Build an index of shared edges. Two sectors share an edge when their
 * polygons have two identical vertices in the same pair. Shared edges
 * with **identical floor heights on both sides** are *portals* — the
 * actor can walk across them. Shared edges with differing heights are
 * still walls (steps up/down in the reference render as wall segments).
 *
 * Returns a Set of edge keys that should NOT block movement.
 */
export function computePortalEdges(map: ObjexoomSectorMap): Set<string> {
	const owners = new Map<string, MapSector[]>();
	for (const sector of map.sectors) {
		const verts = sector.vertices;
		const len = verts.length;
		for (let i = 0; i < len; i += 1) {
			const k = edgeKey(verts[i], verts[(i + 1) % len]);
			const list = owners.get(k);
			if (list) list.push(sector);
			else owners.set(k, [sector]);
		}
	}
	const portals = new Set<string>();
	for (const [k, sectors] of owners) {
		if (sectors.length < 2) continue;
		// Treat any pair of co-floor sectors as a portal. (Reference behaves
		// similarly — same floor + same ceiling => no wall drawn.)
		const a = sectors[0];
		const allMatch = sectors.every(
			(s) =>
				Math.abs(s.floorHeight - a.floorHeight) < 0.001 &&
				Math.abs(s.ceilingHeight - a.ceilingHeight) < 0.001,
		);
		if (allMatch) portals.add(k);
	}
	return portals;
}

/**
 * Lava check for sector maps. Heuristic: sectors with negative floor
 * height read as lava in the reference. Returns true if the actor stands
 * on lava.
 */
export function isOnLavaSector(map: ObjexoomSectorMap, point: Vec2, cache?: SectorCache): boolean {
	const sector = getSectorAtPoint(map, point, cache);
	return sector ? sector.floorHeight < 0 : false;
}

/**
 * Closest point on segment ab to p. Used for circle-vs-segment collision.
 */
function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
	const abx = b.x - a.x;
	const aby = b.y - a.y;
	const denom = abx * abx + aby * aby;
	if (denom < EPS) return a;
	let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / denom;
	if (t < 0) t = 0;
	else if (t > 1) t = 1;
	return { x: a.x + t * abx, y: a.y + t * aby };
}

/**
 * Push the actor out of any blocking sector edge it's overlapping. Walks
 * every wall edge of every sector — at ~150 edges per ref level the cost
 * is negligible relative to a frame. Mirrors the grid version's signature.
 *
 * `portals` is the set of edge keys returned by `computePortalEdges` —
 * those edges are skipped (no wall, free passage).
 */
export function resolveCollisionSectors(
	desired: Vec2,
	map: ObjexoomSectorMap,
	portals: Set<string>,
	radius: number = PLAYER_RADIUS,
): Vec2 {
	let { x, y } = desired;
	// Run a few iterations because pushing off one edge can pop the actor
	// into another. 3 passes is enough in practice (matches the grid
	// version's behavior on inside corners).
	for (let iter = 0; iter < 3; iter += 1) {
		let moved = false;
		for (const sector of map.sectors) {
			const verts = sector.vertices;
			const len = verts.length;
			for (let i = 0; i < len; i += 1) {
				const a = verts[i];
				const b = verts[(i + 1) % len];
				if (portals.has(edgeKey(a, b))) continue;
				const closest = closestPointOnSegment({ x, y }, a, b);
				const dx = x - closest.x;
				const dy = y - closest.y;
				const d2 = dx * dx + dy * dy;
				if (d2 >= radius * radius) continue;
				if (d2 < EPS) {
					// Edge passes through point — push perpendicular to the edge.
					const ex = b.x - a.x;
					const ey = b.y - a.y;
					const el = Math.hypot(ex, ey) || 1;
					x += (-ey / el) * radius;
					y += (ex / el) * radius;
				} else {
					const d = Math.sqrt(d2);
					const push = radius - d;
					x += (dx / d) * push;
					y += (dy / d) * push;
				}
				moved = true;
			}
		}
		if (!moved) break;
	}
	return { x, y };
}
