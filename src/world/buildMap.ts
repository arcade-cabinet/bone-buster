import { generateMap } from "@engine/gridGen";
import type { BoneBusterGridMap } from "@engine/mapTypes";
import type { Difficulty } from "@store/settings";
import { getArchetypeMapShape } from "@world/archetypeMapShape";
import type { PropArchetype } from "@world/scatter/propPool";

/**
 * STRUCT1 (D23 / docs/specs/97) — build the active map fully procedurally.
 *
 * Identity is DEPTH+PHRASE: geometry forks off `(seedPhrase, depth)` so the
 * same phrase yields a deterministic maze SEQUENCE down the descent (depth =
 * biomes cleared so far). The `biome` is chosen SEPARATELY by the STRUCT5
 * pressure pick (event PRNG, per run) and drives the per-biome shape override +
 * the archetype skin worn over that geometry.
 *
 * The old `LevelChoice` branch (numeric 1..5 → `loadRefLevel`) is gone — every
 * map is generated. refLevels survive only as biome STYLE prototypes + test
 * fixtures (`loadRefLevel`), never the runtime path.
 *
 * `difficulty` is accepted for call-site parity (and future STRUCT3 depth
 * scaling); the grid generator doesn't read it today.
 */
export function buildMap(
	seedPhrase: string,
	depth: number,
	biome: PropArchetype,
	_difficulty: Difficulty = "hurtMePlenty",
): BoneBusterGridMap {
	return generateMap(seedPhrase, {
		shape: getArchetypeMapShape(biome),
		depth,
		biome,
	});
}
