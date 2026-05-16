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

import type { EnemyKind, EnemySpawn } from "@engine/engine";
import { mulberry32 } from "@engine/prng";
import type { PropArchetype } from "@world/scatter/propPool";

/** `[skeleton, wraith, imp]` — relative weights for the kind picker. */
export type EnemyMixWeights = readonly [number, number, number];

/** Sentinel value — "pass through, don't remap." */
const PASS_THROUGH: EnemyMixWeights = [0, 0, 0];

/**
 * E13 step-3 base weights. Per-archetype skeleton/wraith/imp mix
 * before POL42's wraith-density bias is applied. Corridor stays as
 * the PASS_THROUGH sentinel; the bias never touches it.
 */
const BASE_MIX_WEIGHTS: Readonly<Record<PropArchetype, EnemyMixWeights>> = {
	corridor: PASS_THROUGH,
	arena: [3, 1, 5],
	courtyard: [4, 3, 2],
	sewer: [2, 5, 2],
	library: [4, 4, 1],
};

/**
 * POL42 — per-archetype wraith-density bias. Scales the wraith weight
 * (index 1 of the [skeleton, wraith, imp] tuple) by a multiplier per
 * archetype. The total of the resulting tuple is what's bucket-picked
 * against, so a higher wraith weight pulls more wraiths in
 * proportionally without bumping the total enemy count (count is set
 * elsewhere by generateMap and stays untouched).
 *
 * Corridor PASS_THROUGH is exempt — POL42 deliberately doesn't touch
 * the corridor distribution so refLevel 0 (corridor by seed%5) stays
 * byte-stable. The bias is a tilt INSIDE archetypes that already
 * have a tilted weight table.
 *
 * Bias tuning (mood-aligned, NOT a balance change):
 *   sewer    1.5× — dark, wraiths fit thematically
 *   library  1.4× — paper enemies in a paper place; lift the bias
 *                   already there (base wraith = imp at 4)
 *   courtyard 1.0× — balanced; no bias
 *   arena    0.7× — open combat; flyers feel cheap
 *
 * Effective wraith weights after bias (rounded to int via Math.round
 * since the picker requires integer cumulative buckets):
 *   arena:    1×0.7 → 1   (1 → 1, unchanged at this scale)
 *   courtyard 3×1.0 → 3   (unchanged)
 *   sewer:    5×1.5 → 8
 *   library:  4×1.4 → 6
 */
const WRAITH_BIAS: Readonly<Record<PropArchetype, number>> = {
	corridor: 1.0, // unused (PASS_THROUGH skips the bias)
	arena: 0.7,
	courtyard: 1.0,
	sewer: 1.5,
	library: 1.4,
};

function applyWraithBias(base: EnemyMixWeights, bias: number): EnemyMixWeights {
	if (base === PASS_THROUGH) return PASS_THROUGH;
	const biased = Math.max(1, Math.round(base[1] * bias));
	return [base[0], biased, base[2]];
}

/**
 * Per-archetype weight tables. Corridor passes through (preserves the
 * existing kind distribution from `generateMap` / `loadRefLevel`).
 * POL42 applies the wraith-density bias to every non-corridor entry.
 */
export const ENEMY_MIX_WEIGHTS: Readonly<Record<PropArchetype, EnemyMixWeights>> = {
	corridor: BASE_MIX_WEIGHTS.corridor,
	arena: applyWraithBias(BASE_MIX_WEIGHTS.arena, WRAITH_BIAS.arena),
	courtyard: applyWraithBias(BASE_MIX_WEIGHTS.courtyard, WRAITH_BIAS.courtyard),
	sewer: applyWraithBias(BASE_MIX_WEIGHTS.sewer, WRAITH_BIAS.sewer),
	library: applyWraithBias(BASE_MIX_WEIGHTS.library, WRAITH_BIAS.library),
};

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
