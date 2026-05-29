/**
 * Shared game-lifecycle constants. PREP-C2 (OVERHAUL2 review): moved from
 * `app/views/gameConstants.ts` into `src/store/` to fix the layer inversion —
 * the pure `gameReducer` (src/store) had a RUNTIME value-import reaching UP into
 * the app/views layer for `GOING_BACK_BUDGET_MS`. A leaf in `src/store` (imports
 * nothing) is the correct home: the store + the level-transition hook both
 * import DOWN/sideways, never up. STRUCT3/STRUCT5 tunables land here too.
 */

export const TRANSITION_HOLD_MS = 800;
// (RUN_LENGTH lives in @store/runStats — advanceLevel/nextStatusAfterTransition own it.)
/**
 * POL37 — total budget the player has to retrace from the goal back to spawn
 * after the boss + key are taken. 30s traverses any procedural map at a brisk
 * walk; too short feels like a punish, too long defeats the "urgent retreat".
 */
export const GOING_BACK_BUDGET_MS = 30_000;
