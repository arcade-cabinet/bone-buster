/**
 * Bridges the turtle-graphics decoder (turtle.ts) and the runtime
 * ObjexoomSectorMap shape that the engine consumes. Reference class
 * indices come from `all_objects` in game.js:
 *
 *   2 = Enemy (skeleton in our register)
 *   3 = FlyingEnemy (wraith)
 *   4 = Health pickup
 *   5 = Goal (exit portal)
 *   6 = LockedDoor (we materialize the key on its position)
 *   7 = Flashlight (we treat as the key for now — same pickup mechanic)
 *   9 = ManyEnemies (squad spawn — emits one wraith + one skeleton at the position)
 */

import type {
	EnemySpawn,
	MapSector,
	ObjexoomSectorMap,
	PickupSpawn,
	Vec2,
} from "./engine";
import type { Difficulty } from "./settings";
import { decodeRefLevel, levelBounds, type RefLevelIndex } from "./turtle";

const REF_TO_RUNTIME_SCALE = 0.25;

// I4 — DIFFICULTY index per ref convention: 0=tooYoung … 4=nightmare.
// Used inside the ManyEnemies expansion formula
// `DIFFICULTY * 5 + 5 + count * π | 0` (bitwise-OR-0 → floor toward zero).
const DIFFICULTY_INDEX: Record<Difficulty, number> = {
	tooYoung: 0,
	notTooRough: 1,
	hurtMePlenty: 2,
	ultraViolence: 3,
	nightmare: 4,
};

const scalePoint = (p: { x: number; y: number }): Vec2 => ({
	x: p.x * REF_TO_RUNTIME_SCALE,
	y: p.y * REF_TO_RUNTIME_SCALE,
});

function polygonCentroid(verts: readonly Vec2[]): Vec2 {
	if (verts.length === 0) return { x: 0, y: 0 };
	let sx = 0;
	let sy = 0;
	for (const v of verts) {
		sx += v.x;
		sy += v.y;
	}
	return { x: sx / verts.length, y: sy / verts.length };
}

