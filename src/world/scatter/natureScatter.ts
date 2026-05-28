/**
 * COV11 step-2 / PT2 — courtyard-archetype nature scatter.
 *
 * PT2 — the COV11 step-1 path cloned the entire `Mega_Nature.glb`
 * aggregate (31 plants laid out side-by-side) at every spawn site
 * with a tight 0.15-0.32 scale to hide the bulk. The result was
 * visually noisy (the same blob of nature copy-pasted per spawn) and
 * O(N) full-pack clones per map. PT2 picks ONE plant per spawn via
 * `pickNaturePlant(id, mapSeed)`, lifts the scale to a sensible
 * single-plant range (0.6-1.4), and migrates the renderer to
 * `InstancedMultiGltfField`.
 *
 * Fires only on courtyard-archetype maps. 4-8 instances per sector.
 *
 * PRNG seed: `map.seed XOR 0x4E415455` ("NATU" tag) — diverges from
 * every other scatter sequence.
 */

import type { BoneBusterMap, Vec2 } from "@engine/engine";
import { polygonContains } from "@engine/engine";
import { mulberry32, RNG_TAGS, taggedSeed } from "@engine/prng";
import { pickArchetype } from "@world/archetype";
import { pickNaturePlant } from "@world/nature";

const INSTANCES_PER_SECTOR_MIN = 4;
const INSTANCES_PER_SECTOR_MAX = 8;
const SKIP_RADIUS = 3;
const MIN_INSTANCE_SPACING = 1.5;
const MAX_SAMPLE_ATTEMPTS = 12;
const ID_STRIDE = 100;
/**
 * Scale range applied per single-plant instance. PT2 lifted these
 * from 0.15-0.32 (which was sized for the full Mega_Nature aggregate)
 * to 0.6-1.4 (which reads as a single plant at courtyard scale).
 */
const SCALE_MIN = 0.6;
const SCALE_MAX = 1.4;

export interface NatureInstance {
	readonly id: number;
	readonly position: Vec2;
	readonly yaw: number;
	readonly scale: number;
	/** PT2 — deterministic per-instance plant pick (see pickNaturePlant). */
	readonly url: string;
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
export function spawnNature(map: BoneBusterMap): NatureInstance[] {
	if (map.kind !== "sectors") return [];
	if (pickArchetype(map) !== "courtyard") return [];
	const out: NatureInstance[] = [];
	const rng = mulberry32(taggedSeed(map.seed, RNG_TAGS.NATU));
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
			const id = sector.id * ID_STRIDE + placed.length - 1;
			out.push({
				id,
				position: accepted,
				yaw: rng() * Math.PI * 2,
				scale: SCALE_MIN + rng() * (SCALE_MAX - SCALE_MIN),
				url: pickNaturePlant(id, map.seed),
			});
		}
	}
	return out;
}
