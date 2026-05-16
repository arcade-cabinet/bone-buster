import { generateMap, type ObjexoomMap } from "@engine/engine";
import type { Difficulty, LevelChoice } from "@store/settings";
import { ARCHETYPE_NAMES } from "@world/archetype";
import { getArchetypeMapShape } from "@world/archetypeMapShape";
import { loadRefLevel } from "@world/refLevel";

/**
 * Builds the active map from settings. "procedural" yields a seeded
 * generated grid map; numeric choices 1..5 load decoded reference levels
 * E1M1..E1M5 (RefLevelIndex 0..4).
 *
 * I4 — difficulty is passed through so reference-level `ManyEnemies`
 * (class 9) markers can expand into `DIFFICULTY*5 + 5 + count*π|0`
 * enemies per the ref formula instead of a fixed 2.
 *
 * E13 step-5 — procedural maps get a per-archetype shape override so
 * sector-density / size range varies per archetype. RefLevels stay
 * unchanged (their geometry is decoded from the reference clone).
 */
export function buildMap(
	seed: number,
	level: LevelChoice,
	difficulty: Difficulty = "hurtMePlenty",
): ObjexoomMap {
	if (level === "procedural") {
		// CONV3 — this is the ONE place we recompute the archetype
		// modulus, because `getArchetypeMapShape` needs it BEFORE
		// `generateMap` runs to pick the per-archetype sector density.
		// `generateMap` re-derives the same archetype internally and
		// writes it onto the returned map's `archetype` field, so this
		// pre-computation is a temporary the caller doesn't see.
		const archetype = ARCHETYPE_NAMES[(seed >>> 0) % ARCHETYPE_NAMES.length];
		return generateMap(seed, getArchetypeMapShape(archetype));
	}
	const refIdx = (level - 1) as 0 | 1 | 2 | 3 | 4;
	return loadRefLevel(refIdx, difficulty);
}
