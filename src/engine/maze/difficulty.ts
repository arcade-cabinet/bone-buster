/**
 * STRUCT3 — logarithmic difficulty scaling by descent depth. Endless play can't
 * scale difficulty LINEARLY (it would explode by depth 20); a log curve climbs
 * fast early then flattens, so deeper is meaningfully harder without becoming
 * impossible. Pure + bounded.
 *
 * `difficultyForDepth(0) === 1` EXACTLY so depth-0 generation (the canonical
 * baseline + the generateMap byte-snapshot) is unchanged.
 */

/** How steeply difficulty climbs with log-depth. */
const DEPTH_SCALE = 0.55;
/** Hard ceiling so very deep runs stay survivable (and draw counts bounded). */
const MAX_DIFFICULTY = 3.0;

/**
 * Enemy-count / density multiplier for a given depth. `1 + log2(depth+1) ·
 * DEPTH_SCALE`, clamped to MAX_DIFFICULTY. Monotonic non-decreasing, sub-linear,
 * bounded. depth 0 → 1 (no scaling), depth 1 → 1.55, depth 3 → 2.1, depth 7 →
 * 2.65, → asymptotes at 3.0.
 */
export function difficultyForDepth(depth: number): number {
	if (depth <= 0) return 1;
	return Math.min(MAX_DIFFICULTY, 1 + Math.log2(depth + 1) * DEPTH_SCALE);
}
