/**
 * STRUCT5 — weighted biome-pressure selection. Each biome carries a `pressure`
 * = levels-since-it-was-last-played (higher = staler). On each level exit we
 * rank biomes by pressure (desc) and weighted-pick over the rank with
 * 50/30/15/5 (the 5th+ ranks share the tail), so the stalest biome is favored
 * but the next one is never predictable — no rote 1→5 cycle (docs/specs/97 D23).
 *
 * Pure: takes the current pressure map + an event RNG draw; returns the picked
 * biome + the NEXT pressure map (picked biome → 0, all others +1). The caller
 * persists the new pressure map in the event domain.
 */

import { at } from "@engine/arrayAt";
import type { Rng } from "@engine/rng";
import { ARCHETYPE_NAMES } from "@world/archetype";
import type { PropArchetype } from "@world/scatter/propPool";

export type BiomePressure = Record<PropArchetype, number>;

/** Weights applied over the pressure-rank (rank 0 = stalest). Rank ≥4 → tail. */
const RANK_WEIGHTS: readonly number[] = [0.5, 0.3, 0.15, 0.05];

/** Fresh pressure map — all biomes equally stale (0) at run start. */
export function initialBiomePressure(): BiomePressure {
	const out = {} as BiomePressure;
	for (const b of ARCHETYPE_NAMES) out[b] = 0;
	return out;
}

/**
 * Pick the next biome by weighted pressure rank, and return the advanced
 * pressure map. Deterministic given `(pressure, rng draw)`.
 *
 * Ranking ties (equal pressure) break by ARCHETYPE_NAMES order so the result is
 * stable for a given pressure map; the weighted roll then adds the variance.
 */
export function pickBiome(
	pressure: BiomePressure,
	rng: Rng,
): { biome: PropArchetype; pressure: BiomePressure } {
	// Rank by pressure desc, stable tiebreak by canonical order.
	const ranked = [...ARCHETYPE_NAMES].sort((a, b) => {
		const d = pressure[b] - pressure[a];
		if (d !== 0) return d;
		return ARCHETYPE_NAMES.indexOf(a) - ARCHETYPE_NAMES.indexOf(b);
	});

	// Build weights aligned to the ranking: ranks 0..3 take 50/30/15/5; any
	// rank ≥4 shares the last weight evenly so every biome stays reachable.
	const lastWeight = RANK_WEIGHTS[RANK_WEIGHTS.length - 1] ?? 0;
	const weights = ranked.map((_, i) => RANK_WEIGHTS[i] ?? lastWeight);
	const total = weights.reduce((s, w) => s + w, 0);

	// Weighted roll over the ranked list.
	let roll = rng() * total;
	let pickedIdx = ranked.length - 1;
	for (let i = 0; i < ranked.length; i += 1) {
		roll -= weights[i] ?? 0;
		if (roll <= 0) {
			pickedIdx = i;
			break;
		}
	}
	const biome = at(ranked, pickedIdx);

	// Advance pressure: picked → 0, everyone else +1 (staler).
	const next = {} as BiomePressure;
	for (const b of ARCHETYPE_NAMES) next[b] = b === biome ? 0 : pressure[b] + 1;

	return { biome, pressure: next };
}
