/**
 * D5 — per-archetype enemy mix table (24-kind expansion).
 *
 * Supersedes the E13-step-3 + POL42 3-tuple table. Each archetype
 * carries a Record<EnemyKind, number> whose values sum to 1.0
 * (probability mass). At spawn time the existing 3-kind enemy
 * generator output is REMAPPED via this table: each spawn's kind
 * is replaced by a draw from the archetype's distribution.
 *
 * The PRD §D5 archetype headlines:
 *   corridor: rattler, bouncer, mrZ, anomaly variants
 *   arena:    bighoss, goliath, stagged, gorehead
 *   courtyard:lupin, stomper, swiney
 *   sewer:    grub, dolly, swiney, butcher
 *   library:  plaguebeak, gawker, reverend, dolly
 *
 * `devil` is the only boss-tier kind and is intentionally NOT in
 * any archetype's regular mix — it spawns via a separate boss-gate
 * (currently 1-per-level rare; D7+ may parametrize). Its zero
 * weight here means a procedural map never rolls a devil from the
 * normal mix.
 *
 * Each table is constructed by listing the headline kinds and any
 * tail kinds; the helper `normalize` sums and divides so values
 * always sum to exactly 1.0. The per-archetype test asserts this
 * invariant across all 5 archetypes.
 *
 * Determinism: the picker uses the existing ENMX-tagged PRNG (seed
 * XOR 0x454E4D58) so same seed → same kind sequence per archetype.
 */

import type { EnemyKind, EnemySpawn } from "@engine/engine";
import { mulberry32 } from "@engine/prng";
import type { PropArchetype } from "@world/scatter/propPool";

export type EnemyMixTable = Readonly<Record<EnemyKind, number>>;

// All 24 EnemyKinds, in declaration order, so the picker can walk a
// fixed bucket sequence regardless of the per-archetype table.
const ALL_KINDS: readonly EnemyKind[] = [
	"rattler",
	"phaser",
	"bouncer",
	"plaguebeak",
	"jester",
	"reverend",
	"stagged",
	"grub",
	"signal",
	"heap",
	"heap2",
	"gorehead",
	"bighoss",
	"stomper",
	"butcher",
	"bloodphaser",
	"devil",
	"dolly",
	"gawker",
	"oneye",
	"goliath",
	"swiney",
	"mrZ",
	"lupin",
];

function normalize(weights: Readonly<Partial<Record<EnemyKind, number>>>): EnemyMixTable {
	const table: Record<EnemyKind, number> = {} as Record<EnemyKind, number>;
	for (const k of ALL_KINDS) table[k] = weights[k] ?? 0;
	let total = 0;
	for (const k of ALL_KINDS) total += table[k];
	if (total === 0) throw new Error("normalize: weights sum to zero");
	for (const k of ALL_KINDS) table[k] = table[k] / total;
	return table;
}

/**
 * Per-archetype kind mix. Headline (heavy) weights + tail (lighter)
 * weights per PRD §D5. The exact numeric weights are tuning knobs;
 * the only invariant enforced here is that they normalize to 1.0.
 *
 * Corridor: classic mix — rattler-heavy with mrZ + signal accent.
 * Arena:    big tank parade — bighoss + goliath + stomper + stagged.
 * Courtyard:outdoor brawl — lupin + stomper + swiney lead.
 * Sewer:    cramped horror — grub swarm + dolly + butcher + swiney.
 * Library:  ranged hex — plaguebeak gas + gawker eyes + reverend.
 */
export const ENEMY_MIX_TABLES: Readonly<Record<PropArchetype, EnemyMixTable>> = {
	corridor: normalize({
		rattler: 6,
		bouncer: 3,
		mrZ: 2,
		signal: 1, // "anomaly variant" — wraith-like through-wall ranged
		reverend: 1,
		stagged: 1,
	}),
	arena: normalize({
		bighoss: 4,
		goliath: 3,
		stagged: 2,
		gorehead: 2,
		bouncer: 2,
		heap: 1,
		heap2: 1,
	}),
	courtyard: normalize({
		lupin: 4,
		stomper: 3,
		swiney: 3,
		rattler: 2,
		jester: 1,
		dolly: 1,
	}),
	sewer: normalize({
		grub: 4,
		dolly: 3,
		swiney: 2,
		butcher: 2,
		phaser: 2,
		plaguebeak: 1,
	}),
	library: normalize({
		plaguebeak: 3,
		gawker: 3,
		reverend: 3,
		dolly: 2,
		jester: 1,
	}),
};

function pickKindFromTable(table: EnemyMixTable, rng: () => number): EnemyKind {
	const r = rng();
	let acc = 0;
	for (const k of ALL_KINDS) {
		acc += table[k];
		if (r <= acc) return k;
	}
	// Falls through only on floating-point edge — return last non-zero kind.
	for (let i = ALL_KINDS.length - 1; i >= 0; i -= 1) {
		if (table[ALL_KINDS[i]] > 0) return ALL_KINDS[i];
	}
	return "rattler"; // unreachable given normalize() guarantees > 0
}

/**
 * Apply the per-archetype enemy mix to a map's enemy spawns.
 * Preserves count, order, and position. Only rewrites `kind`.
 *
 * D5 — corridor no longer pass-through; it has its own mix table
 * now (rattler-heavy + mrZ + signal accent). Canonical-byte
 * stability for the seed-0 corridor screenshot is no longer
 * preserved through this function — the visual gate will regen
 * the screenshot in the same commit.
 */
export function remapEnemyMix(
	spawns: readonly EnemySpawn[],
	archetype: PropArchetype,
	seed: number,
): readonly EnemySpawn[] {
	const table = ENEMY_MIX_TABLES[archetype];
	const rng = mulberry32((seed >>> 0) ^ 0x454e4d58);
	return spawns.map((spawn) => ({
		...spawn,
		kind: pickKindFromTable(table, rng),
	}));
}
