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

import type { BoneBusterMap, Vec2 } from "@engine/mapTypes";
import { cyrb128, forkStream } from "@engine/rng";
import { polygonContains } from "@engine/sectors";
import { pickArchetype } from "@world/archetype";
import { type NpcKind, pickNpcKind } from "@world/npcs";
import { bboxOf, nearAny, scatterId } from "@world/scatter/sampling";

const PER_SECTOR_MIN = 0;
const PER_SECTOR_MAX = 2;
const SKIP_RADIUS = 4;
const MIN_INSTANCE_SPACING = 2.5;
const MAX_SAMPLE_ATTEMPTS = 12;

export interface NpcInstance {
	readonly id: number;
	readonly position: Vec2;
	readonly yaw: number;
	readonly kind: NpcKind;
}

/**
 * Deterministic per-map NPC scatter. Returns [] on non-library archetypes
 * and on grid maps.
 */
export function spawnNpcs(map: BoneBusterMap): NpcInstance[] {
	if (map.kind !== "sectors") return [];
	if (pickArchetype(map) !== "library") return [];
	const out: NpcInstance[] = [];
	const rng = forkStream(map.seedPhrase, "NPCS");
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
				id: scatterId(sector.id, slotIdx),
				position: accepted,
				yaw: rng() * Math.PI * 2,
				kind: pickNpcKind((cyrb128(map.seedPhrase)[0] >>> 0) ^ ((sector.id + 1) * 7919 + slotIdx)),
			});
		}
	}
	return out;
}
