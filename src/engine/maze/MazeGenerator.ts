/**
 * STRUCT1 — the base MazeGenerator core (lowest layer). Representation-agnostic
 * TOPOLOGY: it produces the carved space + connectivity (rooms, the cell grid,
 * spawn/exit/key/door, reachability) and knows NOTHING about biomes, assets, or
 * enemies. Biome generators (STRUCT2) compose this core with their own
 * representation params + content (scatter/enemies/hazards) so each biome feels
 * unique and the procgen builds infinite variety (docs/specs/97).
 *
 * This file currently provides the GRID representation (`generateGridMaze`),
 * extracted byte-for-byte from the old `gridGen.generateMap` topology half — the
 * RNG draw order is preserved exactly (same `rand` instance threaded through),
 * pinned by the STRUCT1 generateMap byte-snapshot guard. A SECTOR representation
 * is a first-class peer to add here later (the topology contract is the same;
 * only the carve + spawn/exit derivation differ). collisionAny already routes
 * grid vs sector, so biomes can mix representations.
 */

import { at } from "@engine/arrayAt";
import { inBounds } from "@engine/gridCollision";
import type { Cell, Room } from "@engine/mapTypes";

export const MAZE_GRID = {
	WIDTH: 24,
	HEIGHT: 24,
	MIN_ROOM: 3,
	MAX_ROOM: 6,
	ROOM_TRIES: 90,
} as const;

/** Per-biome shape override fed to the grid core (was GenerateMapShape). */
export type GridMazeShape = {
	minRoom?: number;
	maxRoom?: number;
	roomTries?: number;
};

/**
 * The topology the core hands the content layer. Cells are carved with
 * spawn/exit/key/door already stamped; `openReach` is reachability ignoring the
 * locked door (key + enemy placement use it). `startGx/startGy` is the spawn.
 */
export type GridMazeTopology = {
	cells: Cell[][];
	rooms: Room[];
	width: number;
	height: number;
	startGx: number;
	startGy: number;
	exit: { gx: number; gy: number };
	doorCell: { gx: number; gy: number };
	key: { gx: number; gy: number };
	openReach: boolean[][];
};

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

export function bfsReachable(
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

/**
 * Carve a grid maze topology. `rand` is the SHARED map PRNG, threaded so the
 * draw order is continuous with the caller's subsequent content draws — moving
 * any draw across this boundary would change every seeded map, so the sequence
 * here is byte-identical to the pre-extraction gridGen.generateMap.
 */
export function generateGridMaze(rand: () => number, shape?: GridMazeShape): GridMazeTopology {
	const width = MAZE_GRID.WIDTH;
	const height = MAZE_GRID.HEIGHT;
	const minRoom = shape?.minRoom ?? MAZE_GRID.MIN_ROOM;
	const maxRoom = shape?.maxRoom ?? MAZE_GRID.MAX_ROOM;
	const roomTries = shape?.roomTries ?? MAZE_GRID.ROOM_TRIES;
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

	return { cells, rooms, width, height, startGx, startGy, exit, doorCell, key, openReach };
}
