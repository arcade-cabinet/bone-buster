/**
 * E13 step-3 — per-archetype enemy mix.
 *
 * Step-1 wired archetype to the prop pool; step-2 wired it to the
 * lighting palette. Step-3 extends to the enemy roster: each archetype
 * tilts the 3-kind mix (skeleton / wraith / imp) toward a fingerprint
 * that complements the visual read.
 *
 * The transform takes the existing per-map enemy spawns and ONLY
 * rewrites the `kind` field per a deterministic per-archetype weight
 * table. Positions, total count, and spawn order all stay identical
 * — preserving the existing difficulty curve.
 *
 * Each weight table is a 3-tuple `[skeleton, wraith, imp]` of unsigned
 * integers. The picker is a simple cumulative-weight roll on a seeded
 * RNG (PRNG seeded with `map.seed XOR 0x454E4D58` "ENMX" tag → diverges
 * from every other scatter sequence). Same seed → same remap.
 *
 * Back-compat: the "corridor" entry preserves the existing baseline
 * distribution by passing through unchanged kinds (weight tuple
 * [0, 0, 0] is the sentinel for "no remap"). Any archetype with a
 * non-sentinel weight tuple runs the remap.
 */

import type { EnemyKind, EnemySpawn } from "./engine";
import type { PropArchetype } from "./scatter/propPool";

/** `[skeleton, wraith, imp]` — relative weights for the kind picker. */
export type EnemyMixWeights = readonly [number, number, number];

/** Sentinel value — "pass through, don't remap." */
const PASS_THROUGH: EnemyMixWeights = [0, 0, 0];

/**
 * Per-archetype weight tables. Corridor passes through (preserves the
 * existing kind distribution from `generateMap` / `loadRefLevel`).
 */
export const ENEMY_MIX_WEIGHTS: Readonly<Record<PropArchetype, EnemyMixWeights>> = {
	// Default mix — preserves the pre-step-3 distribution byte-for-byte.
	corridor: PASS_THROUGH,
	// Heavy combat pit — leans imp (high HP melee). Sparse wraiths
	// because no-clip flyers in a tight arena read as cheap.
	arena: [3, 1, 5],
	// Outdoor courtyard — balanced; the open sightlines reward ranged
	// skeletons + the occasional wraith dive.
	courtyard: [4, 3, 2],
	// Sewer — heavy wraith (no-clip fits "things from the walls").
	sewer: [2, 5, 2],
	// Library — leans wraith + skirmish skeleton (paper enemies in a
	// paper place). Sparse imp because imps are floor-bound.
	library: [4, 4, 1],
};

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

const ENEMY_KIND_ORDER: readonly EnemyKind[] = ["skeleton", "wraith", "imp"];

/**
 * Pick an enemy kind from the weight tuple using `rng()`. If the tuple
 * is the pass-through sentinel ([0, 0, 0]), returns the input kind
 * unchanged so the corridor archetype is byte-identical to the
 * pre-step-3 spawn distribution.
 */
function pickKindFromWeights(
	weights: EnemyMixWeights,
	originalKind: EnemyKind,
	rng: () => number,
): EnemyKind {
	const total = weights[0] + weights[1] + weights[2];
	if (total === 0) return originalKind;
	let r = rng() * total;
	for (let i = 0; i < ENEMY_KIND_ORDER.length; i += 1) {
		r -= weights[i];
		if (r <= 0) return ENEMY_KIND_ORDER[i];
	}
	// Falls through only via floating-point edge; pick the last bucket.
	return ENEMY_KIND_ORDER[ENEMY_KIND_ORDER.length - 1];
}

/**
 * Apply the per-archetype enemy mix to a map's enemy spawns.
 * Preserves count, order, and position. Only rewrites `kind`.
 *
 * Returns the same array if the archetype is a pass-through (corridor).
 */
export function remapEnemyMix(
	spawns: readonly EnemySpawn[],
	archetype: PropArchetype,
	seed: number,
): readonly EnemySpawn[] {
	const weights = ENEMY_MIX_WEIGHTS[archetype];
	if (weights === PASS_THROUGH) return spawns;
	const rng = mulberry32((seed >>> 0) ^ 0x454e4d58);
	return spawns.map((spawn) => ({
		...spawn,
		kind: pickKindFromWeights(weights, spawn.kind, rng),
	}));
}
