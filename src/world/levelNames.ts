/**
 * D8 — alliterative level-name generator.
 *
 * Replaces the old E1M1/E1M2 numeric pattern with a Bone Buster-flavored
 * two-word alliterative name per generated map. The HUD reads
 * `pickLevelName(archetype, seed)` instead of `${LEVEL_LABEL[level]}`.
 *
 * Per-archetype pools tuned to mood:
 *   corridor  — C-words, claustrophobic + machine
 *   arena     — A-words, open + aggressive
 *   courtyard — C-words too (sharing initial keeps the brand-shape
 *               B+B/C+C consistent across archetypes); leans verdant
 *   sewer     — S-words, wet + decay
 *   library   — L-words, paper + hush
 *
 * Determinism: the picker is a pure-fn `(archetype, seed) → string`
 * keyed off the seed via a stable XOR tag (NAME tag) so the picked
 * name is independent of every other PRNG stream. Same seed always
 * yields the same name; different seeds yield different names
 * (within the pool's size).
 *
 * Refs (refLevel 0+) return the fixed `WELCOME_WING_NAME = "Welcome
 * Wing"` instead of going through the generator — refs are
 * onboarding-fixed; their identity is the name itself, not a roll.
 */

import { mulberry32 } from "@engine/prng";
import type { PropArchetype } from "@world/scatter/propPool";

export const WELCOME_WING_NAME = "Welcome Wing";

export const LEVEL_NAME_POOLS: Readonly<Record<PropArchetype, readonly string[]>> = {
	corridor: [
		"Crimson Crawl",
		"Cinder Cell",
		"Clatter Catacomb",
		"Cobalt Choke",
		"Crypt Crucible",
		"Coal Cordon",
		"Chrome Chasm",
		"Carrion Corridor",
	],
	arena: [
		"Ashen Altar",
		"Anvil Approach",
		"Acid Atrium",
		"Argent Arena",
		"Aurora Arc",
		"Antler Annex",
		"Augur Asylum",
		"Amber Apse",
	],
	courtyard: [
		"Coral Court",
		"Cinder Courtyard",
		"Cedar Cloister",
		"Copper Close",
		"Crimson Carpet",
		"Cobble Cradle",
		"Cypress Crown",
		"Coven Cove",
	],
	sewer: [
		"Slag Sluice",
		"Sodden Span",
		"Salt Sewer",
		"Soot Sump",
		"Stagnant Stem",
		"Sapphire Spill",
		"Sable Spine",
		"Steam Sublevel",
	],
	library: [
		"Lapis Library",
		"Lattice Loft",
		"Lichen Lectern",
		"Linen Loft",
		"Lattice Labyrinth",
		"Lacquer Lounge",
		"Lyric Lair",
		"Locked Logbook",
	],
};

/**
 * Pick a level name from the archetype's pool using a deterministic
 * seed-derived index. The XOR tag (0x4E414D45 = "NAME") keeps this
 * picker's stream disjoint from every other scatter PRNG so changing
 * a name pool can't accidentally shift unrelated procedural output.
 */
export function pickLevelName(archetype: PropArchetype, seed: number): string {
	const pool = LEVEL_NAME_POOLS[archetype];
	const rng = mulberry32((seed >>> 0) ^ 0x4e414d45);
	const idx = Math.floor(rng() * pool.length) % pool.length;
	return pool[idx];
}
