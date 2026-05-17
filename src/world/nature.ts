/**
 * COV11 step-1 / PT2 — outdoor nature pack.
 *
 * Originally staged `Mega_Nature.glb` (a scene-aggregate GLB packing
 * 31 individual nature meshes side-by-side). PT2 scene-splits the
 * aggregate into per-plant GLBs (via
 * `scripts/blender/mega-nature-split.py`) so the NatureField renderer
 * can pick ONE plant per scatter position instead of cloning the
 * full pack at every spawn site.
 *
 * The split lives at `public/assets/models/props/nature/<plant>.glb`
 * — 31 entries, one per top-level mesh in the source bundle. The
 * original `Mega_Nature.glb` is retained for back-compat with
 * `NATURE_MEGA_PACK_URL` (still referenced by a contract test); it
 * is not loaded at runtime anymore.
 *
 * Per-instance plant choice is deterministic via `pickNaturePlant`
 * (XOR-mixed hash of the instance id + map seed) so every map
 * renders the same plant assignment across reloads.
 */

import { A } from "@assets/assetUrl";
import { COSMETIC_TAGS, pickCosmetic } from "@engine/prng";

export const NATURE_MEGA_PACK_URL: string = A("/assets/models/props/nature/Mega_Nature.glb");

/**
 * PT2 — per-plant variant pool. 31 GLBs split from the Mega_Nature
 * aggregate. Flat (not categorized by family) so the picker is a
 * single modulo over a fixed-length list and the NatureField
 * renderer can group purely by url for instancing.
 */
export const NATURE_PLANT_URLS: readonly string[] = [
	A("/assets/models/props/nature/forest_tree_1.glb"),
	A("/assets/models/props/nature/forest_tree_2.glb"),
	A("/assets/models/props/nature/forest_tree_3.glb"),
	A("/assets/models/props/nature/forest_tree_log.glb"),
	A("/assets/models/props/nature/birtch_tree_1.glb"),
	A("/assets/models/props/nature/birtch_tree_2.glb"),
	A("/assets/models/props/nature/birtch_tree_3.glb"),
	A("/assets/models/props/nature/birtch_log_1.glb"),
	A("/assets/models/props/nature/fir_tree_1.glb"),
	A("/assets/models/props/nature/fir_tree_2.glb"),
	A("/assets/models/props/nature/fir_tree_3.glb"),
	A("/assets/models/props/nature/fir_tree_log.glb"),
	A("/assets/models/props/nature/burnt_tree_1.glb"),
	A("/assets/models/props/nature/burnt_tree_2.glb"),
	A("/assets/models/props/nature/burn_tree_3.glb"),
	A("/assets/models/props/nature/burnt_log.glb"),
	A("/assets/models/props/nature/bush_1.glb"),
	A("/assets/models/props/nature/bush_2.glb"),
	A("/assets/models/props/nature/bush_3.glb"),
	A("/assets/models/props/nature/bush_4.glb"),
	A("/assets/models/props/nature/grass_1.glb"),
	A("/assets/models/props/nature/grass_2.glb"),
	A("/assets/models/props/nature/weed_1.glb"),
	A("/assets/models/props/nature/yellow_flowers_1.glb"),
	A("/assets/models/props/nature/yellow_flowers_2.glb"),
	A("/assets/models/props/nature/red_flowers_1.glb"),
	A("/assets/models/props/nature/red_flowers_2.glb"),
	A("/assets/models/props/nature/white_flowers_1.glb"),
	A("/assets/models/props/nature/white_flowers_2.glb"),
	A("/assets/models/props/nature/blue_flowers_1.glb"),
	A("/assets/models/props/nature/blue_flowers_2.glb"),
];

/**
 * Deterministic per-instance plant pick via the D19 cosmetic stream.
 *
 * Routes through `pickCosmetic(mapSeed, PLANT_TAG, instanceId, pool)`.
 * Adjacent instance ids on the same map yield different plants (alea
 * avalanche); the same `(instanceId, mapSeed)` pair always picks the
 * same plant.
 *
 * `mapSeed === 0` short-circuits to `NATURE_PLANT_URLS[0]` for all
 * instanceIds so the seed=0 canonical screenshot stays byte-stable.
 */
export function pickNaturePlant(instanceId: number, mapSeed: number): string {
	return pickCosmetic(mapSeed, COSMETIC_TAGS.PLANT, instanceId, NATURE_PLANT_URLS);
}
