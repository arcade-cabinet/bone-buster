/**
 * CR-H1eng — procedural grid-map generation. `generateMap(seedPhrase)` is
 * the single entry point; everything else here is a private construction
 * helper (room carving, corridor carving, BFS reachability). Consumes the
 * map TYPES from `mapTypes.ts`, the grid `inBounds` predicate from
 * `gridCollision.ts`, and the family PRNG from `rng.ts`.
 */

import { at } from "@engine/arrayAt";
import { inBounds } from "@engine/gridCollision";
import type {
	BoneBusterGridMap,
	Cell,
	EnemySpawn,
	GenerateMapShape,
	PickupKind,
	PickupSpawn,
	Room,
	Vec2,
} from "@engine/mapTypes";
import { createMapPrng, cyrb128 } from "@engine/rng";
import { TILE } from "@shared/constants";
import type { PropArchetype } from "@world/scatter/propPool";

const MAP_WIDTH = 24;
const MAP_HEIGHT = 24;
const MIN_ROOM = 3;
const MAX_ROOM = 6;
const ROOM_TRIES = 90;

const cellCenter = (gx: number, gy: number): Vec2 => ({
	x: (gx + 0.5) * TILE,
	y: (gy + 0.5) * TILE,
});

function carveRoom(cells: Cell[][], room: Room) {
	for (let gy = room.gy; gy < room.gy + room.height; gy += 1) {
		const row = at(cells, gy);
		for (let gx = room.gx; gx < room.gx + room.width; gx += 1) {
			row[gx] = "empty";
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
			at(cells, cy)[cx] = "empty";
			cx += cx < bx ? 1 : -1;
		}
		while (cy !== by) {
			at(cells, cy)[cx] = "empty";
			cy += cy < by ? 1 : -1;
		}
	} else {
		while (cy !== by) {
			at(cells, cy)[cx] = "empty";
			cy += cy < by ? 1 : -1;
		}
		while (cx !== bx) {
			at(cells, cy)[cx] = "empty";
			cx += cx < bx ? 1 : -1;
		}
	}
	at(cells, cy)[cx] = "empty";
}

