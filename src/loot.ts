/**
 * COV12 step-1 — fantasy loot pool.
 *
 * 3 hero GLBs from the 3DPSX Fantasy packs (Bottles, Books and
 * Scrolls, PSX Dungeon Loot Pack/Treasure) for rare bonus pickup
 * spawns. Each GLB is actually a scene-style aggregate containing
 * many individual meshes — step-2 can pull individual objects out
 * via SkeletonUtils.clone + child traversal if per-pickup variety
 * is needed.
 *
 * Step-1 ships the asset pool + a kind→URL mapping; step-2 wires
 * the pickup spawn (rare drop at ~1 per refLevel) into the engine's
 * pickup spawn loop with new PickupKind values.
 */

import { A } from "./assetUrl";

export type LootKind = "bottles" | "books" | "treasure";

export const LOOT_URLS: Record<LootKind, string> = {
	bottles: A("/assets/models/props/loot/Bottles.glb"),
	books: A("/assets/models/props/loot/Books.glb"),
	treasure: A("/assets/models/props/loot/Treasure.glb"),
};

/** All loot URLs as a readonly array (test + verifier consumption). */
export const LOOT_URL_LIST: readonly string[] = Object.values(LOOT_URLS);

/** Deterministic loot-kind pick by hash. */
export function pickLootKind(hash: number): LootKind {
	const kinds: readonly LootKind[] = ["bottles", "books", "treasure"];
	const idx = (hash >>> 0) % kinds.length;
	return kinds[idx];
}
