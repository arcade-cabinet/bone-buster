/**
 * COV6 step-2 — wall-face decal scatter.
 *
 * For each sector edge (interior wall face), seed 0-2 decals onto
 * the face by tile hash; aggregate ≥3 per sector across all faces.
 * The decal lives just in front of the wall surface (0.05 offset
 * along the wall normal to avoid z-fighting), centered along the
 * edge with a small random t-offset.
 *
 * Why hash-based vs RNG: every wall face has a deterministic identity
 * `(sectorId, edgeIdx)` — hashing that gives a stable per-face decal
 * choice that's independent of any other scatter sequence and
 * survives map mutations to other sectors.
 */

import { pickDecalUrl } from "../decals";
import type { MapSector, ObjexoomMap, Vec2 } from "../engine";

const WALL_OFFSET = 0.05;

export interface DecalInstance {
	readonly id: number;
	/** Decal center position in world space. */
	readonly position: Vec2;
	/** Y position (height up the wall, world units). */
	readonly y: number;
	/** Yaw rotation aligning the decal to the wall face (radians). */
	readonly yaw: number;
	readonly url: string;
}

/** FNV-1a 32-bit hash for the (sectorId, edgeIdx, faceSlot) tuple. */
function hashFace(sectorId: number, edgeIdx: number, slot: number): number {
	let h = 0x811c9dc5;
	for (const v of [sectorId, edgeIdx, slot]) {
		h ^= v & 0xff;
		h = Math.imul(h, 0x01000193);
		h ^= (v >>> 8) & 0xff;
		h = Math.imul(h, 0x01000193);
		h ^= (v >>> 16) & 0xff;
		h = Math.imul(h, 0x01000193);
		h ^= (v >>> 24) & 0xff;
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

function decalsOnEdge(sector: MapSector, edgeIdx: number, a: Vec2, b: Vec2): DecalInstance[] {
	const len = Math.hypot(b.x - a.x, b.y - a.y);
	if (len < 1.2) return []; // Edge too short for a decal.
	// Decal count per edge: 0, 1, or 2 based on hash and edge length.
	const countSeed = hashFace(sector.id, edgeIdx, 0);
	const lengthScale = Math.min(2, Math.floor(len / 2.5));
	const count = countSeed % (lengthScale + 1); // 0..lengthScale inclusive
	if (count === 0) return [];

	// Edge unit + normal vectors.
	const ux = (b.x - a.x) / len;
	const uy = (b.y - a.y) / len;
	// Inward normal — flip to push the decal toward the sector interior
	// (wall face that the player sees). Normal of (ux, uy) is (-uy, ux).
	const nx = -uy;
	const ny = ux;

	const wallHeight = sector.ceilingHeight - sector.floorHeight;
	const out: DecalInstance[] = [];
	for (let i = 0; i < count; i += 1) {
		const slotSeed = hashFace(sector.id, edgeIdx, i + 1);
		// Place along edge in [0.25, 0.75] of length so decals don't crowd
		// corners.
		const t = 0.25 + ((slotSeed >>> 16) & 0xffff) / 0xffff / 2;
		const ex = a.x + ux * (len * t);
		const ey = a.y + uy * (len * t);
		// Decal center 1.2 units up the wall.
		const heightFrac = 0.4 + (((slotSeed >>> 8) & 0xff) / 0xff) * 0.3;
		const y = sector.floorHeight + wallHeight * heightFrac;
		// Pull the decal slightly inward off the wall to avoid z-fighting.
		const px = ex + nx * WALL_OFFSET;
		const py = ey + ny * WALL_OFFSET;
		// Yaw the decal so its face is parallel to the wall (the GLB's
		// natural front is its +Z, we want it to face the inward normal).
		const yaw = Math.atan2(nx, ny);
		out.push({
			id: sector.id * 1_000_000 + edgeIdx * 1000 + i,
			position: { x: px, y: py },
			y,
			yaw,
			url: pickDecalUrl(slotSeed),
		});
	}
	return out;
}

export function spawnDecals(map: ObjexoomMap): DecalInstance[] {
	if (map.kind !== "sectors") return [];
	const out: DecalInstance[] = [];
	for (const sector of map.sectors) {
		if (sector.vertices.length < 3) continue;
		for (let i = 0; i < sector.vertices.length; i += 1) {
			const a = sector.vertices[i];
			const b = sector.vertices[(i + 1) % sector.vertices.length];
			out.push(...decalsOnEdge(sector, i, a, b));
		}
	}
	return out;
}
