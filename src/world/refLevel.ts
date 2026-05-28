/**
 * Bridges the turtle-graphics decoder (turtle.ts) and the runtime
 * BoneBusterSectorMap shape that the engine consumes. Reference class
 * indices come from `all_objects` in game.js:
 *
 *   2 = Enemy (rattler in our register)
 *   3 = FlyingEnemy (phaser)
 *   4 = Health pickup
 *   5 = Goal (exit portal)
 *   6 = LockedDoor (we materialize the key on its position)
 *   7 = Flashlight (we treat as the key for now — same pickup mechanic)
 *   9 = ManyEnemies (squad spawn — emits one phaser + one rattler at the position)
 */

import { decodeRefLevel, levelBounds, type RefLevelIndex } from "@ai/turtle";
import type { BoneBusterSectorMap, EnemySpawn, MapSector, PickupSpawn, Vec2 } from "@engine/engine";
import type { Difficulty } from "@store/settings";
import { ARCHETYPE_NAMES } from "@world/archetype";

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
): BoneBusterSectorMap {
	const decoded = decodeRefLevel(index);
	const bb = levelBounds(decoded);
	const difficultyIdx = DIFFICULTY_INDEX[difficulty];
	let manyEnemiesCount = 0;

	const baseSectors = decoded.polygons.map((poly, i) => ({
		id: i,
		vertices: poly.vertices.map(scalePoint),
		floorHeight: poly.floorHeight * REF_TO_RUNTIME_SCALE,
		ceilingHeight: poly.ceilingHeight * REF_TO_RUNTIME_SCALE,
	}));

	// E7 step-1: flag one sector per level as water — pick the sector
	// whose centroid is farthest from index 0 (the player-spawn-anchor
	// sector typically) but isn't the largest/exit-bearing sector.
	// Deterministic per refLevel index. Provides at least one water
	// tile on every map so the wading slowdown is exercised.
	const waterSectorId = pickWaterSectorId(baseSectors);
	const sectors: MapSector[] = baseSectors.map((s) =>
		s.id === waterSectorId ? { ...s, isWater: true } : s,
	);

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
				enemySpawns.push({ kind: "rattler", position: pos });
				break;
			case 3:
				enemySpawns.push({ kind: "phaser", position: pos });
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
				// Mix is rattler + phaser, alternating starting with rattler,
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
						kind: i % 2 === 0 ? "rattler" : "phaser",
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
		playerSpawn = sectors[0] ? polygonCentroid(sectors[0].vertices) : { x: 0, y: 0 };
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
				kind: enemySpawns.length % 3 === 2 ? "phaser" : "rattler",
				position: c,
			});
			if (enemySpawns.length >= 4) break;
		}
	}

	// E6 — synthesize one secret per ref level. Step-1 slice: place the
	// switch+wall pair offset from the level center along an axis that
	// keeps both inside the map bounds. Per-level seed prevents collision
	// with player/key/exit anchors. Generalization to multi-secret +
	// designer-authored placements follows when a second level needs it.
	const scaledBounds = {
		minX: bb.minX * REF_TO_RUNTIME_SCALE,
		minY: bb.minY * REF_TO_RUNTIME_SCALE,
		maxX: bb.maxX * REF_TO_RUNTIME_SCALE,
		maxY: bb.maxY * REF_TO_RUNTIME_SCALE,
	};
	const cx = (scaledBounds.minX + scaledBounds.maxX) * 0.5;
	const cy = (scaledBounds.minY + scaledBounds.maxY) * 0.5;
	const width = scaledBounds.maxX - scaledBounds.minX;
	const switchOffset = Math.min(2.5, width * 0.18);
	const secrets: import("@world/secrets").SecretSpec[] = [
		{
			id: index * 100 + 1,
			switchPosition: { x: cx + switchOffset, y: cy },
			switchRadius: 0.6,
			wallPosition: { x: cx + switchOffset + 1.2, y: cy },
			wallSize: { x: 1.4, z: 0.4 },
			wallRestY: 1.2,
			wallLiftY: 2.6,
		},
	];

	return {
		kind: "sectors",
		seed: index,
		archetype: (() => {
			// (index >>> 0) % ARCHETYPE_NAMES.length is provably in [0, length).
			const a = ARCHETYPE_NAMES[(index >>> 0) % ARCHETYPE_NAMES.length];
			if (a === undefined)
				throw new RangeError(`loadRefLevel: ARCHETYPE_NAMES index out of bounds`);
			return a;
		})(),
		sectors,
		playerSpawn,
		playerYaw: 0,
		enemySpawns,
		pickupSpawns,
		keyPosition,
		exitPosition,
		bounds: scaledBounds,
		secrets,
		// COV3 step-1: only refLevel 0 opts into modular asphalt floors.
		// Other levels keep the procedural floor until step-2+ ships.
		useModularFloor: index === 0,
		// COV3 step-2 + step-4: ALL ref levels now use modular walls.
		// The variant pool is archetype-keyed (see `WALLS_BY_ARCHETYPE`),
		// so refLevel 0 (corridor) keeps its canonical look while
		// refLevels 1+2 (arena, courtyard by canonical seed%5 invariant)
		// pick from their archetype-specific pools — closes the PRD §E13
		// "visual identity test" gap for ref-level play.
		useModularWalls: true,
	};
}

export { REF_TO_RUNTIME_SCALE };

/**
 * E7 step-1 — pick which sector becomes water in a ref level.
 * Strategy: choose the sector whose centroid is farthest from sector
 * 0's centroid, but not sector 0 itself. Deterministic given the
 * sector geometry. Returns -1 if there are fewer than 2 sectors.
 */
function pickWaterSectorId(sectors: readonly MapSector[]): number {
	if (sectors.length < 2) return -1;
	// sectors.length >= 2, so index 0 is provably in-bounds.
	const sector0 = sectors[0];
	if (sector0 === undefined)
		throw new RangeError(
			"pickWaterSectorId: impossible — sectors.length >= 2 but element 0 missing",
		);
	const anchor = polygonCentroid(sector0.vertices);
	let bestId = -1;
	let bestDistSq = Number.NEGATIVE_INFINITY;
	for (let i = 1; i < sectors.length; i += 1) {
		// i < sectors.length by loop condition — provably in-bounds.
		const si = sectors[i];
		if (si === undefined)
			throw new RangeError(
				`pickWaterSectorId: impossible — i ${i} < sectors.length ${sectors.length} but element missing`,
			);
		const c = polygonCentroid(si.vertices);
		const d2 = (c.x - anchor.x) ** 2 + (c.y - anchor.y) ** 2;
		if (d2 > bestDistSq) {
			bestDistSq = d2;
			bestId = si.id;
		}
	}
	return bestId;
}
