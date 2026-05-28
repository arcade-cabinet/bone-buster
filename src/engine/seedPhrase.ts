/**
 * SEED1 — adjective-adjective-noun seed phrase (matches the arcade-cabinet
 * sibling seed-phrase pattern). The phrase IS the human-
 * facing map identity; picking a random one is "just another event draw" from
 * the event PRNG, so there's no Math.random() in the sim core.
 *
 * Word lists are bone-buster-flavored — grisly arcade-horror / PSX-doom tone,
 * not the sibling games' high-fantasy lists.
 */

import type { Rng } from "@engine/rng";

/** First adjective — texture / state. */
const ADJECTIVES_1 = [
	"Rotten",
	"Gnashing",
	"Festering",
	"Brittle",
	"Marrowed",
	"Cracked",
	"Bleached",
	"Splintered",
	"Writhing",
	"Glistening",
	"Hollow",
	"Scabbed",
] as const;

/** Second adjective — mood / dread. */
const ADJECTIVES_2 = [
	"Cursed",
	"Forsaken",
	"Buried",
	"Unhallowed",
	"Maddened",
	"Howling",
	"Sunken",
	"Wretched",
	"Profane",
	"Gibbering",
	"Damned",
	"Vile",
] as const;

/** Noun — place / thing. */
const NOUNS = [
	"Ossuary",
	"Catacomb",
	"Reliquary",
	"Charnel",
	"Crypt",
	"Mausoleum",
	"Sepulcher",
	"Gibbet",
	"Boneyard",
	"Abattoir",
	"Shambles",
	"Marrow",
] as const;

/** Pick an element of a non-empty list using a draw from `rng`. */
function pick<T>(list: readonly T[], rng: Rng): T {
	const item = list[Math.floor(rng() * list.length)];
	if (item === undefined) throw new Error("pick from empty list");
	return item;
}

/**
 * Generate a random `adjective-adjective-noun` seed phrase, lower-cased and
 * hyphen-joined (e.g. `rotten-cursed-ossuary`). Draws from the EVENT PRNG —
 * picking a phrase is just another event, so the sim core stays
 * Math.random()-free. The phrase is the human-facing map seed.
 */
export function randomSeedPhrase(rng: Rng): string {
	return [pick(ADJECTIVES_1, rng), pick(ADJECTIVES_2, rng), pick(NOUNS, rng)]
		.map((w) => w.toLowerCase())
		.join("-");
}

/** True if `s` is a well-formed lowercase `word-word-word` phrase. */
export function isSeedPhrase(s: string): boolean {
	return /^[a-z]+-[a-z]+-[a-z]+$/.test(s);
}

/**
 * The frozen canonical phrase the screenshot suite + determinism tests pin
 * against (replaces the old numeric "seed 0 = corridor" anchor). Changing it
 * re-blesses every canonical golden — DON'T without reason.
 */
// Hashes to archetype idx 0 (corridor) via cyrb128[0] % 5 — the frozen
// canonical anchor. Changing it re-blesses every canonical golden.
export const CANONICAL_SEED_PHRASE = "marrowed-vile-sepulcher";
