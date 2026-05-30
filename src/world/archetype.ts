/**
 * E13 step-1 — procedural archetype deepening.
 *
 * Picks a `PropArchetype` per map deterministically. Step-1 only wires
 * the prop-pool axis (E3 consumes the choice); step-2+ will add
 * lighting palette, enemy mix, and SFX ambient bed per PRD §E13.
 *
 * The mapping is `ARCHETYPE_NAMES[map.seed % 5]` — five archetypes
 * cycle through every run. Same seed → same archetype across reloads.
 */

import type { BoneBusterMap } from "@engine/mapTypes";
import { cyrb128 } from "@engine/rng";
import type { PropArchetype } from "@world/scatter/propPool";

/** The archetype a given seed phrase hashes to (`cyrb128[0] % 5`). */
export function archetypeForPhrase(seedPhrase: string): PropArchetype {
	const a = ARCHETYPE_NAMES[cyrb128(seedPhrase)[0] % ARCHETYPE_NAMES.length];
	if (a === undefined) throw new RangeError("archetypeForPhrase: index out of bounds");
	return a;
}

/**
 * Canonical archetype order, as a `Record<PropArchetype, slotIndex>` literal.
 * The numeric value IS the archetype's `(hash % 5)` slot — reordering changes
 * which seeds map to which archetype. Order matches `docs/PRD.md §E13`.
 *
 * Declaring this as `Record<PropArchetype, number>` (not a bare array) makes
 * the TYPE the safety net the registry doc advertises: adding a 6th name to
 * `PropArchetype` fails to compile HERE until its slot is added, and every
 * derived structure (ARCHETYPE_NAMES, BIOMES, biome pressure) inherits the
 * exhaustiveness for free. The `as const satisfies` pins the slot values too.
 */
const ARCHETYPE_SLOTS = {
	corridor: 0,
	arena: 1,
	courtyard: 2,
	sewer: 3,
	library: 4,
} as const satisfies Record<PropArchetype, number>;

/**
 * Canonical archetype order — derived from `ARCHETYPE_SLOTS` keys, sorted by
 * slot index so the array order matches the documented `(hash % 5)` mapping.
 */
export const ARCHETYPE_NAMES: readonly PropArchetype[] = (
	Object.keys(ARCHETYPE_SLOTS) as PropArchetype[]
).sort((a, b) => ARCHETYPE_SLOTS[a] - ARCHETYPE_SLOTS[b]);

/**
 * Build a `Record<PropArchetype, V>` from a per-archetype factory. The mapped
 * type forces `value(name)` to run for EVERY archetype, so the result is a
 * fully-populated record with NO missing-key cast — callers (BIOMES, biome
 * pressure) get compiler-enforced completeness instead of an `as` launder.
 */
export function archetypeRecord<V>(value: (name: PropArchetype) => V): Record<PropArchetype, V> {
	const out = {} as Record<PropArchetype, V>;
	for (const name of Object.keys(ARCHETYPE_SLOTS) as PropArchetype[]) out[name] = value(name);
	return out;
}

/**
 * Per-map archetype accessor. CONV3 (2026-05-15) denormalized
 * `archetype` onto the map type — this function is now a trivial
 * read kept for call-site readability. The single computation
 * lives in `buildMap`/`generateMap`/`loadRefLevel`; downstream
 * consumers MUST NOT recompute the modulus.
 */
export function pickArchetype(map: BoneBusterMap): PropArchetype {
	return map.archetype;
}

/**
 * INF3 / SEED2 — rewrite a seed PHRASE so it hashes to the named archetype.
 * Caller is the Shell URL-flag plumbing (`?bonebusterArchetype=`). Since the
 * archetype now derives from `cyrb128(phrase)[0] % 5` (not `seed % 5`), we
 * can't arithmetically rewrite the value — instead we append a numeric suffix
 * to the phrase and increment until the hash lands on the target archetype.
 * Deterministic (no RNG) and always terminates fast (each suffix is ~1/5 to
 * match). Pure function — lives here so unit tests pin it without any TSX.
 *
 * Contract: after override, `archetypeForPhrase(returned) === archetype`.
 * Unknown archetype names return the phrase unchanged.
 */
export function applyArchetypeOverride(seedPhrase: string, archetype: string | null): string {
	if (!archetype) return seedPhrase;
	const idx = ARCHETYPE_NAMES.indexOf(archetype as PropArchetype);
	if (idx < 0) return seedPhrase;
	if (cyrb128(seedPhrase)[0] % ARCHETYPE_NAMES.length === idx) return seedPhrase;
	for (let n = 1; n < 1000; n++) {
		const candidate = `${seedPhrase}-${n}`;
		if (cyrb128(candidate)[0] % ARCHETYPE_NAMES.length === idx) return candidate;
	}
	// Statistically impossible to reach: each suffix has ~1/5 odds of matching,
	// so 999 consecutive misses is ~(4/5)^999 ≈ 10^-97. We THROW rather than
	// return a phrase that hashes to the WRONG archetype — a silent drop would
	// make a forced-archetype QA/test run lie about which map it's showing.
	// (Kept pure: callers that can't tolerate a throw pass a null archetype.)
	throw new Error(
		`applyArchetypeOverride: no suffix in 1..999 hashed "${seedPhrase}" to "${archetype}"`,
	);
}
