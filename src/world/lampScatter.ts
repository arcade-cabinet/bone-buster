/**
 * COV1 — PSX Mega Pack II Light Sources scatter.
 *
 * Owns the lamp-variant pool + per-map scatter algorithm. The scatter
 * lives outside `models.ts` (which is the asset-URL registry) because
 * lamps have spawn-time geometry: each lamp instance carries its own
 * position, variant choice, and on/off state. The renderer reads
 * `LampInstance[]` and draws one mesh per entry.
 *
 * E4 will wire a scoped `pointLight` per lamp marked `on: true`,
 * capped at `MAX_LIT_LAMPS` so the shadow-map budget stays bounded.
 * COV1 ships the asset enabler + the placement; E4 owns the lighting
 * pass.
 */

import { A } from "@assets/assetUrl";
import type { BoneBusterMap, Vec2 } from "@engine/engine";
import { mulberry32 } from "@engine/prng";

/**
 * The 10 PSX Mega Pack II lamp GLBs, split by on/off state.
 * Five distinct shapes (1_a, 1_b, 2, 3, 4) × off/on each.
 * Variant index = position in the array — the off/on arrays are
 * length-matched so `LAMP_VARIANTS_OFF[i]` and `LAMP_VARIANTS_ON[i]`
 * are the same physical lamp at different states.
 */
export const LAMP_VARIANTS_OFF: readonly string[] = [
	A("/assets/models/props/lamps/lamp_mx_1_a_off.glb"),
	A("/assets/models/props/lamps/lamp_mx_1_b_off.glb"),
	A("/assets/models/props/lamps/lamp_mx_2_off.glb"),
	A("/assets/models/props/lamps/lamp_mx_3_off.glb"),
	A("/assets/models/props/lamps/lamp_mx_4_off.glb"),
];

export const LAMP_VARIANTS_ON: readonly string[] = [
	A("/assets/models/props/lamps/lamp_mx_1_a_on.glb"),
	A("/assets/models/props/lamps/lamp_mx_1_b_on.glb"),
	A("/assets/models/props/lamps/lamp_mx_2_on.glb"),
	A("/assets/models/props/lamps/lamp_mx_3_on.glb"),
	A("/assets/models/props/lamps/lamp_mx_4_on.glb"),
];

/**
 * Max number of lit lamps per level. Each lit lamp will (under E4)
 * get its own shadow-mapped pointLight; eight is a tight budget but
 * keeps Three.js's per-frame uniform packing under the WebGL2
 * MAX_FRAGMENT_UNIFORM_VECTORS ceiling on Apple/Adreno GPUs.
 */
export const MAX_LIT_LAMPS = 8;

export interface LampInstance {
	id: number;
	position: Vec2;
	/** Index into LAMP_VARIANTS_OFF / LAMP_VARIANTS_ON (0..4). */
	variantIndex: number;
	/** When true, render with LAMP_VARIANTS_ON[variantIndex] + E4's pointLight. */
	on: boolean;
}

/**
 * Deterministic per-map lamp scatter. Seed-driven so the same map
 * always renders with the same lamp layout across reloads.
 *
 * Strategy: place one lamp per sector centroid for sector maps,
 * skipping sectors closer than 3 tiles to the player spawn or exit
 * (those slots have their own anchor entities). At least 2 distinct
 * variants always appear when there are >= 2 sectors so the
 * acceptance criterion holds. The first `MAX_LIT_LAMPS` lamps light
 * up (`on: true`); the rest stay off.
 *
 * Grid maps don't scatter lamps in this slice — the procedural
 * cell-based geometry doesn't have a natural "sector centroid"; a
 * follow-on can add room-center placement once the use case demands
 * it.
 */
export function spawnLamps(map: BoneBusterMap): LampInstance[] {
	if (map.kind !== "sectors") return [];
	const out: LampInstance[] = [];
	const rng = mulberry32((map.seed >>> 0) ^ 0x4c4d50); // mix in a "LMP" tag
	const skipRadius = 3;
	const skipPoints: Vec2[] = [map.playerSpawn, map.exitPosition, map.keyPosition];

	for (const sector of map.sectors) {
		if (sector.vertices.length === 0) continue;
		let cx = 0;
		let cy = 0;
		for (const v of sector.vertices) {
			cx += v.x;
			cy += v.y;
		}
		const center = { x: cx / sector.vertices.length, y: cy / sector.vertices.length };
		const skip = skipPoints.some((p) => Math.hypot(p.x - center.x, p.y - center.y) < skipRadius);
		if (skip) continue;
		const variantIndex = Math.floor(rng() * LAMP_VARIANTS_OFF.length);
		out.push({
			id: sector.id,
			position: center,
			variantIndex,
			on: false, // E4 flips a subset on; COV1 places the assets only
		});
	}

	// Acceptance: ≥2 variants when ≥2 sectors. If by chance every placed
	// lamp landed on the same variantIndex, nudge the second one to a
	// neighbor index so the variant count >= 2.
	if (out.length >= 2) {
		const firstVar = out[0].variantIndex;
		if (out.every((lamp) => lamp.variantIndex === firstVar)) {
			out[1].variantIndex = (firstVar + 1) % LAMP_VARIANTS_OFF.length;
		}
	}

	// E4 — flip the first MAX_LIT_LAMPS lamps to lit. The renderer
	// (LampField) emits a scoped shadow-mapped pointLight at each lit
	// position. Capped so the WebGL2 uniform/shadow budget stays
	// bounded; lamps past the cap render with the OFF variant and
	// contribute zero per-frame light cost.
	for (let i = 0; i < Math.min(MAX_LIT_LAMPS, out.length); i += 1) {
		out[i].on = true;
	}

	return out;
}

/** Resolve the GLB URL for an instance based on its on/off state. */
export function lampUrlFor(instance: LampInstance): string {
	return instance.on
		? LAMP_VARIANTS_ON[instance.variantIndex]
		: LAMP_VARIANTS_OFF[instance.variantIndex];
}

/** Returns the count of distinct variantIndex values across a scatter. */
export function countLampVariants(instances: readonly LampInstance[]): number {
	const s = new Set<number>();
	for (const lamp of instances) s.add(lamp.variantIndex);
	return s.size;
}
