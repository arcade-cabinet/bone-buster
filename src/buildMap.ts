import { generateMap, type ObjexoomMap } from "./engine";
import { loadRefLevel } from "./refLevel";
import type { Difficulty, LevelChoice } from "./settings";

/**
 * Builds the active map from settings. "procedural" yields a seeded
 * generated grid map; numeric choices 1..5 load decoded reference levels
 * E1M1..E1M5 (RefLevelIndex 0..4).
 *
 * I4 — difficulty is passed through so reference-level `ManyEnemies`
 * (class 9) markers can expand into `DIFFICULTY*5 + 5 + count*π|0`
 * enemies per the ref formula instead of a fixed 2.
 */
export function buildMap(
	seed: number,
	level: LevelChoice,
	difficulty: Difficulty = "hurtMePlenty",
): ObjexoomMap {
	if (level === "procedural") return generateMap(seed);
	const refIdx = (level - 1) as 0 | 1 | 2 | 3 | 4;
	return loadRefLevel(refIdx, difficulty);
}
