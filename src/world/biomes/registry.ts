/**
 * STRUCT2 (docs/specs/97) — the BIOME registry: one generator entry per biome,
 * built on the shared MazeGenerator core (STRUCT1). Each biome composes the
 * core topology with ITS shape + (via the archetype it names) its scatter,
 * enemy mix, hazards, and biome-specific triggers — so each biome feels unique
 * and the procgen builds infinite variety.
 *
 * THE EXTENSION POINT — "add a biome = add a generator → hours of play":
 *   1. add the biome name to `PropArchetype` (TypeScript then forces every
 *      per-archetype table — archetypeRegistry, ARCHETYPE_MAP_SHAPES, scatter
 *      gates, enemy mix — to handle it; that exhaustiveness IS the safety net),
 *   2. add a `BiomeGenerator` entry here.
 * The pressure system (STRUCT5) then folds it into the rotation automatically.
 *
 * A biome generator is `(seedPhrase, depth) → BoneBusterGridMap`. Today every
 * biome shares the grid core differing by shape + archetype skin; a biome that
 * needs a different REPRESENTATION (e.g. sector polygons for organic space) or
 * bespoke triggers swaps its `generate` for one that calls a different core or
 * post-processes the map — the contract is the same, so biomes can diverge
 * arbitrarily without touching the others or the caller.
 */

import { generateMap } from "@engine/gridGen";
import type { BoneBusterGridMap } from "@engine/mapTypes";
import { ARCHETYPE_NAMES } from "@world/archetype";
import { getArchetypeMapShape } from "@world/archetypeMapShape";
import type { PropArchetype } from "@world/scatter/propPool";

export type BiomeGenerator = {
	/** The biome / archetype identity (drives scatter + enemy mix + skin). */
	readonly biome: PropArchetype;
	/** Generate this biome's map for a descent depth. */
	generate(seedPhrase: string, depth: number): BoneBusterGridMap;
};

/** The default grid-core biome generator: shape override + archetype skin. */
function gridBiome(biome: PropArchetype): BiomeGenerator {
	return {
		biome,
		generate(seedPhrase, depth) {
			return generateMap(seedPhrase, { shape: getArchetypeMapShape(biome), depth, biome });
		},
	};
}

/**
 * The biome registry — one generator per biome. Derived from ARCHETYPE_NAMES so
 * adding a biome to that list (after wiring its per-archetype tables) auto-adds
 * a default grid generator here; override the entry to give a biome a bespoke
 * representation or triggers.
 */
export const BIOMES: Readonly<Record<PropArchetype, BiomeGenerator>> = Object.fromEntries(
	ARCHETYPE_NAMES.map((b) => [b, gridBiome(b)]),
) as Record<PropArchetype, BiomeGenerator>;

/** Generate the map for a (biome, seedPhrase, depth) — the STRUCT2 entry point. */
export function generateBiomeMap(
	biome: PropArchetype,
	seedPhrase: string,
	depth: number,
): BoneBusterGridMap {
	return BIOMES[biome].generate(seedPhrase, depth);
}
