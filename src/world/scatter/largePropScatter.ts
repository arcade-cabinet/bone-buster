/**
 * COV2 step-2 — anchor-piece scatter for large props.
 *
 * Sparser than propScatter (E3, 2-5 per sector) and debrisScatter
 * (COV5, 3-5 per sector). Large props are FOV-dominating set-dressing:
 * one or two per sector reads as a single hero anchor, not clutter.
 *
 * Why a separate module from propScatter/debrisScatter:
 *  - 1-2 per sector instead of 2-5 / 3-5.
 *  - Skip-radius is 5 tiles (vs 4 elsewhere) so anchor pieces stay
 *    away from spawn/exit/key — they're too physically large to risk
 *    blocking the critical-navigation corridor.
 *  - Min inter-prop spacing 2.5 tiles so two anchors don't read as
 *    a single mass.
 *  - PRNG seeded with `map.seed XOR 0x4C415250` ("LARP" tag → diverges
 *    from LMP / PROP / FLRT / DEBR / decal-FNV sequences).
 *  - Draws from the COV2 LARGE_PROPS pool (10 entries, 2 of which carry
 *    `blocking: true` + a `blockingRadius` consumed by collision).
 */

import type { BoneBusterMap, Vec2 } from "@engine/engine";
import { polygonContains } from "@engine/engine";
import { mulberry32, RNG_TAGS } from "@engine/prng";
import { pickArchetype } from "@world/archetype";
import type { LargePropDef } from "@world/largeProps";
import { LARGE_PROPS, pickLargePropDef } from "@world/largeProps";
import type { PropArchetype } from "@world/scatter/propPool";

const SKIP_RADIUS = 5;
const MIN_LARGE_SPACING = 2.5;
const MAX_SAMPLE_ATTEMPTS = 16;
const ID_STRIDE = 100;

/**
 * E13 step-16 — per-archetype large-prop density. Corridor preserves
 * `[1, 2]` for canonical byte-stability. Arena denser (more debris-as-cover);
 * library sparser (clean study halls); courtyard mid; sewer middle.
 */
const DENSITY_BY_ARCHETYPE: Readonly<Record<PropArchetype, readonly [number, number]>> = {
	corridor: [1, 2],
	arena: [1, 2],
	courtyard: [1, 2],
	sewer: [1, 2],
	library: [0, 1],
};

export interface LargePropInstance {
	/** Stable per-map id — `sectorId * 100 + indexInSector`. */
	readonly id: number;
	readonly position: Vec2;
	readonly yaw: number;
	readonly def: LargePropDef;
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
 * Deterministic per-map large-prop scatter. Grid maps return [].
 * Same `map.seed` → byte-identical layout.
 */
export function spawnLargeProps(map: BoneBusterMap): LargePropInstance[] {
	if (map.kind !== "sectors") return [];
	const out: LargePropInstance[] = [];
	const rng = mulberry32((map.seed >>> 0) ^ RNG_TAGS.LARP);
	const skipPoints: Vec2[] = [map.playerSpawn, map.exitPosition, map.keyPosition];
	const archetype = pickArchetype(map);
	const [minPerSector, maxPerSector] = DENSITY_BY_ARCHETYPE[archetype];

	for (const sector of map.sectors) {
		if (sector.vertices.length < 3) continue;
		const { minX, maxX, minY, maxY } = bboxOf(sector.vertices);
		const target = minPerSector + Math.floor(rng() * (maxPerSector - minPerSector + 1));

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
				if (nearAny(candidate, placed, MIN_LARGE_SPACING)) continue;
				accepted = candidate;
				break;
			}
			if (accepted === null) continue;
			placed.push(accepted);
			const hash = sector.id * 1000 + (placed.length - 1);
			const def = pickLargePropDef(hash);
			const yaw = rng() * Math.PI * 2;
			out.push({
				id: sector.id * ID_STRIDE + (placed.length - 1),
				position: accepted,
				yaw,
				def,
			});
		}
	}

	return out;
}

/** Filter the scatter down to its blocker circles for collision wiring. */
export function blockerCirclesOf(
	instances: readonly LargePropInstance[],
): readonly { position: Vec2; radius: number }[] {
	const out: { position: Vec2; radius: number }[] = [];
	for (const inst of instances) {
		if (!inst.def.blocking) continue;
		out.push({ position: inst.position, radius: inst.def.blockingRadius });
	}
	return out;
}

/** Re-export for test consumers. */
export { LARGE_PROPS };
