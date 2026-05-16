/**
 * COV11 step-2 — courtyard-archetype nature scatter.
 *
 * The COV11 step-1 pool is a single aggregate GLB (`Mega_Nature.glb`)
 * containing many bushes/trees/grass-tufts. Rather than extracting
 * individual sub-meshes (fragile — depends on the GLB's internal
 * node naming), this scatter places multiple SCALED-DOWN clones of
 * the full aggregate. Each clone shows ~4-6 nature items from the
 * aggregate, and varying yaw + scale per instance keeps them from
 * reading as obvious copy-pastes.
 *
 * Fires only on courtyard-archetype maps (PRD §COV11 calls it out
 * as the outdoor archetype). 4-8 instances per sector — denser
 * than other scatters because the read is "outside, foliage
 * everywhere," not "set-dressing."
 *
 * PRNG seed: `map.seed XOR 0x4E415455` ("NATU" tag) — diverges from
 * every other scatter sequence.
 */

import type { ObjexoomMap, Vec2 } from "@engine/engine";
import { polygonContains } from "@engine/engine";
import { mulberry32 } from "@engine/prng";
import { pickArchetype } from "@world/archetype";

const INSTANCES_PER_SECTOR_MIN = 4;
const INSTANCES_PER_SECTOR_MAX = 8;
const SKIP_RADIUS = 3;
const MIN_INSTANCE_SPACING = 1.5;
const MAX_SAMPLE_ATTEMPTS = 12;
const ID_STRIDE = 100;
/** Scale range applied to each clone so they don't read as identical. */
const SCALE_MIN = 0.15;
const SCALE_MAX = 0.32;

export interface NatureInstance {
	readonly id: number;
	readonly position: Vec2;
	readonly yaw: number;
	readonly scale: number;
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
 * Deterministic per-map nature scatter. Returns [] for non-courtyard
 * archetypes and for grid maps. Same `map.seed` → byte-identical layout.
 */
export function spawnNature(map: ObjexoomMap): NatureInstance[] {
	if (map.kind !== "sectors") return [];
	if (pickArchetype(map) !== "courtyard") return [];
	const out: NatureInstance[] = [];
	const rng = mulberry32((map.seed >>> 0) ^ 0x4e415455);
	const skipPoints: Vec2[] = [map.playerSpawn, map.exitPosition, map.keyPosition];

	for (const sector of map.sectors) {
		if (sector.vertices.length < 3) continue;
		const { minX, maxX, minY, maxY } = bboxOf(sector.vertices);
		const target =
			INSTANCES_PER_SECTOR_MIN +
			Math.floor(rng() * (INSTANCES_PER_SECTOR_MAX - INSTANCES_PER_SECTOR_MIN + 1));

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
			out.push({
				id: sector.id * ID_STRIDE + placed.length - 1,
				position: accepted,
				yaw: rng() * Math.PI * 2,
				scale: SCALE_MIN + rng() * (SCALE_MAX - SCALE_MIN),
			});
		}
	}
	return out;
}