function bfsReachable(
	cells: Cell[][],
	start: { gx: number; gy: number },
	passable: (c: Cell) => boolean,
): boolean[][] {
	const height = cells.length;
	const width = at(cells, 0).length;
	const visited: boolean[][] = Array.from({ length: height }, () =>
		new Array<boolean>(width).fill(false),
	);
	if (!inBounds(start.gx, start.gy, width, height)) return visited;
	const queue: Array<{ gx: number; gy: number }> = [start];
	at(visited, start.gy)[start.gx] = true;
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
			const visitedRow = at(visited, ny);
			if (at(visitedRow, nx)) continue;
			if (!passable(at(at(cells, ny), nx))) continue;
			visitedRow[nx] = true;
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

export function generateMap(seedPhrase: string, shape?: GenerateMapShape): BoneBusterGridMap {
	const rand = createMapPrng(seedPhrase);
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
			carveCorridor(cells, at(rooms, rooms.length - 2), room, rand);
		}
	}

	// Sprinkle lava in a few inner rooms.
	const lavaRoomCount = Math.min(2, Math.floor(rooms.length / 6));
	for (let i = 0; i < lavaRoomCount; i += 1) {
		const room = at(rooms, Math.floor(rand() * (rooms.length - 2)) + 1);
		const cgx = room.gx + Math.floor(room.width / 2);
		const cgy = room.gy + Math.floor(room.height / 2);
		const cellRow = at(cells, cgy);
		if (cellRow[cgx] === "empty") cellRow[cgx] = "lava";
	}

	// Player spawn = first room center.
	const spawnRoom = at(rooms, 0);
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
		const reachRow = at(reach, gy);
		const cellRow = at(cells, gy);
		for (let gx = 0; gx < width; gx += 1) {
			if (!reachRow[gx]) continue;
			if (cellRow[gx] !== "empty") continue;
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
		.filter((n) => inBounds(n.gx, n.gy, width, height) && at(cells, n.gy)[n.gx] === "empty");
	if (exitNeighbors.length > 0) {
		doorCell = at(exitNeighbors, 0);
		for (let i = 1; i < exitNeighbors.length; i += 1) {
			const n = at(exitNeighbors, i);
			at(cells, n.gy)[n.gx] = "wall";
		}
		at(cells, doorCell.gy)[doorCell.gx] = "door";
	}
	at(cells, exit.gy)[exit.gx] = "exit";

	const openReach = bfsReachable(
		cells,
		{ gx: startGx, gy: startGy },
		(c) => c === "empty" || c === "spawn" || c === "lava",
	);

	// Key — far from door, accessible without the door.
	let key = { gx: startGx, gy: startGy };
	let keyDist = -1;
	for (let gy = 0; gy < height; gy += 1) {
		const openReachRow = at(openReach, gy);
		const cellRow = at(cells, gy);
		for (let gx = 0; gx < width; gx += 1) {
			if (!openReachRow[gx]) continue;
			if (cellRow[gx] !== "empty") continue;
			if (gx === startGx && gy === startGy) continue;
			const d = Math.abs(gx - doorCell.gx) + Math.abs(gy - doorCell.gy);
			if (d > keyDist) {
				keyDist = d;
				key = { gx, gy };
			}
		}
	}
	at(cells, key.gy)[key.gx] = "key";

	// Enemy spawns: room centers + room corners, distance-biased.
	const enemyCandidates: Vec2[] = [];
	for (let gy = 0; gy < height; gy += 1) {
		const openReachRow = at(openReach, gy);
		const cellRow = at(cells, gy);
		for (let gx = 0; gx < width; gx += 1) {
			if (!openReachRow[gx]) continue;
			if (cellRow[gx] !== "empty") continue;
			if (gx === startGx && gy === startGy) continue;
			const d = Math.abs(gx - startGx) + Math.abs(gy - startGy);
			if (d < 5) continue;
			enemyCandidates.push(cellCenter(gx, gy));
		}
	}
	for (let i = enemyCandidates.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rand() * (i + 1));
		const ci = at(enemyCandidates, i);
		const cj = at(enemyCandidates, j);
		enemyCandidates[i] = cj;
		enemyCandidates[j] = ci;
	}
	// E13 step-10 — per-archetype enemy-count multiplier. SEED2: the
	// archetype index now derives from the seed phrase via
	// `cyrb128(phrase)[0] % 5` (replaces the old `seed % 5`). CONV3
	// denormalized `archetype` onto the map type; that field is set in the
	// return value below using this same idx, keeping the one-source-of-truth
	// invariant: CANONICAL_SEED_PHRASE → idx 0 → "corridor".
	const ARCHETYPE_ENEMY_MULTIPLIER = [1.0, 1.4, 0.9, 1.1, 0.8] as const;
	const ARCHETYPE_NAMES_INLINE = [
		"corridor",
		"arena",
		"courtyard",
		"sewer",
		"library",
	] as const satisfies readonly PropArchetype[];
	const archetypeIdx = cyrb128(seedPhrase)[0] % 5;
	const archetype = at(ARCHETYPE_NAMES_INLINE, archetypeIdx);
	const baseEnemyCount = Math.max(6, Math.floor(rooms.length * 1.2));
	const totalEnemies = Math.min(
		16,
		Math.max(4, Math.round(baseEnemyCount * at(ARCHETYPE_ENEMY_MULTIPLIER, archetypeIdx))),
	);
	// Base trio stand-in. Production paths remap through
	// `remapEnemyMix` (see app/views/Scene.tsx:141) before consuming
	// `enemySpawns`, but cycle all three base kinds so any caller that
	// reads the raw list (incl. tests + the bypass-remap pickup path)
	// sees the full base mechanic surface.
	const baseKinds = ["rattler", "phaser", "bouncer"] as const;
	const enemySpawns: EnemySpawn[] = enemyCandidates.slice(0, totalEnemies).map((position, idx) => ({
		kind: at(baseKinds, idx % baseKinds.length),
		position,
	}));

	// D2 (supersedes L2) — procedural pickup pool now includes
	// chaingunAmmo + shotgunAmmo + flamethrowerAmmo alongside health.
	// Three guarantees, applied in this order so the head of the pool
	// is deterministic per-seed (canonical-byte stability is irrelevant
	// here — the L2 pool was never canon-byte-locked):
	//
	//   1. Reserve N head slots for guaranteed-min weapon ammo:
	//        - slot 0 → chaingunAmmo (≥1 per map)
	//        - slot 1 → shotgunAmmo  (≥1 per map)
	//        - slot 2 → flamethrowerAmmo (only if seed%3==0)
	//   2. Apply per-archetype bias to slots beyond the reserved head:
	//        arena    → chaingunAmmo every 3rd
	//        courtyard→ shotgunAmmo every 3rd
	//        library  → flamethrowerAmmo every 4th
	//   3. Remaining slots fill with health.
	//
	// E13 step-11 — per-archetype pickup-count multiplier preserved.
	// Combat-heavy archetypes (arena, sewer) get more pickups,
	// cleaner ones (library) less.
	const ARCHETYPE_PICKUP_MULTIPLIER = [1.0, 1.3, 1.0, 1.2, 0.7] as const;
	const pickupCandidates = enemyCandidates.slice(totalEnemies);
	const basePickupCount = Math.min(8, pickupCandidates.length);
	const pickupTotal = Math.min(
		pickupCandidates.length,
		Math.max(4, Math.round(basePickupCount * at(ARCHETYPE_PICKUP_MULTIPLIER, archetypeIdx))),
	);
	// SEED2 — tool-spawn cadence derives from a phrase-stable numeric
	// (cyrb128 word [1], independent of the archetype's word [0]) replacing
	// the old `seed % N`.
	const seedNum = cyrb128(seedPhrase)[1] >>> 0;
	const wantsFlame = seedNum % 3 === 0;
	// PB5 step-2 — EMF reader spawns on every 4th seed (seed%4==0). One
	// per map. Ownership resets on level transition — Shell.tsx
	// re-initializes hasEmfReader: false alongside hasFlashlight at
	// every new map / new run / respawn site, so the player re-acquires
	// the reader on each EMF-eligible level. Keeping the cadence sparse
	// so the tool reads as a discovery beat rather than a guaranteed
	// every-map find.
	const wantsEmf = seedNum % 4 === 0;
	// PC2 — Spirit box spawns on every 5th seed (offset from EMF's %4
	// so the two tools don't co-spawn on every shared multiple). Same
	// per-level ownership semantics as EMF.
	const wantsSpiritBox = seedNum % 5 === 0;
	// PC3 — UV flashlight spawns on every 6th seed (offset from EMF
	// and spirit box). Per-level ownership reset.
	const wantsUv = seedNum % 6 === 0;
	// PC4 — Crucifix spawns on every 7th seed. Inventory counter
	// resets per level alongside the other tool flags; the player
	// re-builds a small crucifix stockpile on each eligible map.
	const wantsCrucifix = seedNum % 7 === 0;
	const reserved: PickupKind[] = ["chaingunAmmo", "shotgunAmmo"];
	if (wantsFlame) reserved.push("flamethrowerAmmo");
	if (wantsEmf) reserved.push("emfReader");
	if (wantsSpiritBox) reserved.push("spiritBox");
	if (wantsUv) reserved.push("uvFlashlight");
	if (wantsCrucifix) reserved.push("crucifix");
	const pickupSpawns: PickupSpawn[] = pickupCandidates
		.slice(0, pickupTotal)
		.map((position, idx) => {
			if (idx < reserved.length) return { kind: at(reserved, idx), position };
			const tailIdx = idx - reserved.length;
			// Per-archetype bias on the tail. The cadence values (every 3rd
			// for arena/courtyard, every 4th for library) were picked so
			// the average over 10 seeds exceeds 2.0 (arena/courtyard) and
			// 1.0 (library) — pinned by the D2 archetype-bias tests.
			if (archetypeIdx === 1 && tailIdx % 3 === 0) {
				return { kind: "chaingunAmmo", position };
			}
			if (archetypeIdx === 2 && tailIdx % 3 === 0) {
				return { kind: "shotgunAmmo", position };
			}
			if (archetypeIdx === 4 && tailIdx % 4 === 0) {
				return { kind: "flamethrowerAmmo", position };
			}
			return { kind: "health", position };
		});

	at(cells, startGy)[startGx] = "spawn";

	return {
		kind: "grid",
		seedPhrase,
		archetype,
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
