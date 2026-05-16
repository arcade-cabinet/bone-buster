/**
 * COV14 step-2 — ambient NPC scatter (library archetype only).
 *
 * "Library is inhabited by quiet researchers" read. NPCs are pure
 * set-dressing — they have NO AI, NO line-of-sight, NO attack, and
 * cannot damage or be damaged by the player. They share asset format
 * with enemies (rigged chibis from the COV14 pool) but live on a
 * separate runtime track so the enemy-tick loop never sees them.
 *
 * Why a sibling system instead of extending `EnemyKind`:
 * extending EnemyKind would ripple through enemyAi.ts, EnemyMesh.tsx,
 * sfx panForEnemy, the hit-pulse path, and the boss-pick logic. NPCs
 * are passive geometry; treating them as enemies would force every
 * AI consumer to skip them with `if (kind !== "npc")` guards.
 *
 * Fires only when `pickArchetype(map) === "library"`. 0-2 NPCs per
 * library sector. Each instance's NpcKind is picked deterministically
 * per `(sectorId, slotIndex)` so two NPCs in the same sector show
 * different chibis.
 *
 * PRNG seed: `map.seed XOR 0x4E504353` ("NPCS" tag) — diverges from
 * every other scatter sequence.
 */

import type { ObjexoomMap, Vec2 } from "@engine/engine";
import { polygonContains } from "@engine/engine";
import { mulberry32 } from "@engine/prng";
import { pickArchetype } from "@world/archetype";
import { type NpcKind, pickNpcKind } from "@world/npcs";

const PER_SECTOR_MIN = 0;
const PER_SECTOR_MAX = 2;
const SKIP_RADIUS = 4;
const MIN_INSTANCE_SPACING = 2.5;
const MAX_SAMPLE_ATTEMPTS = 12;
const ID_STRIDE = 100;

export interface NpcInstance {
	readonly id: number;
	readonly position: Vec2;
	readonly yaw: number;
	readonly kind: NpcKind;
}

function bboxOf(verts: readonly Vec2[]): {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
} {
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const v of verts) {
		if (v.x < minX) minX = v.x;
		if (v.x > maxX) maxX = v.x;
		if (v.y < minY) minY = v.y;
		if (v.y > maxY) maxY = v.y;
	}
	return { minX, maxX, minY, maxY };
}

function nearAny(point: Vec2, others: readonly Vec2[], radius: number): boolean {
	for (const o of others) {
		if (Math.hypot(o.x - point.x, o.y - point.y) < radius) return true;
	}
	return false;
}

/**
 * Deterministic per-map NPC scatter. Returns [] on non-library archetypes
 * and on grid maps.
 */
export function spawnNpcs(map: ObjexoomMap): NpcInstance[] {
	if (map.kind !== "sectors") return [];
	if (pickArchetype(map) !== "library") return [];
	const out: NpcInstance[] = [];
	const rng = mulberry32((map.seed >>> 0) ^ 0x4e504353);
	const skipPoints: Vec2[] = [map.playerSpawn, map.exitPosition, map.keyPosition];

	for (const sector of map.sectors) {
		if (sector.vertices.length < 3) continue;
		const { minX, maxX, minY, maxY } = bboxOf(sector.vertices);
		const target = PER_SECTOR_MIN + Math.floor(rng() * (PER_SECTOR_MAX - PER_SECTOR_MIN + 1));
		if (target === 0) continue;

		const placed: Vec2[] = [];
		for (let i = 0; i < target; i += 1) {
			let accepted: Vec2 | null = null;
			for (let attempt = 0; attempt < MAX_SAMPLE_ATTEMPTS; attempt += 1) {
				const candidate: Vec2 = {
					x: minX + rng() * (maxX - minX),
					y: minY + rng() * (maxY - minY),
				};
				if (!polygonContains(candidate, sector.vertices)) continue;
				if (nearAny(candidate, skipPoints, SKIP_RADIUS)) continue;
				if (nearAny(candidate, placed, MIN_INSTANCE_SPACING)) continue;
				accepted = candidate;
				break;
			}
			if (accepted === null) continue;
			placed.push(accepted);
			const slotIdx = placed.length - 1;
			out.push({
				id: sector.id * ID_STRIDE + slotIdx,
				position: accepted,
				yaw: rng() * Math.PI * 2,
				kind: pickNpcKind((map.seed >>> 0) ^ ((sector.id + 1) * 7919 + slotIdx)),
			});
		}
	}
	return out;
}
