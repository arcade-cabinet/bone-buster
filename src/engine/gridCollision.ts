/**
 * CR-H1eng — grid-map collision + raycast primitives. The lowest geometry
 * layer for the procedural grid representation: cell lookup, blocking rules,
 * circle-vs-cell pushout, DDA raycast, and line-of-sight. Sector maps have
 * their own parallel set in `sectors.ts`; the kind-agnostic dispatchers that
 * pick between the two live in `collisionAny.ts`.
 */

import { at } from "@engine/arrayAt";
import type { BoneBusterGridMap, Cell, Vec2 } from "@engine/mapTypes";
import { PISTOL_MAX_RANGE, PLAYER_RADIUS, TILE } from "@shared/constants";

export const inBounds = (gx: number, gy: number, w: number, h: number) =>
	gx >= 0 && gy >= 0 && gx < w && gy < h;

export function worldToGrid(pos: Vec2): { gx: number; gy: number } {
	return {
		gx: Math.floor(pos.x / TILE),
		gy: Math.floor(pos.y / TILE),
	};
}

export function cellAt(gx: number, gy: number, map: BoneBusterGridMap): Cell | "outOfBounds" {
	if (!inBounds(gx, gy, map.width, map.height)) return "outOfBounds";
	return at(at(map.cells, gy), gx);
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
	map: BoneBusterGridMap,
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
	map: BoneBusterGridMap,
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

export function hasLineOfSight(
	a: Vec2,
	b: Vec2,
	map: BoneBusterGridMap,
	doorOpen: boolean,
): boolean {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.hypot(dx, dy);
	if (len === 0) return true;
	const dir = { x: dx / len, y: dy / len };
	const { dist } = castRay(a, dir, map, doorOpen, len);
	return dist >= len - 0.001;
}