export function loadRefLevel(
	index: RefLevelIndex,
	difficulty: Difficulty = "hurtMePlenty",
): ObjexoomSectorMap {
	const decoded = decodeRefLevel(index);
	const bb = levelBounds(decoded);
	const difficultyIdx = DIFFICULTY_INDEX[difficulty];
	let manyEnemiesCount = 0;

	const sectors: MapSector[] = decoded.polygons.map((poly, i) => ({
		id: i,
		vertices: poly.vertices.map(scalePoint),
		floorHeight: poly.floorHeight * REF_TO_RUNTIME_SCALE,
		ceilingHeight: poly.ceilingHeight * REF_TO_RUNTIME_SCALE,
	}));

	const enemySpawns: EnemySpawn[] = [];
	const pickupSpawns: PickupSpawn[] = [];
	let playerSpawn: Vec2 | null = null;
	let exitPosition: Vec2 | null = null;
	let keyPosition: Vec2 | null = null;

	for (const obj of decoded.objects) {
		const pos = scalePoint(obj.position);
		switch (obj.classIdx) {
			case 0: // Player (rare in ref) — used to spawn position
				playerSpawn = pos;
				break;
			case 2:
				enemySpawns.push({ kind: "skeleton", position: pos });
				break;
			case 3:
				enemySpawns.push({ kind: "wraith", position: pos });
				break;
			case 4:
				pickupSpawns.push({ kind: "health", position: pos });
				break;
			case 5:
				exitPosition = pos;
				break;
			case 6: // LockedDoor — the key spawns here.
				if (!keyPosition) keyPosition = pos;
				break;
			case 7:
				// J1/J2 — Flashlight is a real pickup, not a key alias.
				// If a map has no LockedDoor (index 6) and no key, the
				// fall-back logic below picks a mid-distance centroid.
				pickupSpawns.push({ kind: "flashlight", position: pos });
				break;
			case 9: {
				// I4 — ManyEnemies squad. Ref formula:
				//   total = DIFFICULTY*5 + 5 + count*π | 0
				// where DIFFICULTY is the 0-4 index, `count` is the seen-count
				// of class-9 markers so far on this level, and `|0` floors.
				// Mix is skeleton + wraith, alternating starting with skeleton,
				// scattered in a small circle around the marker so they don't
				// telefrag each other.
				const total = (difficultyIdx * 5 + 5 + manyEnemiesCount * Math.PI) | 0;
				manyEnemiesCount += 1;
				for (let i = 0; i < total; i += 1) {
					const theta = (i / total) * Math.PI * 2;
					const r = 0.6 + (i % 3) * 0.25;
					const spreadPos: Vec2 = {
						x: pos.x + Math.cos(theta) * r,
						y: pos.y + Math.sin(theta) * r,
					};
					enemySpawns.push({
						kind: i % 2 === 0 ? "skeleton" : "wraith",
						position: spreadPos,
					});
				}
				break;
			}
			default:
				break;
		}
	}

	// Fallbacks — every level needs a player spawn and an exit. If the
	// decoded turtle stream didn't carry one, derive from geometry.
	if (!playerSpawn) {
		playerSpawn = sectors[0]
			? polygonCentroid(sectors[0].vertices)
			: { x: 0, y: 0 };
	}
	if (!exitPosition) {
		// Furthest sector centroid from spawn.
		let best = playerSpawn;
		let bestDist = -1;
		for (const sector of sectors) {
			const c = polygonCentroid(sector.vertices);
			const d = Math.hypot(c.x - playerSpawn.x, c.y - playerSpawn.y);
			if (d > bestDist) {
				bestDist = d;
				best = c;
			}
		}
		exitPosition = best;
	}
	if (!keyPosition) {
		// Mid-distance sector centroid.
		let best = playerSpawn;
		let bestScore = -1;
		const dxExit = exitPosition.x - playerSpawn.x;
		const dyExit = exitPosition.y - playerSpawn.y;
		const exitDist = Math.hypot(dxExit, dyExit) || 1;
		for (const sector of sectors) {
			const c = polygonCentroid(sector.vertices);
			const dPlayer = Math.hypot(c.x - playerSpawn.x, c.y - playerSpawn.y);
			const dExit = Math.hypot(c.x - exitPosition.x, c.y - exitPosition.y);
			// Prefer halfway and far from both extremes.
			const score = Math.min(dPlayer, dExit) - Math.abs(dPlayer - dExit) * 0.5;
			if (score > bestScore && dPlayer > exitDist * 0.2) {
				bestScore = score;
				best = c;
			}
		}
		keyPosition = best;
	}

	// Guarantee at least three enemies (matches procedural baseline).
	if (enemySpawns.length < 3 && sectors.length > 0) {
		const seen = new Set<string>();
		for (const s of sectors) {
			const c = polygonCentroid(s.vertices);
			const k = `${c.x.toFixed(1)},${c.y.toFixed(1)}`;
			if (seen.has(k)) continue;
			seen.add(k);
			const dx = c.x - playerSpawn.x;
			const dy = c.y - playerSpawn.y;
			if (Math.hypot(dx, dy) < 2) continue;
			enemySpawns.push({
				kind: enemySpawns.length % 3 === 2 ? "wraith" : "skeleton",
				position: c,
			});
			if (enemySpawns.length >= 4) break;
		}
	}

	return {
		kind: "sectors",
		seed: index,
		sectors,
		playerSpawn,
		playerYaw: 0,
		enemySpawns,
		pickupSpawns,
		keyPosition,
		exitPosition,
		bounds: {
			minX: bb.minX * REF_TO_RUNTIME_SCALE,
			minY: bb.minY * REF_TO_RUNTIME_SCALE,
			maxX: bb.maxX * REF_TO_RUNTIME_SCALE,
			maxY: bb.maxY * REF_TO_RUNTIME_SCALE,
		},
	};
}

export { REF_TO_RUNTIME_SCALE };
