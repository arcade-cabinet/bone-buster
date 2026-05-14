/**
 * COV5 step-2 — sector-body debris scatter.
 *
 * Sparser cousin of propScatter (E3): places 3-5 debris piles per
 * non-spawn sector via deterministic seeded rejection sampling.
 * Reads as "this place has been overrun" per PRD §COV5 acceptance.
 *
 * Why a separate module from propScatter:
 *  - Debris piles are smaller items spread more loosely (no min-spacing
 *    constraint between them — clusters look natural).
 *  - Debris draws from `DEBRIS_VARIANTS` (10 entries), not the
 *    archetype-keyed POOLS.
 *  - The PRNG is seeded with `map.seed XOR 0x44455242` ("DEBR" tag)
 *    so it diverges from lampScatter (LMP), propScatter (PROP), and
 *    floorTiles (FLRT) sequences.
 */

import { DEBRIS_VARIANTS, pickDebrisUrl } from "../debris";
import type { ObjexoomMap, Vec2 } from "../engine";
import { polygonContains } from "../engine";

const SKIP_RADIUS = 4;
const DEBRIS_PER_SECTOR_MIN = 3;
const DEBRIS_PER_SECTOR_MAX = 5;
const MAX_SAMPLE_ATTEMPTS = 12;
const ID_STRIDE = 1000;

export interface DebrisInstance {
	readonly id: number;
	readonly position: Vec2;
	readonly yaw: number;
	readonly url: string;
}

function mulberry32(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function spawnDebris(map: ObjexoomMap): DebrisInstance[] {
	if (map.kind !== "sectors") return [];
	const out: DebrisInstance[] = [];
	const rng = mulberry32((map.seed >>> 0) ^ 0x44455242);
	const skipPoints: Vec2[] = [map.playerSpawn, map.exitPosition, map.keyPosition];

	for (const sector of map.sectors) {
		if (sector.vertices.length < 3) continue;
		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;
		for (const v of sector.vertices) {
			if (v.x < minX) minX = v.x;
			if (v.x > maxX) maxX = v.x;
			if (v.y < minY) minY = v.y;
			if (v.y > maxY) maxY = v.y;
		}

		const target =
			DEBRIS_PER_SECTOR_MIN +
			Math.floor(rng() * (DEBRIS_PER_SECTOR_MAX - DEBRIS_PER_SECTOR_MIN + 1));

		let placedInSector = 0;
		for (let i = 0; i < target; i += 1) {
			let accepted: Vec2 | null = null;
			for (let attempt = 0; attempt < MAX_SAMPLE_ATTEMPTS; attempt += 1) {
				const candidate: Vec2 = {
					x: minX + rng() * (maxX - minX),
					y: minY + rng() * (maxY - minY),
				};
				if (!polygonContains(candidate, sector.vertices)) continue;
				let tooClose = false;
				for (const sp of skipPoints) {
					if (Math.hypot(sp.x - candidate.x, sp.y - candidate.y) < SKIP_RADIUS) {
						tooClose = true;
						break;
					}
				}
				if (tooClose) continue;
				accepted = candidate;
				break;
			}
			if (accepted === null) continue;

			const hash = sector.id * 1000 + placedInSector;
			out.push({
				id: sector.id * ID_STRIDE + placedInSector,
				position: accepted,
				yaw: rng() * Math.PI * 2,
				url: pickDebrisUrl(hash),
			});
			placedInSector += 1;
		}
	}

	return out;
}

/** Re-export for test consumers checking URL membership. */
export { DEBRIS_VARIANTS };
