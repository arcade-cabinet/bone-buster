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

import { A } from "@assets/assetUrl";

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

/**
 * POL1 — per-loot-kind game-state bonus. The score / HP / ammo deltas
 * granted when the player picks up a COV12 loot pickup, keyed by the
 * variant `pickLootKind(map.seed)` selected at spawn time.
 *
 * Centralized here so the HUD's score chip rendering rule
 * (`score > 0` → display SCORE N) and the GameRef.onCollectPickup
 * branch in useGameRef.ts share one source of truth.
 *
 * - **treasure** — +50 score. The only loot kind that contributes
 *   to the visible HUD SCORE chip.
 * - **bottles** — +5 HP (potion stash). Clamped to maxHp by the
 *   caller.
 * - **books** — +pickupAmmo for chaingun AND shotgun (knowledge →
 *   ammo metaphor).
 */
export const LOOT_BONUSES = {
	treasureScore: 50,
	bottlesHp: 5,
} as const;
