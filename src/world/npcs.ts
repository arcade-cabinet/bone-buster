/**
 * COV14 step-1 — non-hostile NPC pool.
 *
 * 6 ChibiCharacters from `3DPSX/Characters/ChibiCharacters/` (archer,
 * knight, merchant, ninja, student, basemesh). Each is a full-rigged
 * GLB suitable for the future ambient HUB-archetype NPC set-dressing
 * per PRD §COV14.
 *
 * Step-1 ships the asset pool + a kind enum + picker. Step-2 will
 * extend EnemyKind with "npc" (FSM treats as ambient — no aggro, no
 * LOS, no attack) and have HUB sectors spawn one chibi per slot.
 */

import { A } from "@assets/assetUrl";

export type NpcKind = "archer" | "knight" | "merchant" | "ninja" | "student" | "basemesh";

export const NPC_URLS: Record<NpcKind, string> = {
	archer: A("/assets/models/enemies/npc/archer.glb"),
	knight: A("/assets/models/enemies/npc/knight.glb"),
	merchant: A("/assets/models/enemies/npc/merchant.glb"),
	ninja: A("/assets/models/enemies/npc/ninja.glb"),
	student: A("/assets/models/enemies/npc/student.glb"),
	basemesh: A("/assets/models/enemies/npc/basemesh.glb"),
};

export const NPC_URL_LIST: readonly string[] = Object.values(NPC_URLS);

/** Deterministic NPC-kind pick by hash. */
export function pickNpcKind(hash: number): NpcKind {
	const kinds: readonly NpcKind[] = [
		"archer",
		"knight",
		"merchant",
		"ninja",
		"student",
		"basemesh",
	];
	const idx = (hash >>> 0) % kinds.length;
	const kind = kinds[idx];
	if (kind === undefined) throw new RangeError(`pickNpcKind: index ${idx} of ${kinds.length}`);
	return kind;
}
